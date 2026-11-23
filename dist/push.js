/* Device opt-in only. No auth tokens or habit data are stored in the worker. */
(function(){
  let client,userId,registration,enabled=false,busy=false,ready=Promise.resolve();
  const $=s=>document.querySelector(s),ownerKey='guilt-trip-push-owner';
  const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
  function show(message){$('#push-status').textContent=message;$('#push-enable').hidden=enabled;$('#push-disable').hidden=!enabled;$('#push-test').hidden=!enabled;$('#push-enable').disabled=busy||!userId||!supported()||Notification.permission==='denied';$('#push-disable').disabled=busy;$('#push-test').disabled=busy;}
  async function request(action,subscription){
    const {data,error}=await client.functions.invoke('daily-checkin',{body:{action,subscription:subscription?.toJSON(),timezone:zone()}});
    if(error){let detail;try{detail=(await error.context.json()).error;}catch{}throw new Error(detail||'Could not reach the reminder service. Please try again.');}
    if(data?.error)throw new Error(data.error);
    return data;
  }
  async function workerOwner(owner){
    if(!registration)return;
    const worker=registration.active;if(!worker)throw new Error('Notification setup is still starting. Please try again.');
    await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Notification setup timed out.')),5000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data?.ok?resolve():reject(new Error('Could not save notification settings.'));};worker.postMessage({type:'push-owner',owner},[channel.port2]);});
  }
  async function clearDevice(){
    enabled=false;
    if(!supported())return;
    registration=registration||await navigator.serviceWorker.getRegistration('./');
    if(!registration)return;
    await workerOwner(null);
    const subscription=await registration.pushManager.getSubscription();
    if(subscription)await subscription.unsubscribe();
    localStorage.removeItem(ownerKey);
  }
  async function refresh(){
    await ready;
    if(!supported()){show('Push is unavailable here. Try Chrome or Safari. On iPhone/iPad, add the HTTPS website to your Home Screen and open it there.');return;}
    if(!userId){show('Log in to get a daily check-in when the website is closed.');return;}
    if(Notification.permission==='denied'){show('Notifications are blocked. Allow them in your browser’s settings, then try again.');return;}
    const subscription=await registration.pushManager.getSubscription();
    if(subscription){const result=await request('status',subscription);enabled=result.enabled;}
    else enabled=false;
    await workerOwner(enabled?userId:null);
    show(enabled?'Daily push is on for this device · '+zone()+'. Uses your saved check-in time and coach. Pause coach reminders to pause delivery.':'Daily push is off for this device. Enable it for one check-in each day, even when the website is closed.');
  }
  async function run(action){if(busy)return;busy=true;show('One moment…');try{await ready;await action();}catch(e){show(e.message);}finally{busy=false;show($('#push-status').textContent);}}
  function init(options){
    client=options.client;userId=options.userId;busy=true;show('Checking this device…');
    $('#push-enable').onclick=()=>{
      // Ask directly inside the click, required by Safari and iOS.
      if(!supported()||!userId)return;
      const permission=Notification.requestPermission();
      run(async()=>{
        if(await permission!=='granted')throw new Error('Notifications were not allowed. You can enable them later in browser settings.');
        const {publicKey}=await request('key');
        const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
        let subscription=await registration.pushManager.getSubscription();
        if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
        try{await workerOwner(userId);await request('subscribe',subscription);localStorage.setItem(ownerKey,userId);enabled=true;await refresh();}
        catch(e){await workerOwner(null);await subscription.unsubscribe();throw e;}
      });
    };
    $('#push-disable').onclick=()=>run(async()=>{const sub=await registration.pushManager.getSubscription();await workerOwner(null);if(sub){await request('disable',sub);await sub.unsubscribe();}localStorage.removeItem(ownerKey);enabled=false;show('Daily push is off for this device.');});
    $('#push-test').onclick=()=>run(async()=>{const sub=await registration.pushManager.getSubscription();if(!sub)throw new Error('Enable daily check-ins again.');await request('test',sub);show('Test sent to your browser. Check your notifications; Focus / Do Not Disturb may silence it.');});
    ready=(async()=>{
      if(!supported())return;
      registration=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
      registration=await navigator.serviceWorker.ready;
      if(!userId||localStorage.getItem(ownerKey)!==userId)await clearDevice();
    })();
    ready.then(refresh).catch(e=>show(e.message)).finally(()=>{busy=false;show($('#push-status').textContent);});
  }
  window.GuiltPush={init,refresh:()=>{if(!busy)return refresh().catch(e=>show(e.message));},clearDevice,get enabled(){return enabled;},async beforeLogout(){await ready;if(registration){const sub=await registration.pushManager.getSubscription();await workerOwner(null);if(sub)await request('disable',sub);}await clearDevice();}};
})();
