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
 const response=await fetchWithToken(api,"/api/books",token);
 if(!response.ok)throw Error("Unable to fetch private library");
 const rows:unknown=await response.json();
 if(!Array.isArray(rows))throw Error("Invalid library response");
 return rows.map(row=>normalizeServerBook(row as ServerRow)).filter((b):b is RemoteBook=>b!==null);
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
