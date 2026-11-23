const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const CloudStore=require('../dist/cloud-store.js');
const {validate}=require('../dist/account-state.js');
function memory(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
const state={goals:[],logs:{},sessions:{},tone:'retriever',displayName:'Alice',fullName:'',checkinTime:'20:00',reminders:true,paused:false};
async function harness({session=null,queryError=null,row={payload:state,revision:1},recover=false}={}){
 const nodes=new Map(), calls=[], scripts=[],timers=[],events={},local=memory(),draft=memory();let changed,reloads=0;
 function el(id){if(!nodes.has(id))nodes.set(id,{hidden:false,inert:false,value:'',textContent:'',dataset:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v},querySelectorAll(){return []},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)}
 const modes=['login','signup','reset'].map(m=>{const n=el('mode-'+m);n.dataset.accountMode=m;return n});
 el('#account-form').elements={email:el('email'),password:el('password')};
 el('#account-form').querySelectorAll=()=>[el('email'),el('password'),el('#account-submit')];
 local.setItem('unfuck-day-v2',JSON.stringify({...state,displayName:'Guest'}));
 const auth={onAuthStateChange(fn){changed=fn},async getSession(){if(recover)changed('PASSWORD_RECOVERY',session);return {data:{session},error:null}},async signUp(args){calls.push(['signup',args]);return {data:{session:null},error:null}},async signInWithPassword(args){calls.push(['login',args]);return {error:null}},async resetPasswordForEmail(...args){calls.push(['reset',...args]);return {error:null}},async updateUser(args){calls.push(['password',args]);return {error:null}},async signOut(){calls.push(['logout']);return {error:null}}};
 const client={auth,from(table){const call={table};calls.push(call);return {select(){return this},eq(k,v){call[k]=v;return this},insert(v){call.insert=v;return this},update(v){call.update=v;return this},async maybeSingle(){return {data:row,error:queryError}},async single(){return {data:row||{payload:null,revision:1},error:queryError}}}}};
 const context={window:{GuiltTripConfig:{url:'https://example.supabase.co',publishableKey:'public-test',emailDeliveryEnabled:true},supabase:{createClient(){return client}},GuiltCloudStore:CloudStore,GuiltAccountState:{validate}},document:{querySelector:el,querySelectorAll(s){return s==='[data-account-mode]'?modes:s==='dialog[open]'?[...nodes.values()].filter(n=>n.open):[]},createElement(){return {}},body:{append(s){scripts.push(s.src);queueMicrotask(()=>s.onload())}}},location:{origin:'http://localhost:8000',pathname:'/',reload(){reloads++}},localStorage:local,sessionStorage:draft,setTimeout(fn){timers.push(fn)},addEventListener(k,fn){events[k]=fn},confirm(){return true},URL,Blob};
 await vm.runInNewContext(fs.readFileSync('dist/account.js','utf8'),context);
 return {el,modes,calls,scripts,context,auth,changed:(...args)=>changed(...args),timers,events,local,draft,reloads:()=>reloads};
}
(async()=>{
 const guest=await harness();assert.equal(guest.context.window.GuiltStorage,guest.local);assert.deepEqual(guest.scripts,['app.js?v=joint-2','progress-ui.js?v=progress-7','quiz-ui.js?v=accounts-1']);
 guest.el('#account-button').onclick();guest.modes[1].onclick();guest.el('email').value='test@example.com';guest.el('password').value='test-password';
 await guest.el('#account-form').onsubmit({preventDefault(){}});
 assert.equal(guest.calls[0][0],'signup');assert.equal(guest.calls[0][1].options.emailRedirectTo,'http://localhost:8000/');assert.match(guest.el('#account-message').textContent,/Check your email/);assert.equal(guest.el('password').value,'');
 guest.auth.signInWithPassword=async()=>({error:{message:'Invalid login credentials'}});guest.modes[0].onclick();await guest.el('#account-form').onsubmit({preventDefault(){}});assert.equal(guest.el('#account-message').textContent,'Invalid login credentials');assert.equal(guest.el('#account-submit').disabled,false);
 guest.modes[2].onclick();await guest.el('#account-form').onsubmit({preventDefault(){}});assert.equal(guest.calls.at(-1)[0],'reset');assert.match(guest.el('#account-message').textContent,/reset link/);
 const member=await harness({session:{user:{id:'alice',email:'alice@example.com'}}});assert.equal(member.calls[0].user_id,'alice');assert.equal(member.context.window.GuiltStorage.getItem('nudge-v1'),null);assert.equal(JSON.parse(member.context.window.GuiltStorage.value).displayName,'Alice');
 member.changed('SIGNED_OUT',null);assert.equal(member.el('#app-shell').hidden,true);await member.timers.at(-1)();assert.equal(member.reloads(),1);assert.equal(JSON.parse(member.local.getItem('unfuck-day-v2')).displayName,'Guest');
 const failed=await harness({session:{user:{id:'alice'}},queryError:{message:'Offline'}});assert.equal(failed.scripts.length,0);assert.match(failed.el('#boot-message').textContent,/has not been replaced/);assert.equal(failed.context.window.GuiltStorage,undefined);
 const recovery=await harness({session:{user:{id:'alice',email:'alice@example.com'}},recover:true});assert.equal(recovery.el('#account-title').textContent,'Choose a new password.');recovery.el('password').value='replacement-password';await recovery.el('#account-form').onsubmit({preventDefault(){}});assert.equal(recovery.calls.at(-1)[0],'password');assert.equal(recovery.draft.getItem('guilt-trip-recovering'),null);
 console.log('PASS: sign-up confirmation, login errors, password reset/recovery, session isolation, and failed-load protection.');
})().catch(error=>{console.error(error);process.exitCode=1});
