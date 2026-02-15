const CACHE='shadowtop30-v1';
const ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './assets/css/app.css','./assets/js/app.js',
  './reports/latest.json',
  './reports/name_to_code.json'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return;
  e.respondWith((async()=>{
    const c=await caches.match(e.request);
    if(c) return c;
    const r=await fetch(e.request);
    (await caches.open(CACHE)).put(e.request,r.clone());
    return r;
  })());
});
