import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type TouchEvent as ReactTouchEvent,type KeyboardEvent as ReactKeyboardEvent} from "react";
import {CheckCircle2} from "lucide-react";
import type {Lang} from "./i18n";

type Point={x:number;y:number};
const start:Point={x:.80,y:.78};
const target:Point={x:.37,y:.54};
const brickImage="/images/story-brick.svg";
const tr=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});

/** Local interaction only: no book mutations, timers, page navigation or uploads. */
export function BrickPassInteraction({lang}:{lang:Lang}){
  const layer=useRef<HTMLDivElement|null>(null);
  const [point,setPoint]=useState<Point>(start);
  const [dragging,setDragging]=useState(false);
  const [delivered,setDelivered]=useState(false);
  const activePointer=useRef<number|null>(null);
  const activeTouch=useRef(false);
  const initial=useRef<{screenX:number;screenY:number;point:Point}|null>(null);
  const latest=useRef<Point>(start);

  const move=(next:Point)=>{latest.current=next;setPoint(next);};
  const complete=()=>{
    activePointer.current=null;
    activeTouch.current=false;
    initial.current=null;
    setDragging(false);
    move(target);
    setDelivered(true);
  };
  const onDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(delivered||activePointer.current!==null)return;
    event.preventDefault();
    event.stopPropagation();
    activePointer.current=event.pointerId;
    initial.current={screenX:event.clientX,screenY:event.clientY,point:latest.current};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId||!initial.current||!layer.current)return;
    event.preventDefault();
    event.stopPropagation();
    const rect=layer.current.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    const dx=(event.clientX-initial.current.screenX)/rect.width;
    const dy=(event.clientY-initial.current.screenY)/rect.height;
    move({
      x:Math.min(.94,Math.max(.06,initial.current.point.x+dx)),
      y:Math.min(.92,Math.max(.08,initial.current.point.y+dy))
    });
  };
  const onUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId)return;
    event.preventDefault();
    event.stopPropagation();
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    activePointer.current=null;
    initial.current=null;
    setDragging(false);
    const distance=Math.hypot(latest.current.x-target.x,latest.current.y-target.y);
    if(distance<.17){complete();}else{move(start);}
  };
  const onCancel=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(activePointer.current!==event.pointerId)return;
    event.stopPropagation();
    activePointer.current=null;
    initial.current=null;
    setDragging(false);
    move(start);
  };
  /* Safari sends touchend to the reader even after pointer capture. Shield every
     touch originating on the brick, so it cannot be interpreted as page swipe. */
  const onTouchCapture=(event:ReactTouchEvent<HTMLDivElement>)=>{
    if(event.type==="touchstart"&&event.target instanceof Element&&event.target.closest(".wt-brick-item"))activeTouch.current=true;
    if(!activeTouch.current)return;
    event.stopPropagation();
    if(event.type==="touchend"||event.type==="touchcancel")activeTouch.current=false;
  };
  const onKeyDown=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(!delivered&&(event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      event.stopPropagation();
      complete();
    }
  };
  useEffect(()=>()=>{activePointer.current=null;activeTouch.current=false;},[]);
  const label=tr("Передай кирпич поросёнку","G‘ishtni cho‘chqachaga uzating","Give the brick to the pig")[lang];
  const success=tr("Спасибо! Теперь наш дом будет ещё крепче!","Rahmat! Endi uyimiz yanada mustahkam bo‘ladi!","Thank you! Now our house will be even stronger!")[lang];
  return <div
    className={"wt-brick-play"+(delivered?" is-delivered":"")}
    ref={layer}
    aria-label={label}
    onTouchStartCapture={onTouchCapture}
    onTouchMoveCapture={onTouchCapture}
    onTouchEndCapture={onTouchCapture}
    onTouchCancelCapture={onTouchCapture}>
    <div className="wt-brick-target" style={{left:(target.x*100)+"%",top:(target.y*100)+"%"}} aria-hidden="true">
      {delivered?<CheckCircle2 size={26}/>:<span className="wt-brick-target-ring"/>}
    </div>
    {!delivered&&<div className="wt-brick-guide" aria-hidden="true">
      <img src={brickImage} alt="" draggable={false}/><span>➜</span><span>🐷</span><small>{label}</small>
    </div>}
    <div
      className={"wt-brick-item"+(dragging?" is-dragging":"")}
      style={{left:(point.x*100)+"%",top:(point.y*100)+"%"}}
      role="button"
      tabIndex={delivered?-1:0}
      aria-label={label}
      aria-disabled={delivered}
      title={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onClick={event=>{event.preventDefault();event.stopPropagation();}}
      onKeyDown={onKeyDown}>
      <img src={brickImage} alt="" className="wt-brick-image" draggable={false}/>
    </div>
    {delivered&&<div className="wt-brick-speech" role="status" aria-live="polite">
      <span className="wt-brick-speech-pig" aria-hidden="true">🐷</span>
      <span>{success}</span>
    </div>}
  </div>;
}
