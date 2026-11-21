import {useEffect,useState,type ReactNode} from "react";
import {loadPrivatePageIllustration} from "./private_illustration";

/** Load the visible private illustration into a short-lived blob URL.
 * The image stays inside the reader and does not open a fullscreen viewer. */
export function PrivateReaderIllustration({api,session,bookId,pageNumber,alt,fallback}:{
  api:string;
  session:string|null;
  bookId:string;
  pageNumber:number;
  alt:string;
  fallback:ReactNode;
}){
  const [image,setImage]=useState<{blobUrl:string;key:string}|null>(null);
  const key=[api,session,bookId,pageNumber].join("|");
  useEffect(()=>{
    const controller=new AbortController();
    let currentUrl:string|null=null;
    setImage(null);
    if(api&&session){
      void loadPrivatePageIllustration(api,session,bookId,pageNumber,controller.signal)
        .then(result=>{
          if(result){
            currentUrl=result.blobUrl;
            if(controller.signal.aborted){
              URL.revokeObjectURL(result.blobUrl);
              currentUrl=null;
            }else setImage({blobUrl:result.blobUrl,key});
          }
        })
        .catch(()=>{/* An unavailable illustration must not block reading. */});
    }
    return ()=>{
      controller.abort();
      if(currentUrl)URL.revokeObjectURL(currentUrl);
    };
  },[api,session,bookId,pageNumber,key]);
  return image?.key===key
    ?<img src={image.blobUrl} alt={alt} decoding="async" className="private-reader-illustration wt-reader-picture"
      onError={()=>setImage(null)}/>
    :<>{fallback}</>;
}
