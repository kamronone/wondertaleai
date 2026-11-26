/** Parent-only photo permission transport. Never persists session or photo bytes. */
export const LOCAL_PHOTO_POLICY="photo-reference-v1" as const;
export const EXTERNAL_PHOTO_POLICY="photo-external-ai-v1" as const;

export type PhotoConsent={
  agreed:boolean;
  policy_version:string;
  photo_upload_enabled?:boolean;
  external_photo_processing_enabled?:boolean;
};

type PhotoConsentKind="local"|"external";
const endpoints={
  local:"/api/photos/consent",
  external:"/api/photos/external-transfer-consent"
} as const;

function parseResponse(raw:unknown,kind:PhotoConsentKind):PhotoConsent {
  if(raw===null||typeof raw!=="object")throw new Error("Invalid photo consent");
  const value=raw as Record<string,unknown>;
  const version=kind==="local"?LOCAL_PHOTO_POLICY:EXTERNAL_PHOTO_POLICY;
  if(typeof value.agreed!=="boolean"||value.policy_version!==version)
    throw new Error("Unexpected photo consent policy");
  const flag=kind==="local"?"photo_upload_enabled":"external_photo_processing_enabled";
  if(typeof value[flag]!=="boolean")throw new Error("Missing photo capability flag");
  return {
    agreed:value.agreed,
    policy_version:version,
    [flag]:value[flag]
  };
}

function assertApi(api:string,session:string){
  if((!api.startsWith("https://")&&!api.startsWith("http://localhost:"))||!session)
    throw new Error("Private account API is unavailable");
}

export async function getPhotoConsent(api:string,session:string,
    kind:PhotoConsentKind,signal?:AbortSignal):Promise<PhotoConsent>{
  assertApi(api,session);
  const res=await fetch(api+endpoints[kind],{
    headers:{Authorization:"Bearer "+session},cache:"no-store",signal
  });
  if(!res.ok)throw new Error("Photo consent fetch failed");
  return parseResponse(await res.json(),kind);
}

export async function setPhotoConsent(api:string,session:string,
    kind:PhotoConsentKind,agreed:boolean,signal?:AbortSignal):Promise<PhotoConsent>{
  assertApi(api,session);
  const version=kind==="local"?LOCAL_PHOTO_POLICY:EXTERNAL_PHOTO_POLICY;
  const payload=kind==="external"
    ?{agreed,policy_version:version,acknowledged_provider_transfer:agreed}
    :{agreed,policy_version:version};
  const res=await fetch(api+endpoints[kind],{
    method:"POST",headers:{Authorization:"Bearer "+session,
      "Content-Type":"application/json"},
    cache:"no-store",signal,body:JSON.stringify(payload)
  });
  if(!res.ok)throw new Error("Photo consent update failed");
  const result=parseResponse(await res.json(),kind);
  if(result.agreed!==agreed)throw new Error("Photo consent mismatch");
  return result;
}
