/** User-triggered offline download of public classic illustrations only.
 * Never fetch, store or enumerate private books, account media or user uploads.
 */
export const OFFLINE_STORY_CACHE="wondertale-offline-stories-v1";
const supported=new Set(["red-hood","cinderella","three-pigs"]);
const animations:Record<string,string[]>={
  "red-hood":["red-hood-walk-wave"],
  "cinderella":["cinderella-walking"],
  "three-pigs":["three-pigs-building","three-pigs-wolf"]
};
export function canDownloadClassicArt(id:string|undefined):boolean{
  return typeof id==="string"&&supported.has(id);
}
export function classicOfflineArtUrls(id:string):string[]{
  if(!supported.has(id))return [];
  const pages=Array.from({length:8},(_,i)=>`/images/classics/${id}/pages/page-${i+1}.png`);
  const gifs=(animations[id]||[]).map(name=>`/images/classics/${id}/animations/${name}.gif`);
  return [...pages,...gifs];
}
export async function hasClassicOfflineArt(id:string):Promise<boolean>{
  if(!canDownloadClassicArt(id)||!("caches" in window))return false;
  try{
    const cache=await caches.open(OFFLINE_STORY_CACHE);
    for(const url of classicOfflineArtUrls(id).slice(0,8)){
      if(!await cache.match(url))return false;
    }
    return true;
  }catch{return false;}
}
export async function downloadClassicOfflineArt(id:string):Promise<{saved:number;total:number}>{
  if(!canDownloadClassicArt(id))throw new Error("UNSUPPORTED_BOOK");
  if(!("caches" in window))throw new Error("CACHE_UNAVAILABLE");
  const cache=await caches.open(OFFLINE_STORY_CACHE);
  const urls=classicOfflineArtUrls(id);
  let saved=0;
  const added:string[]=[];
  for(const url of urls){
    try{
      // A failed refresh must not remove illustrations saved in an earlier session.
      const alreadyCached=Boolean(await cache.match(url));
      const response=await fetch(url,{credentials:"omit",cache:"no-cache"});
      const expected=url.endsWith(".gif")?"image/gif":"image/png";
      const type=response.headers.get("content-type")||"";
      if(!response.ok||!type.toLowerCase().includes(expected))throw new Error("INVALID_ART");
      await cache.put(url,response);
      if(!alreadyCached)added.push(url);
      saved++;
    }catch{
      // Missing animations are optional, but every static story page is required.
      if(url.endsWith(".png")){
        // Roll back only entries added by this attempt, preserving older downloads.
        await Promise.allSettled(added.map(path=>cache.delete(path)));
        throw new Error("OFFLINE_IMAGE_FAILED");
      }
    }
  }
  return {saved,total:urls.length};
}
export async function clearClassicOfflineArt(id:string):Promise<void>{
  if(!canDownloadClassicArt(id)||!("caches" in window))return;
  const cache=await caches.open(OFFLINE_STORY_CACHE);
  await Promise.all(classicOfflineArtUrls(id).map(url=>cache.delete(url)));
}
