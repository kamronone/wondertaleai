/** Owner-scoped image transport. Never put bearer tokens in img src URLs. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PrivateIllustrationResult={blobUrl:string;expiresAt?:number}|{status:"pending_review"|"needs_review"}|null;

type IllustrationMetadata={jobId:string;personal:boolean;expiresAt?:number}|{status:"pending_review"|"needs_review"}|null;

async function lookupMetadata(
  api:string,token:string,bookId:string,pageNumber:number,signal:AbortSignal,
  fetcher:typeof fetch
):Promise<IllustrationMetadata>{
  // Reject userinfo, paths, query strings and fragments in the configured origin.
  // Only HTTPS and explicit localhost development are allowed.
  let origin:URL;
  try{origin=new URL(api);}catch{throw new Error("Invalid private illustration API origin");}
  if((origin.protocol!=="https:"&&!(origin.protocol==="http:"&&origin.hostname==="localhost"&&origin.port))||
     origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash||
     api!==origin.origin)
    throw new Error("Invalid private illustration API origin");
  if(!token||!UUID.test(bookId)||!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>20)
    throw new Error("Invalid private illustration request");
  const options={headers:{Authorization:"Bearer "+token},cache:"no-store" as RequestCache,redirect:"error" as RequestRedirect,credentials:"omit" as RequestCredentials,signal};
  const metadata=await fetcher(api+"/api/illustrations/books/"+bookId+"/pages/"+pageNumber,options);
  if(metadata.status===404)return null;
  if(!metadata.ok)throw new Error("Illustration lookup unavailable");
  const raw:unknown=await metadata.json();
  if(!raw||typeof raw!=="object")throw new Error("Invalid private illustration metadata");
  if("status" in raw&&(raw.status==="pending_review"||raw.status==="needs_review")&&!("job_id" in raw))
    return {status:raw.status};
  if(!("job_id" in raw)||typeof raw.job_id!=="string"||!UUID.test(raw.job_id))
    throw new Error("Invalid private illustration metadata");
  const personal="kind" in raw&&raw.kind==="personal";
  if("kind" in raw&&!personal)throw new Error("Unknown illustration kind");
  let expiresAt:number|undefined;
  if(personal){
    if(!("expires_at" in raw)||typeof raw.expires_at!=="number"||!Number.isSafeInteger(raw.expires_at))
      throw new Error("Invalid personal illustration expiry");
    expiresAt=raw.expires_at*1000;
    if(expiresAt<=Date.now())return null;
    if(expiresAt>Date.now()+900_000)throw new Error("Invalid personal illustration lifetime");
  }
  return {jobId:raw.job_id,personal,expiresAt};
}

export type PageIllustrationStatus="available"|"missing"|"pending_review"|"needs_review"|"error";
export async function lookupPrivateIllustrationStatus(
  api:string,token:string,bookId:string,pageNumber:number,signal:AbortSignal,
  fetcher:typeof fetch=fetch
):Promise<PageIllustrationStatus>{
  const result=await lookupMetadata(api,token,bookId,pageNumber,signal,fetcher);
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  return !result?"missing":"status" in result?result.status:"available";
}

/** Fetch only metadata, in batches of three. Never fetch PNGs or create blobs. */
export async function loadBookIllustrationStatuses(
  api:string,token:string,bookId:string,count:number,signal:AbortSignal,
  fetcher:typeof fetch=fetch
):Promise<PageIllustrationStatus[]>{
  if(!Number.isInteger(count)||count<1||count>20)throw new Error("Invalid page count");
  const statuses:PageIllustrationStatus[]=[];
  for(let start=1;start<=count;start+=3){
    if(signal.aborted)throw new DOMException("Aborted","AbortError");
    const batch=await Promise.all(Array.from({length:Math.min(3,count-start+1)},(_,i)=>
      lookupPrivateIllustrationStatus(api,token,bookId,start+i,signal,fetcher)
        .catch(error=>{if(signal.aborted)throw error;return "error" as const;})
    ));
    statuses.push(...batch);
  }
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  return statuses;
}

export async function loadPrivatePageIllustration(
  api:string,token:string,bookId:string,pageNumber:number,signal:AbortSignal,
  fetcher:typeof fetch=fetch
):Promise<PrivateIllustrationResult>{
  const metadata=await lookupMetadata(api,token,bookId,pageNumber,signal,fetcher);
  if(!metadata||"status" in metadata)return metadata;
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  const {personal,expiresAt}=metadata;
  const options={headers:{Authorization:"Bearer "+token},cache:"no-store" as RequestCache,redirect:"error" as RequestRedirect,credentials:"omit" as RequestCredentials,signal};
  const response=await fetcher(api+(personal?"/api/photos/character-pages/":"/api/illustrations/media/")+metadata.jobId,options);
  if(response.status===404)return null;
  if(!response.ok)throw new Error("Private illustration unavailable");
  if(!response.headers.get("content-type")?.toLowerCase().startsWith("image/png"))
    throw new Error("Unexpected illustration type");
  const file=await response.blob();
  if(file.size<45||file.size>3_000_000||file.type!=="image/png")
    throw new Error("Invalid illustration payload");
  // Content-Type is untrusted. Require an actual PNG signature and IHDR before
  // creating an object URL, even if a proxy has mislabeled HTML as image/png.
  const header=new Uint8Array(await file.slice(0,24).arrayBuffer());
  const signature=[137,80,78,71,13,10,26,10];
  if(!signature.every((value,index)=>header[index]===value)||
     header[12]!==73||header[13]!==72||header[14]!==68||header[15]!==82)
    throw new Error("Invalid PNG signature");
  const width=new DataView(header.buffer).getUint32(16,false);
  const height=new DataView(header.buffer).getUint32(20,false);
  if(width<1||height<1||width>2048||height>2048)
    throw new Error("Invalid illustration dimensions");
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  if(expiresAt!==undefined&&expiresAt<=Date.now())return null;
  const url=URL.createObjectURL(file);
  if(signal.aborted){URL.revokeObjectURL(url);throw new DOMException("Aborted","AbortError");}
  return expiresAt===undefined?{blobUrl:url}:{blobUrl:url,expiresAt};
}
