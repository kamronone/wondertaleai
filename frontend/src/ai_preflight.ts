/** Read-only AI availability check. Never sends a child's name or story idea. */
export type AiPreflightResult="ready"|"login"|"unavailable"|"not-allowed"|"limit";
type BillingStatus={ai_pilot_access?:unknown;ai_remaining_today?:unknown};
export async function checkAiStoryAccess(
  api:string,token:string,
  fetcher:typeof fetch=fetch
):Promise<AiPreflightResult>{
  if(!api||!token)return "login";
  try{
    const response=await fetcher(api+"/api/billing/status",{
      method:"GET",
      headers:{"Authorization":"Bearer "+token},
      cache:"no-store",
      signal:AbortSignal.timeout(12000),
    });
    if(response.status===401||response.status===403)return "login";
    if(!response.ok)return "unavailable";
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object")return "unavailable";
    const status=raw as BillingStatus;
    if(typeof status.ai_pilot_access!=="boolean")return "unavailable";
    if(status.ai_pilot_access===false)return "not-allowed";
    if(typeof status.ai_remaining_today!=="number"||
       !Number.isFinite(status.ai_remaining_today)||
       status.ai_remaining_today<0)return "unavailable";
    return status.ai_remaining_today===0?"limit":"ready";
  }catch{return "unavailable";}
}
