/** Explicit parent-only consent transport; session never persisted here. */
export const ILLUSTRATION_POLICY_VERSION="illustration-pilot-v1" as const;
export type IllustrationConsent={agreed:boolean;policy_version:string};

function parseConsent(raw:unknown):IllustrationConsent{
  if(!raw||typeof raw!=="object")throw new Error("Invalid illustration consent response");
  const data=raw as Record<string,unknown>;
  if(typeof data.agreed!=="boolean"||typeof data.policy_version!=="string"||
     data.policy_version!==ILLUSTRATION_POLICY_VERSION)
    throw new Error("Unsupported illustration consent policy");
  return {agreed:data.agreed,policy_version:data.policy_version};
}

export async function fetchIllustrationConsent(api:string,token:string,signal?:AbortSignal):Promise<IllustrationConsent>{
  const response=await fetch(api+"/api/illustrations/consent",{
    headers:{Authorization:"Bearer "+token},cache:"no-store",signal
  });
  if(!response.ok)throw new Error("Could not load illustration consent");
  return parseConsent(await response.json());
}

export async function updateIllustrationConsent(
  api:string,token:string,agreed:boolean,signal?:AbortSignal
):Promise<IllustrationConsent>{
  const response=await fetch(api+"/api/illustrations/consent",{
    method:"POST",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    cache:"no-store",
    signal,
    body:JSON.stringify({agreed,policy_version:ILLUSTRATION_POLICY_VERSION})
  });
  if(!response.ok)throw new Error("Could not update illustration consent");
  const updated=parseConsent(await response.json());
  if(updated.agreed!==agreed)throw new Error("Consent confirmation mismatch");
  return updated;
}
