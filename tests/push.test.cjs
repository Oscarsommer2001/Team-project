const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function sender({validUser=true,row=null,claim=true,due=[]}={}){
 let handler;const calls=[];
 const db={auth:{getUser:async token=>validUser&&token==='valid'?{data:{user:{id:'alice'}}}:{data:{},error:{}}},rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:name==='push_settings'?{cron_token:'server-only-test-secret',vapid:{publicKey:'public',privateKey:'private'}}:name==='claim_push_test'?claim:due,error:null};},from(table){const call={table,filters:[]};calls.push(call);const q={select(){return q},eq(k,v){call.filters.push([k,v]);return q},update(v){call.update=v;return q},upsert(v){call.upsert=v;return q},maybeSingle:async()=>({data:row,error:null}),then(resolve){resolve({data:null,error:null,count:0})}};return q}};
 const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/daily-checkin/index.ts','utf8').replace(/^import .*;\n/gm,''));
 vm.runInNewContext(source,{createClient:()=>db,webpush:{generateRequestDetails(){calls.push({send:true});return {endpoint:'https://fcm.googleapis.com/test',headers:{},body:'encrypted'};}},Deno:{env:{get:()=>''},serve(fn){handler=fn}},Request,Response,URL,JSON,Date,Intl,crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,AbortSignal,fetch:async()=>new Response(null,{status:201})});
 return {calls,invoke:(body,headers={})=>handler(new Request('https://example.test',{method:'POST',body:JSON.stringify(body),headers}))};
}
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
test('sender rejects unsigned, invalid and forged cron requests',async()=>{
 const h=sender();assert.equal((await h.invoke({action:'key'})).status,401);assert.equal((await h.invoke({action:'key'},{Authorization:'Bearer bad'})).status,401);assert.equal((await h.invoke({action:'cron'})).status,401);assert.equal((await h.invoke({action:'cron'},{'x-push-cron':'wrong'})).status,401);assert.ok(!h.calls.some(c=>c.rpc==='claim_daily_push'));
});
test('subscription endpoints cannot target private networks or lookalike services',async()=>{
 for(const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:password@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x']){
  const h=sender();const response=await h.invoke({action:'subscribe',subscription:{...subscription,endpoint},timezone:'Europe/Lisbon'},{Authorization:'Bearer valid'});assert.equal(response.status,400);assert.ok(!h.calls.some(c=>c.upsert));
 }
});
test('test messages require an enabled owned device and enforce cooldown',async()=>{
 const missing=sender();assert.equal((await missing.invoke({action:'test',subscription},{Authorization:'Bearer valid'})).status,400);assert.ok(missing.calls.find(c=>c.table).filters.some(([k,v])=>k==='user_id'&&v==='alice'));
 const limited=sender({row:{enabled:true},claim:false});assert.equal((await limited.invoke({action:'test',subscription},{Authorization:'Bearer valid'})).status,429);assert.ok(!limited.calls.some(c=>c.send));
});
test('valid cron uses atomic claims and reports provider acceptance',async()=>{
 const h=sender({due:[{device_id:'device',owner_id:'alice',subscription,coach:'mum',day:'2026-11-23'}]});const r=await h.invoke({action:'cron'},{'x-push-cron':'server-only-test-secret'});assert.equal(r.status,200);assert.deepEqual(await r.json(),{attempted:1,accepted:1});assert.equal(h.calls.filter(c=>c.send).length,1);
});
function worker(){
 const listeners={},notices=[],cache=new Map();let closed=0,focused=0,opened=0;
 const context={URL,Response,self:{registration:{scope:'https://guilt.example/',showNotification:async(title,options)=>notices.push({title,options}),getNotifications:async()=>[{close(){closed++}}]},addEventListener:(kind,fn)=>listeners[kind]=fn,clients:{claim(){},matchAll:async()=>[{url:'https://guilt.example/',focus(){focused++}}],openWindow(){opened++}}},caches:{open:async()=>({put:async(k,v)=>cache.set(k,v),match:async k=>cache.get(k)?.clone()})}};
 vm.runInNewContext(fs.readFileSync('dist/sw.js','utf8'),context);
 async function event(kind,event){let pending;listeners[kind]({...event,waitUntil:p=>pending=p});await pending;}
 return {notices,event,counts:()=>({closed,focused,opened})};
}
test('worker drops prior-account notifications and clears visible notices on logout',async()=>{
 const h=worker();await h.event('message',{source:{url:'https://guilt.example/'},data:{type:'push-owner',owner:'alice'},ports:[]});
 await h.event('push',{data:{json:()=>({owner:'bob',body:'private'})}});assert.equal(h.notices.length,0);
 await h.event('push',{data:{json:()=>({owner:'alice',body:'Check in',tag:'daily'})}});assert.equal(h.notices.length,1);
 await h.event('message',{source:{url:'https://guilt.example/'},data:{type:'push-owner',owner:null},ports:[]});
 await h.event('push',{data:{json:()=>({owner:'alice',body:'late message'})}});assert.equal(h.notices.length,1);assert.equal(h.counts().closed,1);
});
test('notification clicks focus the app and ignore supplied external URLs',async()=>{
 const h=worker();await h.event('notificationclick',{notification:{close(){},data:{url:'https://evil.test'}}});assert.equal(h.counts().focused,1);assert.equal(h.counts().opened,0);
});
