/* No offline page caching: accounts and habit data remain in the app's storage. */
const deviceCache='guilt-trip-push-device-v1';
const ownerURL=new URL('__push_owner__',self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data?.type!=='push-owner')return;
  // Messages only from same-origin clients in our scope.
  if(!event.source?.url?.startsWith(self.registration.scope))return;
  event.waitUntil((async()=>{try{const cache=await caches.open(deviceCache);await cache.put(ownerURL,new Response(JSON.stringify({owner:event.data.owner||null})));if(!event.data.owner){const notices=await self.registration.getNotifications();notices.forEach(n=>n.close());}event.ports[0]?.postMessage({ok:true});}catch{event.ports[0]?.postMessage({ok:false});}})());
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
  let data;try{data=event.data.json();}catch{return;}
  const cached=await (await caches.open(deviceCache)).match(ownerURL);
  const owner=cached?(await cached.json()).owner:null;
  // Drop queued notifications from a previous login on a shared device.
  if(!owner||data.owner!==owner)return;
  await self.registration.showNotification('Guilt Trip',{body:String(data.body||'Time for your daily check-in.').slice(0,300),tag:String(data.tag||'guilt-trip-checkin'),icon:new URL('icons/icon-192.png',self.registration.scope).href,badge:new URL('icons/icon-192.png',self.registration.scope).href,data:{url:self.registration.scope}});
})()));
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=tabs.find(t=>t.url.startsWith(self.registration.scope));if(existing)return existing.focus();return self.clients.openWindow(self.registration.scope);})());
});
