/* Cache offline do aplicativo; online: sempre buscar HTML mais recente. */
const CACHE_APP='amostragem-app-v9', CACHE_TILES='tiles-satelite-v1';
const ROOT=self.registration.scope;
const INDEX=new URL('index.html',ROOT).href;
const SHELL=['manifest.webmanifest','assets/icon.svg'];
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css','https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/turf.min.js','https://cdnjs.cloudflare.com/ajax/libs/togeojson/0.16.0/togeojson.min.js'];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_APP);
  /* Query nova evita receber o index.html antigo do service worker anterior. */
  const refresh=new URL(INDEX);
  refresh.searchParams.set('__app_version','v9');
  const html=await fetch(refresh.href,{cache:'reload'});
  if(!html.ok)throw new Error('Não foi possível atualizar a interface.');
  await cache.put(INDEX,html.clone());
  await Promise.all([...SHELL.map(path=>new URL(path,ROOT).href),...LIBS].map(async url=>{
    try{
      const response=await fetch(url,{mode:new URL(url).origin===self.location.origin?'same-origin':'no-cors'});
      if(response.ok||response.type==='opaque')await cache.put(url,response);
    }catch(_){}
  }));
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('amostragem-app-')&&key!==CACHE_APP).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_APP);
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok)await cache.put(INDEX,response.clone());
        return response;
      }catch(_){
        return (await cache.match(INDEX))||Response.error();
      }
    })());
    return;
  }
  const tile=url.href.includes('/World_Imagery/MapServer/tile/');
  const own=url.origin===self.location.origin;
  if(!tile&&!own&&!LIBS.includes(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(tile?CACHE_TILES:CACHE_APP);
    const cached=await cache.match(request);
    if(cached)return cached;
    try{
      const response=await fetch(request);
      if(response.ok||response.type==='opaque')cache.put(request,response.clone()).catch(()=>{});
      return response;
    }catch(_){return Response.error();}
  })());
});
