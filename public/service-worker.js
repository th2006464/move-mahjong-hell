const CACHE_NAME='mahjong-shell-v1';
const APP_SHELL=['/','/reference-game','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/assets/reference-tile-atlas.webp','/audio/background.mp3','/audio/match.mp3'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mahjong-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
});

async function networkFirst(request,fallback){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    return (await cache.match(request))||(fallback?await cache.match(fallback):undefined)||Response.error();
  }
}

async function leaderboard(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    const cached=await cache.match(request);
    if(!cached)return Response.json({ok:true,entries:[],offline:true},{headers:{'X-Mahjong-Offline':'1'}});
    const headers=new Headers(cached.headers);headers.set('X-Mahjong-Offline','1');
    return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname==='/api/leaderboard'){event.respondWith(leaderboard(request));return}
  if(url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    const fallback=url.pathname.startsWith('/reference-game')?'/reference-game':'/';
    event.respondWith(networkFirst(request,fallback));return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{
    if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone())}
    return response;
  })));
});
