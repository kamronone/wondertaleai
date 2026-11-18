import type { DemoBook } from "./demo";

export type RemoteBook=DemoBook & {mode:"private-account"};
export type TransferReport={uploaded:number;existing:number;failed:number;serverBooks:RemoteBook[]};

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
  const stored=JSON.parse(book.story) as StoredStory;
  if(!Array.isArray(stored.pages)||stored.pages.length<1)return null;
  const pages=stored.pages.slice(0,30).filter(p=>typeof p.text==="string"&&p.text.length<1600).map((p,index)=>({number:index+1,text:p.text,image_url:cleanImage(typeof p.image_url==="string"?p.image_url:"")}));
  if(!pages.length)return null;
  return {id:book.id,created_at:book.created_at,name:book.child_name,age:book.age,title:book.title,
   theme:stored.theme||"",prompt:stored.prompt||"",style:stored.style||"",
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
 if(!response.ok)throw Error("Unable to synchronize reading position");
}
export async function updatePrivateFavorite(api:string,token:string,bookId:string):Promise<boolean>{
 const response=await fetchWithToken(api,"/api/books/"+encodeURIComponent(bookId)+"/favorite",token,{method:"POST"});
 if(!response.ok)throw Error("Unable to update private favorite");
 const data=await response.json();
 if(typeof data.favorite!=="boolean")throw Error("Invalid favorite response");
 return data.favorite;
}
export async function validateSession(api:string,token:string):Promise<boolean>{
 try{const response=await fetchWithToken(api,"/api/me",token);return response.ok;}catch{return false;}
}
export async function transferLocalBooks(api:string,token:string,localBooks:DemoBook[]):Promise<TransferReport>{
 // This function must only be called from the explicit parent's transfer button.
 const existingRows=await fetchWithToken(api,"/api/books",token);
 if(!existingRows.ok)throw Error("Private library unavailable");
 const rows=await existingRows.json() as ServerRow[];
 const transferred=new Set<string>();
 for(const row of rows){
  try{const story=JSON.parse(row.story);if(typeof story.source_id==="string")transferred.add(story.source_id);}catch{/* old server books */ }
 }
 let uploaded=0,existing=0,failed=0;
 for(const book of localBooks.filter(x=>x.savedOnDevice).slice(0,20)){
  if(transferred.has(book.id)){existing++;continue;}
  const story:StoredStory={
   version:1,source_id:book.id,language:book.language,theme:book.theme,
   style:book.style,prompt:book.prompt.slice(0,800),
   pages:book.pages.map((p,index)=>({number:index+1,text:p.text.slice(0,1500),image_url:cleanImage(p.image_url,book.classicId)}))
  };
  const encoded=JSON.stringify(story);
  if(encoded.length>12000){failed++;continue;}
  try{
   const response=await fetchWithToken(api,"/api/books",token,{
    method:"POST",body:JSON.stringify({title:book.title,child_name:book.name,age:book.age,story:encoded})
   });
   if(!response.ok){failed++;continue;}
   transferred.add(book.id);uploaded++;
  }catch{failed++;}
 }
 return {uploaded,existing,failed,serverBooks:await loadPrivateBooks(api,token)};
}
