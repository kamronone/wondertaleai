import {useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent,type TouchEvent as ReactTouchEvent} from "react";
import {CheckCircle2} from "lucide-react";
import type {Lang} from "./i18n";
import {storyGiftForPage,type Point} from "./scene_gift_data";

/** Drag an illustrated story object to a character. No network or page navigation. */
export function StoryGiftInteraction({classicId,page,lang}:{classicId:string|undefined;page:number;lang:Lang}){
  const scene=storyGiftForPage(classicId,page);
  const stage=useRef<HTMLDivElement|null>(null);
  const activePointer=useRef<number|null>(null);
  const activeTouch=useRef(false);
  const origin=useRef<{x:number;y:number;point:Point}|null>(null);
  const [point,setPoint]=useState<Point>(scene?.start??{x:.8,y:.8});
  const latest=useRef<Point>(scene?.start??{x:.8,y:.8});
  const [dragging,setDragging]=useState(false);
  const [delivered,setDelivered]=useState(false);

  useEffect(()=>{
    const next=storyGiftForPage(classicId,page);
    const reset=next?.start??{x:.8,y:.8};
    latest.current=reset;
    setPoint(reset);
    setDragging(false);
    setDelivered(false);
    activePointer.current=null;
    activeTouch.current=false;
    origin.current=null;
  },[classicId,page]);
  const move=(p:Point)=>{latest.current=p;setPoint(p);};
  const finish=()=>{
    if(!scene)return;
    activePointer.current=null;
    activeTouch.current=false;
    origin.current=null;
    setDragging(false);
    move(scene.target);
    setDelivered(true);
  };
  const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!scene||delivered||activePointer.current!==null)return;
    event.preventDefault();
    event.stopPropagation();
    activePointer.current=event.pointerId;
    origin.current={x:event.clientX,y:event.clientY,point:latest.current};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const drag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId||!origin.current||!stage.current)return;
    event.preventDefault();
    event.stopPropagation();
    const rect=stage.current.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    move({
      x:Math.max(.06,Math.min(.94,origin.current.point.x+(event.clientX-origin.current.x)/rect.width)),
      y:Math.max(.08,Math.min(.92,origin.current.point.y+(event.clientY-origin.current.y)/rect.height))
    });
  };
  const end=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId||!scene)return;
    event.preventDefault();
    event.stopPropagation();
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    activePointer.current=null;
    origin.current=null;
    setDragging(false);
    if(Math.hypot(latest.current.x-scene.target.x,latest.current.y-scene.target.y)<.18)finish();
    else move(scene.start);
  };
  const cancel=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId)return;
    event.stopPropagation();
    activePointer.current=null;
    origin.current=null;
    setDragging(false);
    if(scene)move(scene.start);
  };
  const guardTouch=(event:ReactTouchEvent<HTMLDivElement>)=>{
    if(event.type==="touchstart"&&event.target instanceof Element&&event.target.closest(".wt-gift-item"))activeTouch.current=true;
    if(!activeTouch.current)return;
    event.stopPropagation();
    if(event.type==="touchend"||event.type==="touchcancel")activeTouch.current=false;
  };
  const keyboard=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(!delivered&&(event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      event.stopPropagation();
      finish();
    }
  };
  useEffect(()=>()=>{activePointer.current=null;activeTouch.current=false;},[]);
  if(!scene)return null;
  return <div
    className={"wt-gift-play"+(delivered?" is-delivered":"")}
    ref={stage}
    aria-label={scene.instruction[lang]}
    onTouchStartCapture={guardTouch}
    onTouchMoveCapture={guardTouch}
    onTouchEndCapture={guardTouch}
    onTouchCancelCapture={guardTouch}>
    <div className="wt-gift-target" style={{left:(scene.target.x*100)+"%",top:(scene.target.y*100)+"%"}} aria-hidden="true">
      {delivered?<CheckCircle2 size={26}/>:<span className="wt-gift-target-ring"/>}
    </div>
    {!delivered&&<div className="wt-gift-guide" aria-hidden="true">
      <img src={scene.asset} alt="" draggable={false}/><small>{scene.instruction[lang]}</small>
    </div>}
    <div
      className={"wt-gift-item"+(dragging?" is-dragging":"")}
      style={{left:(point.x*100)+"%",top:(point.y*100)+"%"}}
      role="button"
      tabIndex={delivered?-1:0}
      aria-label={scene.instruction[lang]}
      title={scene.name[lang]}
      aria-disabled={delivered}
      onPointerDown={down}
      onPointerMove={drag}
      onPointerUp={end}
      onPointerCancel={cancel}
      onClick={event=>{event.preventDefault();event.stopPropagation();}}
      onKeyDown={keyboard}>
      <img src={scene.asset} alt="" draggable={false}/>
    </div>
    {delivered&&<div className="wt-gift-speech" role="status" aria-live="polite">
      <span aria-hidden="true"><CheckCircle2 size={19}/></span>{scene.reply[lang]}
    </div>}
  </div>;
}
