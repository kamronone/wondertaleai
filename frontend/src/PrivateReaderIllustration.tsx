import {useEffect,useState,type ReactNode} from "react";
import {loadPrivatePageIllustration} from "./private_illustration";
import type {Lang} from "./i18n";

type IllustrationState="loading"|"available"|"missing"|"error"|"pending_review"|"needs_review";
const copy={
  ru:{missing:"Иллюстрация ещё не создана",error:"Не удалось проверить иллюстрацию",
      pending_review:"Ожидает проверки",needs_review:"Требуется проверка результата",
      retry:"Проверить снова",detail:"Текст сказки доступен без изображения."},
  uz:{missing:"Rasm hali yaratilmagan",error:"Rasmni tekshirib bo'lmadi",
      pending_review:"Tekşiruv kutilmoqda",needs_review:"Natijani tekşiriş kerak",
      retry:"Qayta tekshiriş",detail:"Ertak matnini rasmsiz ham öqiş mumkin."},
  en:{missing:"Illustration not generated yet",error:"Could not check illustration",
      pending_review:"Awaiting review",needs_review:"Result requires review",
      retry:"Check again",detail:"You can still read the story without an image."}
} as const;

/** Private PNGs are owner-authenticated and shown only as short-lived blob URLs.
 * An absent private illustration must NEVER silently masquerade as generic SVG.
 * Legacy demo/classics keep their own intentional fallback in the parent. */
export function PrivateReaderIllustration({api,session,bookId,pageNumber,alt,lang,fallback}:{
  api:string;
  session:string|null;
  bookId:string;
  pageNumber:number;
  alt:string;
  lang:Lang;
  fallback?:ReactNode;
}){
  const [image,setImage]=useState<{blobUrl:string;key:string}|null>(null);
  const [status,setStatus]=useState<IllustrationState>("loading");
  const [refresh,setRefresh]=useState(0);
  const key=[api,session,bookId,pageNumber].join("|");
  useEffect(()=>{
    const controller=new AbortController();
    let currentUrl:string|null=null;
    let expiresAt:number|undefined;
    let expiryTimer:number|undefined;
    const clearImage=()=>{
      if(currentUrl)URL.revokeObjectURL(currentUrl);
      currentUrl=null;
      setImage(null);
      setStatus("missing");
    };
    const onVisibility=()=>{
      if(expiresAt!==undefined&&expiresAt<=Date.now())clearImage();
      else if(expiresAt!==undefined&&document.visibilityState==="visible")setRefresh(v=>v+1);
    };
    setImage(null);
    setStatus("loading");
    if(!api||!session){
      setStatus("error");
      return ()=>controller.abort();
    }
    void loadPrivatePageIllustration(api,session,bookId,pageNumber,controller.signal)
      .then(result=>{
        if(controller.signal.aborted){
          if(result&&"blobUrl" in result)URL.revokeObjectURL(result.blobUrl);
          return;
        }
        if(!result){
          setStatus("missing");
          return;
        }
        if("status" in result){setStatus(result.status);return;}
        currentUrl=result.blobUrl;
        expiresAt=result.expiresAt;
        if(expiresAt!==undefined){
          if(expiresAt<=Date.now()){clearImage();return;}
          expiryTimer=window.setTimeout(clearImage,Math.max(0,expiresAt-Date.now()));
          document.addEventListener("visibilitychange",onVisibility);
        }
        if(controller.signal.aborted){
          URL.revokeObjectURL(result.blobUrl);
          currentUrl=null;
        }else{
          setImage({blobUrl:result.blobUrl,key});
          setStatus("available");
        }
      })
      .catch(()=>{
        if(!controller.signal.aborted)setStatus("error");
      });
    return ()=>{
      controller.abort();
      if(expiryTimer!==undefined)window.clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange",onVisibility);
      if(currentUrl)URL.revokeObjectURL(currentUrl);
    };
  },[api,session,bookId,pageNumber,key,refresh]);
  if(image?.key===key&&status==="available"){
    return <img src={image.blobUrl} alt={alt} decoding="async" className="private-reader-illustration wt-reader-picture"
      onError={()=>{
        URL.revokeObjectURL(image.blobUrl);
        setImage(null);
        setStatus("error");
      }}/>;
  }
  if(status==="loading"){
    return <div className="private-illustration-placeholder" role="status" aria-live="polite">
      <span className="private-illustration-placeholder-art" aria-hidden="true">✦</span>
      <span>{({ru:"Проверяем иллюстрацию…",uz:"Rasm tekşirilmoqda…",en:"Checking illustration…"} as const)[lang]}</span>
    </div>;
  }
  if(status==="missing"||status==="error"||status==="pending_review"||status==="needs_review"){
    const t=copy[lang];
    return <div className="private-illustration-placeholder" role="status" aria-live="polite">
      <span className="private-illustration-placeholder-art" aria-hidden="true">✦</span>
      <strong>{t[status]}</strong>
      <span>{t.detail}</span>
      <button type="button" className="private-illustration-retry" onClick={()=>setRefresh(v=>v+1)}>{t.retry}</button>
    </div>;
  }
  return <>{fallback??null}</>;
}
