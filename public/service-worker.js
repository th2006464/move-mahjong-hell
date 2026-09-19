const CACHE_NAME='mahjong-shell-v4';
const CORE_SHELL=['/','/reference-game','/manifest.webmanifest','/icons/icon-192.png','/assets/reference-tile-atlas.webp'];
const OFFLINE_ASSETS=[...CORE_SHELL,'/icons/icon-512.png','/audio/background.mp3','/audio/match.mp3'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mahjong-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}
  const port=event.ports[0];if(!port)return;
  if(event.data?.type==='CHECK_OFFLINE'){
    event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{
      const matches=await Promise.all(OFFLINE_ASSETS.map(asset=>cache.match(asset)));
      port.postMessage({type:'status',ready:matches.every(Boolean),version:CACHE_NAME});
    }));
    return;
  }
  if(event.data?.type==='DOWNLOAD_OFFLINE'){
    event.waitUntil((async()=>{
      try{
        const cache=await caches.open(CACHE_NAME);
        for(let i=0;i<OFFLINE_ASSETS.length;i++){
          const asset=OFFLINE_ASSETS[i],response=await fetch(asset,{cache:'reload'});
          if(!response.ok)throw new Error(`资源下载失败：${asset}`);
          await cache.put(asset,response);
          port.postMessage({type:'progress',current:i+1,total:OFFLINE_ASSETS.length});
        }
        port.postMessage({type:'complete',version:CACHE_NAME});
      }catch(error){port.postMessage({type:'error',message:error.message||'离线资源下载失败'})}
    })());
  }
});

async function navigationCacheFirst(request,fallback){
  const cache=await caches.open(CACHE_NAME);
  const cached=(await cache.match(request))||(await cache.match(fallback));
  if(cached)return cached;
  try{
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch{return Response.error()}
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
    event.respondWith(navigationCacheFirst(request,fallback));return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{
    if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone())}
    return response;
  })));
});
