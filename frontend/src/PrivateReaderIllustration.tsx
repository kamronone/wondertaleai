import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {ZoomIn,ZoomOut,X} from "lucide-react";
import {loadPrivatePageIllustration} from "./private_illustration";
import {readerZoomLabels} from "./reader_zoom_labels";

/** Fetch only the visible page; never leak private media in public image URLs. */
export function PrivateReaderIllustration({api,session,bookId,pageNumber,alt,fallback}:{
  api:string;
  session:string|null;
  bookId:string;
  pageNumber:number;
  alt:string;
  fallback:ReactNode;
}){
  const zoomCopy=readerZoomLabels(document.documentElement.lang);
  const [image,setImage]=useState<{blobUrl:string;key:string}|null>(null);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [zoomScale,setZoomScale]=useState(1);
  const openRef=useRef<HTMLButtonElement|null>(null);
  const closeRef=useRef<HTMLButtonElement|null>(null);
  const key=[api,session,bookId,pageNumber].join("|");
  useEffect(()=>{
    setZoomOpen(false);
    setZoomScale(1);
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
        .catch(()=>{/* An unavailable image must never block reading the story. */});
    }
    return ()=>{
      controller.abort();
      if(currentUrl)URL.revokeObjectURL(currentUrl);
    };
  },[api,session,bookId,pageNumber,key]);

  useEffect(()=>{
    if(!zoomOpen)return;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setZoomOpen(false);return;}
      if(event.key==="Tab"){
        const controls=[...document.querySelectorAll<HTMLButtonElement>(".wt-reader-image-lightbox button:not(:disabled)")];
        if(!controls.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",onKey);
    closeRef.current?.focus();
    return ()=>{
      document.body.style.overflow=oldOverflow;
      document.removeEventListener("keydown",onKey);
      openRef.current?.focus();
    };
  },[zoomOpen]);

  return image?.key===key
    ?<>
      <button type="button" className="wt-reader-image-open" ref={openRef} onClick={()=>{setZoomScale(1);setZoomOpen(true);}} aria-label={zoomCopy.open+": "+alt}>
        <img src={image.blobUrl} alt={alt} decoding="async" className="private-reader-illustration wt-reader-picture"
          onError={()=>{setZoomOpen(false);setImage(null);}}/>
        <span className="wt-reader-image-magnifier" aria-hidden="true"><ZoomIn size={17}/></span>
      </button>
      {zoomOpen&&createPortal(
        <div className="wt-reader-image-lightbox" role="dialog" aria-modal="true" aria-label={alt}
          onClick={event=>{event.stopPropagation();setZoomOpen(false);}}
          onTouchStart={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}>
          <div className="wt-reader-image-lightbox-toolbar">
            <button type="button" ref={closeRef} onClick={()=>setZoomOpen(false)} aria-label={zoomCopy.close}><X size={24}/></button>
          </div>
          <div className="wt-reader-image-lightbox-scroll" onClick={event=>event.stopPropagation()}>
            <img src={image.blobUrl} alt={alt} className="wt-reader-image-lightbox-img" style={{transform:"scale("+zoomScale+")"}}
              onError={()=>{setZoomOpen(false);setImage(null);}}/>
          </div>
          <div className="wt-reader-lightbox-zoom" onClick={event=>event.stopPropagation()}>
            <button type="button" onClick={()=>setZoomScale(value=>Math.max(1,Number((value-.25).toFixed(2))))} disabled={zoomScale<=1} aria-label={zoomCopy.decrease}><ZoomOut size={21}/></button>
            <span aria-live="polite">{Math.round(zoomScale*100)}%</span>
            <button type="button" onClick={()=>setZoomScale(value=>Math.min(3,Number((value+.25).toFixed(2))))} disabled={zoomScale>=3} aria-label={zoomCopy.increase}><ZoomIn size={21}/></button>
          </div>
        </div>,document.body
      )}
    </>
    :<>{fallback}</>;
}
