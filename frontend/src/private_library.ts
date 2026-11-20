import type { DemoBook } from "./demo";

export type RemoteBook=DemoBook & {mode:"private-account"};

/** A missing book must not block synchronizing unrelated offline edits. */
export class PrivateBookNotFoundError extends Error {
 constructor(){super("Private book is not yet available");this.name="PrivateBookNotFoundError";}
}

export type TransferReport={uploaded:number;existing:number;failed:number;metadataFailed:number;serverBooks:RemoteBook[]};

type ServerRow={id:string;title:string;child_name:string;age:number;story:string;created_at:string};
type StoredStory={
 version:number; source_id:string;language?:string;theme?:string;style?:string;prompt?:string;
 pages:Array<{number:number;text:string;image_url?:string}>;
};
const fetchWithToken=(api:string,path:string,token:string,init?:RequestInit)=>fetch(api+path,{
 ...init,
 headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",...init?.headers},
 signal:AbortSignal.timeout(15000),
});
const cleanImage=(source:string,classicId?:string)=>{
 // Never transfer browser-generated image data, uploads or remote image URLs.
 if(source.startsWith("/images/classics/")&&/^\/images\/classics\/[a-z0-9-]+\.(svg|webp)$/.test(source))return source;
 if(classicId&&/^[a-z0-9-]+$/.test(classicId))return "/images/classics/"+classicId+".webp";
 return "/images/wondertale-hero.webp";
};
function normalizeServerBook(book:ServerRow):RemoteBook|null{
 try{
  // A corrupt or unexpected API row must not crash the entire parent library.
  if(!book||typeof book!=="object"||typeof book.id!=="string"||
     typeof book.story!=="string"||typeof book.title!=="string"||
     typeof book.child_name!=="string"||typeof book.created_at!=="string"||
     !Number.isInteger(book.age)||book.age<2||book.age>14)return null;
  const stored=JSON.parse(book.story) as StoredStory;
  if(!stored||typeof stored!=="object")return null;
  if(!Array.isArray(stored.pages)||stored.pages.length<1)return null;
  // A malformed page must not silently disappear: filtering it would shift
  // reading progress and make the remaining pages appear under wrong numbers.
  if(stored.pages.length>30)return null;
  if(!stored.pages.every(p=>p&&typeof p.text==="string"&&p.text.trim().length>0&&p.text.length<1600))return null;
  const pages=stored.pages.map((p,index)=>({
   number:index+1,text:p.text,
   image_url:cleanImage(typeof p.image_url==="string"?p.image_url:"")
  }));
  return {id:book.id,created_at:book.created_at,name:book.child_name,age:book.age,title:book.title,
   theme:typeof stored.theme==="string"?stored.theme:"",
   prompt:typeof stored.prompt==="string"?stored.prompt:"",
   style:typeof stored.style==="string"?stored.style:"",
   language:stored.language==="uz"||stored.language==="en"?stored.language:"ru",
   pages,mode:"private-account"};
 }catch{return null;}
}
export async function loadPrivateBooks(api:string,token:string):Promise<RemoteBook[]>{
 // Snapshot all parent-owned records after authentication: books, favorites and reading progress.
 const [bookRes,favoriteRes,progressRes]=await Promise.all([
  fetchWithToken(api,"/api/books",token),
  fetchWithToken(api,"/api/books/favorites",token),
  fetchWithToken(api,"/api/books/progress",token)
 ]);
 if([bookRes,favoriteRes,progressRes].some(response=>response.status===401||response.status===403))throw Error("Private account authorization expired");
 if(!bookRes.ok||!favoriteRes.ok||!progressRes.ok)throw Error("Unable to fetch private library");
 const [rows,favorites,progress]:[unknown,unknown,unknown]=await Promise.all([
  bookRes.json(),favoriteRes.json(),progressRes.json()
 ]);
 if(!Array.isArray(rows)||!favorites||typeof favorites!=="object"||!Array.isArray((favorites as {ids?:unknown}).ids)||!Array.isArray(progress))
  throw Error("Invalid private library response");
 const favoriteIds=new Set((favorites as {ids:unknown[]}).ids.filter((id):id is string=>typeof id==="string"));
 const pageById=new Map<string,number>();
 for(const item of progress){
  if(item&&typeof item==="object"&&typeof item.book_id==="string"&&Number.isInteger(item.page)&&item.page>=0)
   pageById.set(item.book_id,item.page);
 }
 return rows.map(row=>normalizeServerBook(row as ServerRow)).filter((b):b is RemoteBook=>b!==null).map(book=>({
  ...book,favorite:favoriteIds.has(book.id),lastPage:Math.min(book.pages.length-1,pageById.get(book.id)||0)
 }));
}
export async function updatePrivateReadingProgress(api:string,token:string,bookId:string,page:number):Promise<void>{
 const response=await fetchWithToken(api,"/api/books/"+encodeURIComponent(bookId)+"/progress",token,{
  method:"POST",body:JSON.stringify({page})
 });
 if(response.status===401||response.status===403)throw Error("Private account authorization expired");
 if(response.status===404)throw new PrivateBookNotFoundError();
 if(!response.ok)throw Error("Unable to synchronize reading position");
}
export async function updatePrivateFavorite(api:string,token:string,bookId:string):Promise<boolean>{
 const response=await fetchWithToken(api,"/api/books/"+encodeURIComponent(bookId)+"/favorite",token,{method:"POST"});
 if(response.status===401||response.status===403)throw Error("Private account authorization expired");
 if(!response.ok)throw Error("Unable to update private favorite");
 const data=await response.json();
 if(typeof data.favorite!=="boolean")throw Error("Invalid favorite response");
 return data.favorite;
}
export async function setPrivateFavorite(api:string,token:string,bookId:string,favorite:boolean):Promise<void>{
 const response=await fetchWithToken(api,"/api/books/"+encodeURIComponent(bookId)+"/favorite",token,{
  method:"PUT",body:JSON.stringify({favorite})
 });
 if(response.status===401||response.status===403)throw Error("Private account authorization expired");
 if(response.status===404)throw new PrivateBookNotFoundError();
 if(!response.ok)throw Error("Unable to synchronize favorite");
}
export async function validateSession(api:string,token:string):Promise<boolean>{
 try{const response=await fetchWithToken(api,"/api/me",token);return response.ok;}catch{return false;}
}
export async function transferLocalBooks(api:string,token:string,localBooks:DemoBook[]):Promise<TransferReport>{
 // This function must only be called from the explicit parent's transfer button.
 const existingRows=await fetchWithToken(api,"/api/books",token);
 if(existingRows.status===401||existingRows.status===403)throw Error("Private account authorization expired");
 if(!existingRows.ok)throw Error("Private library unavailable");
 const responseData:unknown=await existingRows.json();
 if(!Array.isArray(responseData))throw Error("Invalid private library response");
 const rows=responseData as ServerRow[];
 const transferred=new Set<string>();
 for(const row of rows){
  try{
   const story=JSON.parse(row.story);
   if(typeof story.source_id==="string")transferred.add(story.source_id);
  }catch{/* old server books */}
 }
 let uploaded=0,existing=0,failed=0;
 // A timed-out POST may have reached the server. Reconcile its outcome
 // before telling the parent that a book was lost or should be retried.
 const uncertainIds=new Set<string>();
 // Process every locally saved book. A hidden 20-book slice previously
 // reported success while silently leaving the remaining books behind.
 for(const book of localBooks.filter(x=>x&&x.savedOnDevice)){
  if(transferred.has(book.id)){existing++;continue;}
  // Invalid local records should fail individually, not abort every book.
  // This matters when an old PWA version left partially written data.
  let encoded:string;
  try{
   if(!book||typeof book.id!=="string"||!/^local-[A-Za-z0-9_-]{1,120}$/.test(book.id)||
      typeof book.title!=="string"||!book.title.trim()||book.title.length>120||
      typeof book.name!=="string"||!book.name.trim()||book.name.length>60||
      !Number.isInteger(book.age)||book.age<2||book.age>14||
      typeof book.prompt!=="string"||
      !Array.isArray(book.pages)||book.pages.length<1||book.pages.length>30||
      !book.pages.every(p=>p&&typeof p.text==="string"&&p.text.trim().length>0)){
    failed++;continue;
   }
   const story:StoredStory={
    version:1,source_id:book.id,language:book.language,theme:book.theme,
    style:book.style,prompt:book.prompt.slice(0,800),
    pages:book.pages.map((p,index)=>({
     number:index+1,text:p.text.slice(0,1500),
     image_url:cleanImage(typeof p.image_url==="string"?p.image_url:"",book.classicId)
    }))
   };
   encoded=JSON.stringify(story);
   if(encoded.length>12000){failed++;continue;}
  }catch{failed++;continue;}
  try{
   const response=await fetchWithToken(api,"/api/books",token,{
    method:"POST",body:JSON.stringify({title:book.title,child_name:book.name,age:book.age,story:encoded})
   });
   if(!response.ok){
    // A session can expire during a multi-book transfer. Stop immediately:
    // subsequent requests must not be sent with a rejected bearer token.
    if(response.status===401||response.status===403)throw new Error("Private account authorization expired");
    // A 5xx response can occur after the database committed the import.
    // Reconcile it just like a lost response instead of risking duplicates.
    if(response.status>=500)uncertainIds.add(book.id);
    else failed++;
    continue;
   }
   transferred.add(book.id);uploaded++;
  }catch(error){
   if(error instanceof Error&&error.message==="Private account authorization expired")throw error;
   // Network failure is ambiguous: the server may have committed the book.
   uncertainIds.add(book.id);
  }
 }
 if(uncertainIds.size){
  try{
   const check=await fetchWithToken(api,"/api/books",token);
   if(check.status===401||check.status===403)throw Error("Private account authorization expired");
   if(!check.ok)throw Error("Unable to reconcile transfer");
   const finalRows:unknown=await check.json();
   if(!Array.isArray(finalRows))throw Error("Invalid transfer reconciliation");
   const confirmed=new Set<string>();
   for(const row of finalRows as ServerRow[]){
    try{
     const stored=JSON.parse(row.story);
     if(typeof stored.source_id==="string")confirmed.add(stored.source_id);
    }catch{/* legacy book */}
   }
   for(const id of uncertainIds){
    if(confirmed.has(id))uploaded++;
    else failed++;
   }
  }catch(error){
   if(error instanceof Error&&error.message==="Private account authorization expired")throw error;
   // Never claim success when the follow-up server check is unavailable.
   failed+=uncertainIds.size;
  }
 }
 // Restore explicitly saved local favorites and reading positions after import.
 // Resolve server IDs through source_id; local IDs are never valid remote book IDs.
 // Only add a favorite when absent because the API endpoint toggles its state.
 const serverBooks=await loadPrivateBooks(api,token);
 const latest=await fetchWithToken(api,"/api/books",token);
 if(latest.status===401||latest.status===403)throw Error("Private account authorization expired");
 if(!latest.ok)throw Error("Unable to map imported books");
 const raw:unknown=await latest.json();
 if(!Array.isArray(raw))throw Error("Invalid imported book listing");
 const bySource=new Map<string,string>();
 for(const row of raw as ServerRow[]){
  try{
   const stored=JSON.parse(row.story);
   if(typeof stored.source_id==="string")bySource.set(stored.source_id,row.id);
  }catch{/* legacy book */}
 }
 const byId=new Map(serverBooks.map(book=>[book.id,book]));
 let metadataFailed=0;
 for(const local of localBooks.filter(book=>book?.savedOnDevice)){
  const id=bySource.get(local.id);
  const remote=id?byId.get(id):undefined;
  if(!remote)continue;
  if(local.favorite&&!remote.favorite){
   try{
    await setPrivateFavorite(api,token,id!,true);
    remote.favorite=true;
   }catch(error){
    if(error instanceof Error&&error.message==="Private account authorization expired")throw error;
    metadataFailed++;
   }
  }
  if(typeof local.lastPage==="number"&&Number.isInteger(local.lastPage)&&local.lastPage>(remote.lastPage??0)&&remote.pages.length){
   try{
    const position=Math.min(local.lastPage,remote.pages.length-1);
    await updatePrivateReadingProgress(api,token,id!,position);
    remote.lastPage=position;
   }catch(error){
    if(error instanceof Error&&error.message==="Private account authorization expired")throw error;
    metadataFailed++;
   }
  }
 }
 return {uploaded,existing,failed,metadataFailed,serverBooks};
}
