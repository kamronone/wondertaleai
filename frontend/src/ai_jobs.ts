/** Private AI queue transport. No token, prompt or child details are persisted. */
export type AiJobStatus="queued"|"processing"|"completed"|"failed"|"needs_review"|"unavailable";
export type AiJob={id:string;status:AiJobStatus;book_id:string|null};
export type AiQueueFailure="login"|"not-allowed"|"limit"|"library-full"|"unavailable"|"invalid-response";
export class AiQueueError extends Error{
  constructor(public readonly reason:AiQueueFailure){
    super("AI queue: "+reason);
    this.name="AiQueueError";
  }
}
const STATUSES=new Set<AiJobStatus>(["queued","processing","completed","failed","needs_review","unavailable"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAiJob(value:unknown):AiJob {
  if(!value||typeof value!=="object")throw new Error("Invalid AI job");
  const item=value as Record<string,unknown>;
  if(typeof item.id!=="string"||!UUID.test(item.id)||
    typeof item.status!=="string"||!STATUSES.has(item.status as AiJobStatus)||
    (item.book_id!==null&&(typeof item.book_id!=="string"||!UUID.test(item.book_id)))||
    (item.status==="completed"&&item.book_id===null))throw new Error("Invalid AI job");
  return {id:item.id,status:item.status as AiJobStatus,book_id:item.book_id as string|null};
}

export async function listAiJobs(api:string,token:string,signal?:AbortSignal):Promise<AiJob[]> {
  const response=await fetch(api+"/api/ai/jobs",{
    headers:{Authorization:"Bearer "+token},cache:"no-store",signal
  });
  if(!response.ok)throw new Error("AI job list unavailable");
  const raw:unknown=await response.json();
  if(!Array.isArray(raw)||raw.length>20)throw new Error("Invalid AI job list");
  return raw.map(parseAiJob);
}

export async function cancelAiJob(api:string,token:string,id:string,signal?:AbortSignal):Promise<void>{
  if(!UUID.test(id))throw new Error("Invalid AI job ID");
  const response=await fetch(api+"/api/books/jobs/"+id,{
    method:"DELETE",headers:{Authorization:"Bearer "+token},cache:"no-store",signal
  });
  if(response.status!==204)throw new Error("Only queued jobs can be canceled");
}

export async function enqueueAiJob(
  api:string,token:string,data:unknown,key:string,signal?:AbortSignal
):Promise<AiJob>{
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new Error("Invalid AI request key");
  const response=await fetch(api+"/api/books/jobs",{
    method:"POST",headers:{
      Authorization:"Bearer "+token,"Content-Type":"application/json","Idempotency-Key":key
    },cache:"no-store",body:JSON.stringify(data),signal
  });
  if(response.status!==202){
    if(response.status===401)throw new AiQueueError("login");
    if(response.status===403)throw new AiQueueError("not-allowed");
    if(response.status===429)throw new AiQueueError("limit");
    if(response.status===409)throw new AiQueueError("library-full");
    if(response.status===503||response.status===502||response.status>=500)throw new AiQueueError("unavailable");
    throw new AiQueueError("invalid-response");
  }
  try{
    return parseAiJob(await response.json());
  }catch{
    // The server may already have committed this request even if the reply
    // is corrupted. Callers must preserve their idempotency key.
    throw new AiQueueError("invalid-response");
  }
}
