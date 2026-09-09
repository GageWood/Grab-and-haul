const CACHE="grab-haul-v17";
const ASSETS=["./","./index.html","./app.css","./app.js","./photo-estimate-ui.js","./manifest.json","./icon.svg","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(async r=>{
    if(e.request.mode==="navigate" || e.request.destination==="document"){
      const text=await r.clone().text();
      if(!text.includes('photo-estimate-ui.js')){
        const injected=text.replace('</body>','<script src="photo-estimate-ui.js"></script></body>');
        r=new Response(injected,{status:r.status,statusText:r.statusText,headers:r.headers});
      }
    }
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;
  }).catch(()=>caches.match(e.request)));
});