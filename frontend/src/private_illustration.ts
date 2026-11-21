/** Owner-scoped image transport. Never put bearer tokens in img src URLs. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PrivateIllustrationResult={blobUrl:string}|null;

export async function loadPrivatePageIllustration(
  api:string,token:string,bookId:string,pageNumber:number,signal:AbortSignal,
  fetcher:typeof fetch=fetch
):Promise<PrivateIllustrationResult>{
  if(!api.startsWith("https://")&&!api.startsWith("http://localhost:"))
    throw new Error("Invalid private illustration API origin");
  if(!token||!UUID.test(bookId)||!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>20)
    throw new Error("Invalid private illustration request");
  const options={headers:{Authorization:"Bearer "+token},cache:"no-store" as RequestCache,signal};
  const metadata=await fetcher(api+"/api/illustrations/books/"+bookId+"/pages/"+pageNumber,options);
  if(metadata.status===404)return null;
  if(!metadata.ok)throw new Error("Illustration lookup unavailable");
  const raw:unknown=await metadata.json();
  if(!raw||typeof raw!=="object"||!("job_id" in raw)||
      typeof raw.job_id!=="string"||!UUID.test(raw.job_id))
    throw new Error("Invalid private illustration metadata");
  const response=await fetcher(api+"/api/illustrations/media/"+raw.job_id,options);
  if(response.status===404)return null;
  if(!response.ok)throw new Error("Private illustration unavailable");
  if(!response.headers.get("content-type")?.toLowerCase().startsWith("image/png"))
    throw new Error("Unexpected illustration type");
  const file=await response.blob();
  if(file.size===0||file.size>3_000_000||file.type!=="image/png")
    throw new Error("Invalid illustration payload");
  if(signal.aborted)throw new DOMException("Aborted","AbortError");
  const url=URL.createObjectURL(file);
  if(signal.aborted){URL.revokeObjectURL(url);throw new DOMException("Aborted","AbortError");}
  return {blobUrl:url};
}
