import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {ZoomIn,ZoomOut,X} from "lucide-react";
import {loadPrivatePageIllustration} from "./private_illustration";
import {readerZoomLabels} from "./reader_zoom_labels";
import {clampReaderZoom,readerFingerDistance} from "./reader_zoom_gestures";

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
  const [zoomPan,setZoomPan]=useState({x:0,y:0});
  const pinch=useRef<{distance:number;scale:number}|null>(null);
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const lastSingleTap=useRef(0);
  const usedPinch=useRef(false);
  const startZoomTouch=(event:import("react").TouchEvent<HTMLDivElement>)=>{
    event.stopPropagation();
    if(event.touches.length===2){
      pinch.current={distance:readerFingerDistance(event.touches[0],event.touches[1]),scale:zoomScale};
     usedPinch.current=true;
      drag.current=null;
    }else if(event.touches.length===1){
      drag.current={x:event.touches[0].clientX,y:event.touches[0].clientY,panX:zoomPan.x,panY:zoomPan.y};
    }
  };
  const moveZoomTouch=(event:import("react").TouchEvent<HTMLDivElement>)=>{
    event.stopPropagation();
    if(event.touches.length===2&&pinch.current?.distance){
      setZoomScale(clampReaderZoom(pinch.current.scale*readerFingerDistance(event.touches[0],event.touches[1])/pinch.current.distance));
    }else if(event.touches.length===1&&drag.current&&zoomScale>1){
      const limitX=(window.innerWidth*(zoomScale-1))/2;
      const limitY=(window.innerHeight*(zoomScale-1))/2;
      setZoomPan({
        x:Math.max(-limitX,Math.min(limitX,drag.current.panX+event.touches[0].clientX-drag.current.x)),
        y:Math.max(-limitY,Math.min(limitY,drag.current.panY+event.touches[0].clientY-drag.current.y))
      });
    }
  };
 const endZoomTouch=(event:import("react").TouchEvent<HTMLDivElement>)=>{
   event.stopPropagation();
   if(event.touches.length===0){
     if(!usedPinch.current && drag.current && event.changedTouches.length===1){
       const finger=event.changedTouches[0];
       const movement=Math.hypot(finger.clientX-drag.current.x,finger.clientY-drag.current.y);
       if(movement<12){
         const now=Date.now();
         if(now-lastSingleTap.current<325){
           toggleDoubleTapZoom();
           lastSingleTap.current=0;
         }else lastSingleTap.current=now;
       }
     }
     usedPinch.current=false;
     pinch.current=null;
     drag.current=null;
     if(zoomScale<=1)setZoomPan({x:0,y:0});
   }else if(event.touches.length<2)pinch.current=null;
 };
  const toggleDoubleTapZoom=()=>{setZoomScale(current=>current>1?1:2);setZoomPan({x:0,y:0});};
  const openRef=useRef<HTMLButtonElement|null>(null);
  const closeRef=useRef<HTMLButtonElement|null>(null);
  const key=[api,session,bookId,pageNumber].join("|");
  useEffect(()=>{
    setZoomOpen(false);
    setZoomScale(1);
    setZoomPan({x:0,y:0});
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
      <button type="button" className="wt-reader-image-open" ref={openRef} onClick={()=>{setZoomScale(1);setZoomPan({x:0,y:0});setZoomOpen(true);}} aria-label={zoomCopy.open+": "+alt}>
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
          <div className="wt-reader-image-lightbox-scroll" onClick={event=>event.stopPropagation()} onTouchStart={startZoomTouch} onTouchMove={moveZoomTouch} onTouchEnd={endZoomTouch} onTouchCancel={endZoomTouch} onDoubleClick={toggleDoubleTapZoom}>
            <img src={image.blobUrl} alt={alt} className="wt-reader-image-lightbox-img" style={{transform:"translate("+zoomPan.x+"px,"+zoomPan.y+"px) scale("+zoomScale+")"}}
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
