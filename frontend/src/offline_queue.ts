// Account-scoped, bounded metadata queue. Never store tokens or story content.
export type PendingMetadata={progress:Record<string,number>;favorites:Record<string,boolean>};
const prefix="wondertale:pending-metadata:v1:";
// The writer can store 100 progress and 100 favorite IDs of up to 128 chars.
// Their combined JSON can exceed 16 KB; keep the read ceiling above that
// maximum, otherwise a valid queue silently disappears after an iPhone restart.
const maxSerializedLength=32768;
const empty=():PendingMetadata=>({progress:{},favorites:{}});
const validId=(id:string)=>/^[a-zA-Z0-9_-]{1,128}$/.test(id)&&id!=="__proto__"&&id!=="constructor"&&id!=="prototype";
const key=(owner:string)=>prefix+owner;
export function readPendingMetadata(owner:string):PendingMetadata{
 if(!validId(owner))return empty();
 try{
  const raw=localStorage.getItem(key(owner));
  if(!raw||raw.length>maxSerializedLength)return empty();
  const data:unknown=JSON.parse(raw);
  if(!data||typeof data!=="object")return empty();
  const item=data as Partial<PendingMetadata>;
  const result=empty();
  const progress=item.progress&&typeof item.progress==="object"&&!Array.isArray(item.progress)?item.progress:{};
  const favorites=item.favorites&&typeof item.favorites==="object"&&!Array.isArray(item.favorites)?item.favorites:{};
  for(const [id,page] of Object.entries(progress).slice(0,100))
   if(validId(id)&&Number.isInteger(page)&&page>=0&&page<=99)result.progress[id]=page;
  for(const [id,favorite] of Object.entries(favorites).slice(0,100))
   if(validId(id)&&typeof favorite==="boolean")result.favorites[id]=favorite;
  return result;
 }catch{return empty();}
}
export function writePendingMetadata(owner:string,data:PendingMetadata):void{
 if(!validId(owner))return;
 try{
  const progress=Object.fromEntries(Object.entries(data.progress).filter(([id,page])=>validId(id)&&Number.isInteger(page)&&page>=0&&page<=99).slice(-100));
  const favorites=Object.fromEntries(Object.entries(data.favorites).filter(([id,value])=>validId(id)&&typeof value==="boolean").slice(-100));
  if(!Object.keys(progress).length&&!Object.keys(favorites).length)localStorage.removeItem(key(owner));
  else localStorage.setItem(key(owner),JSON.stringify({progress,favorites}));
 }catch{/* Storage can be unavailable in private browsing. */}
}
export async function getAuthenticatedOwner(api:string,token:string):Promise<string>{
 const response=await fetch(api+"/api/me",{
  headers:{Authorization:"Bearer "+token},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error("Unable to verify account");
 const data:unknown=await response.json();
 const id=(data as {id?:unknown})?.id;
 if(typeof id!=="string"||!validId(id))throw Error("Invalid account identifier");
 return id;
}

/**
 * Repair queued progress after a parent signs back in and the server supplies
 * current page counts. Keep unknown book IDs for a later refresh: a newly
 * created book may not yet be present on a lagging read replica.
 */
export function normalizePendingProgress(
 progress: ReadonlyMap<string,number>,
 books: readonly {id:string;pages:readonly unknown[]}[]
): Map<string,number>{
 const lastPageById=new Map(books.map(book=>[
  book.id,Math.max(0,book.pages.length-1)
 ] as const));
 const repaired=new Map<string,number>();
 for(const [id,page] of progress){
  if(!validId(id)||!Number.isInteger(page)||page<0||page>99)continue;
  const last=lastPageById.get(id);
  repaired.set(id,last===undefined?page:Math.min(page,last));
 }
 return repaired;
}
