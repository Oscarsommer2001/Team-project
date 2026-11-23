import { createClient } from 'npm:@supabase/supabase-js@2.87.1';
import webpush from 'npm:web-push@3.6.7';

// Gateway JWT verification is off ONLY because cron uses a different secret.
// Every non-cron request is verified with Supabase Auth before accessing data.
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const messages: Record<string,string> = {
  retriever:'Hi!! Hi!! 🐶 It’s check-in time! Let’s celebrate your little wins!',
  younger:'hey... did we make a little time for ourselves today? let’s check in.',
  coworker:'RE: Daily check-in. Just circling back on today’s progress. Thanks in advance 🙂',
  mum:'CHECK-IN TIME! Tell me how your day went. Love, Mum.',
  sergeant:'DAILY CHECK-IN, RECRUIT! LOG YOUR PROGRESS. TOMORROW WE GO AGAIN!'
};
function validSubscription(s: any) {
  if (!s || typeof s.endpoint!=='string' || s.endpoint.length>2048) throw new Error('Invalid subscription.');
  const u=new URL(s.endpoint);
  const host=u.hostname;
  if(u.protocol!=='https:' || u.username || u.password || u.port || u.hash ||
    !(host==='fcm.googleapis.com' || host==='updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host==='web.push.apple.com' || host.endsWith('.push.apple.com') || host==='wns.windows.com' || host.endsWith('.wns.windows.com')))
    throw new Error('This browser’s push service is not supported.');
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(s.keys?.p256dh||'') || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys?.auth||'')) throw new Error('Invalid subscription keys.');
  return {endpoint:s.endpoint, keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};
}
const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function checked<T>({data,error}:{data:T,error:any}):T {if(error)throw new Error('Notification storage is unavailable.');return data;}
async function settings() {return checked(await db.rpc('push_settings'));}
async function send(row:any, vapid:any, test=false) {
  const subscription=validSubscription(row.subscription);
  const payload=JSON.stringify({owner:row.owner_id||row.user_id,title:'Guilt Trip',body: test ? 'Your coach can reach you here. Daily check-ins are ready!' : (messages[row.coach]||messages.retriever),tag:test?'guilt-trip-test':'guilt-trip-checkin-'+row.day});
  const details=webpush.generateRequestDetails(subscription,payload,{TTL:300,urgency:'normal',vapidDetails:{subject:'https://github.com/Oscarsommer2001/Team-project',publicKey:vapid.publicKey,privateKey:vapid.privateKey}});
  const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});
  if(response.status===404||response.status===410) {
    checked(await db.from('push_devices').update({enabled:false,delivery_status:'expired'}).eq('id',row.device_id||row.id));
    throw new Error('This notification subscription expired. Turn reminders off and on again.');
  }
  if(!response.ok)throw new Error('The browser’s notification service did not accept the message.');
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Use POST.'},405);
  try {
    const raw=await req.text();if(raw.length>8192)return json({error:'Request too large.'},413);
    const body=JSON.parse(raw);
    if(body.action==='cron') {
      const supplied=req.headers.get('x-push-cron');if(!supplied)return json({error:'Unauthorized.'},401);
      const cfg=await settings();
      if(await digest(supplied)!==await digest(cfg.cron_token))return json({error:'Unauthorized.'},401);
      if(!cfg.vapid)return json({attempted:0});
      const due=checked(await db.rpc('claim_daily_push'))||[];
      let accepted=0;
      // Small parallel batches avoid runtime overruns without flooding providers.
      for(let i=0;i<due.length;i+=10)await Promise.all(due.slice(i,i+10).map(async(row:any)=>{
        let status='failed';
        try{await send(row,cfg.vapid);status='accepted';accepted++;}catch{/* no endpoint, keys or personal data in logs */}
        checked(await db.from('push_devices').update({delivery_status:status}).eq('id',row.device_id).eq('last_day',row.day));
      }));
      return json({attempted:due.length,accepted});
    }
    const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
    if(!token)return json({error:'Please log in first.'},401);
    const {data,error}=await db.auth.getUser(token);
    if(error||!data.user)return json({error:'Please log in again.'},401);
    const owner=data.user.id;
    if(body.action==='key') {
      let cfg=await settings();
      if(!cfg.vapid)cfg=checked(await db.rpc('push_settings',{candidate:webpush.generateVAPIDKeys()}));
      return json({publicKey:cfg.vapid.publicKey});
    }
    if(!['subscribe','status','disable','test'].includes(body.action))return json({error:'Unknown action.'},400);
    const sub=validSubscription(body.subscription),id=await digest(sub.endpoint);
    const row=checked(await db.from('push_devices').select('*').eq('id',id).eq('user_id',owner).maybeSingle());
    if(body.action==='disable') {
      checked(await db.from('push_devices').update({enabled:false}).eq('id',id).eq('user_id',owner));
      return json({enabled:false});
    }
    if(body.action==='test') {
      if(!row?.enabled)return json({error:'Enable daily check-ins first.'},400);
      if(!checked(await db.rpc('claim_push_test',{device:id,owner})))return json({error:'Please wait one minute before sending another test.'},429);
      await send(row,(await settings()).vapid,true);return json({accepted:true});
    }
    const timezone=body.timezone;
    if(typeof timezone!=='string'||timezone.length>100)return json({error:'Invalid time zone.'},400);
    try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{return json({error:'Invalid time zone.'},400);}
    if(body.action==='subscribe') {
      // The opaque endpoint is a device capability; overwrite ownership only on explicit opt-in.
      // Clear the browser subscription on logout/account changes as well.
      if(!row){const count=await db.from('push_devices').select('id',{count:'exact',head:true}).eq('user_id',owner).eq('enabled',true);if(count.error)throw count.error;if((count.count||0)>=10)return json({error:'Ten devices are already enabled for this account.'},400);}
      checked(await db.from('push_devices').upsert({id,user_id:owner,subscription:sub,timezone,enabled:true,expires_at:new Date(Date.now()+60*86400000).toISOString(),updated_at:new Date().toISOString()},{onConflict:'id'}));
      return json({enabled:true});
    }
    const enabled=!!row?.enabled&&new Date(row.expires_at).getTime()>Date.now();
    if(enabled)checked(await db.from('push_devices').update({timezone,expires_at:new Date(Date.now()+60*86400000).toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',owner));
    return json({enabled});
  }catch(error){return json({error:error instanceof SyntaxError?'Invalid request.':(error instanceof Error?error.message:'Unable to set up notifications.')},400);}
});
