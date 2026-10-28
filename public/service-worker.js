/* Public assets only. Never cache API responses, pages, orders or account data. */
const CACHE='liquor-plug-public-v2';
const ESSENTIALS=['/offline.html','/icons/app-192.png','/icons/app-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ESSENTIALS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('liquor-plug-public-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const {request}=event;const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  // Let the browser handle sensitive requests directly, without interception.
  if(/^\/(api|admin|account|cart|checkout|track)(\/|$)/.test(url.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;
  }
  if(!/^\/(assets|icons)\//.test(url.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request);if(cached)return cached;
    const response=await fetch(request);
    if(response.ok&&response.type==='basic'){
      await cache.put(request,response.clone());
      const keys=await cache.keys();if(keys.length>100)await cache.delete(keys.find(key=>!ESSENTIALS.includes(new URL(key.url).pathname))||keys[0]);
    }
    return response;
  }));
});
