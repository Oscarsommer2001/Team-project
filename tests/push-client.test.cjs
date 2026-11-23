const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {MessageChannel}=require('node:worker_threads');
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
async function setup({owner='alice',storedOwner=null,existing=false,status=true,denied=false,failSubscribe=false}={}){
 const nodes=new Map(),storage=new Map(storedOwner?[['guilt-trip-push-owner',storedOwner]]:[]),calls=[];let subscription=existing?sub():null,workerUser=null,permissionCalls=0,unsubscribeCalls=0;
 function sub(){return {toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}}),async unsubscribe(){unsubscribeCalls++;subscription=null;return true}};}
 const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false});return nodes.get(id)};
 const registration={active:{postMessage(message,ports){workerUser=message.owner;ports[0].postMessage({ok:true});ports[0].close();}},pushManager:{async getSubscription(){return subscription},async subscribe(){calls.push('browser-subscribe');return subscription=sub()}}};
 const context={window:{PushManager:{}},isSecureContext:true,navigator:{serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration}},Notification:{permission:'default',async requestPermission(){permissionCalls++;return denied?'denied':'granted'}},document:{querySelector:el},Intl,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},MessageChannel,setTimeout,clearTimeout,Uint8Array,atob};context.window.Notification=context.Notification;
 vm.runInNewContext(fs.readFileSync('dist/push.js','utf8'),context);
 const client={functions:{async invoke(_,{body}){calls.push(body.action);if(body.action==='subscribe'&&failSubscribe)return {error:{}};return {data:body.action==='key'?{publicKey:'B'.repeat(87)}:{enabled:status}};}}};
 context.window.GuiltPush.init({client,userId:owner});await settle();
 return {api:context.window.GuiltPush,el,calls,settle,counts:()=>({permissionCalls,unsubscribeCalls,workerUser})};
}
test('guest and startup never request notification permission',async()=>{const h=await setup({owner:null});assert.equal(h.counts().permissionCalls,0);assert.equal(h.el('#push-enable').disabled,true);assert.deepEqual(h.calls,[]);});
test('permission denial leaves push off and does not register a backend device',async()=>{const h=await setup({denied:true});h.el('#push-enable').onclick();await h.settle();assert.equal(h.api.enabled,false);assert.ok(!h.calls.includes('subscribe'));assert.match(h.el('#push-status').textContent,/not allowed/);});
test('failed backend opt-in removes the browser subscription and worker owner',async()=>{const h=await setup({failSubscribe:true});h.el('#push-enable').onclick();await h.settle();assert.equal(h.api.enabled,false);assert.equal(h.counts().unsubscribeCalls,1);assert.equal(h.counts().workerUser,null);});
test('successful opt-in can send a test and logout detaches the device',async()=>{const h=await setup();h.el('#push-enable').onclick();await h.settle();assert.equal(h.api.enabled,true);assert.equal(h.counts().workerUser,'alice');h.el('#push-test').onclick();await h.settle();assert.ok(h.calls.includes('test'));await h.api.beforeLogout();assert.ok(h.calls.includes('disable'));assert.equal(h.counts().workerUser,null);assert.equal(h.counts().unsubscribeCalls,1);});
test('account switch discards old subscription without re-enabling it',async()=>{const h=await setup({storedOwner:'bob',existing:true});assert.equal(h.counts().unsubscribeCalls,1);assert.equal(h.api.enabled,false);assert.ok(!h.calls.includes('subscribe'));});
test('server opt-out survives opening the app',async()=>{const h=await setup({storedOwner:'alice',existing:true,status:false});assert.equal(h.api.enabled,false);assert.equal(h.counts().workerUser,null);assert.ok(!h.calls.includes('subscribe'));});
