import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from "react";
import {CheckCircle2} from "lucide-react";
import type {Lang} from "./i18n";

type Point={x:number;y:number};
const start:Point={x:.80,y:.78};
const target:Point={x:.37,y:.54};
const tr=(ru:string,uz:string,en:string)=>({ru,uz,en});

export function BrickPassInteraction({lang}:{lang:Lang}){
  const layer=useRef<HTMLDivElement|null>(null);
  const [point,setPoint]=useState<Point>(start);
  const [dragging,setDragging]=useState(false);
  const [delivered,setDelivered]=useState(false);
  const activePointer=useRef<number|null>(null);
  const initial=useRef<{screenX:number;screenY:number;point:Point}|null>(null);
  const latest=useRef<Point>(start);

  const move=(next:Point)=>{
    latest.current=next;
    setPoint(next);
  };
  const complete=()=>{
    activePointer.current=null;
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
    event.stopPropagation();
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    activePointer.current=null;
    initial.current=null;
    setDragging(false);
    const distance=Math.hypot(latest.current.x-target.x,latest.current.y-target.y);
    if(distance<.17){complete();}else{move(start);}
  };
  const onKeyDown=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(!delivered&&(event.key==="Enter"||event.key===" ")){
      event.preventDefault();
      complete();
    }
  };
  useEffect(()=>()=>{activePointer.current=null;},[]);
  const label=tr("Перетащи кирпич к поросёнку","G‘ishtni cho‘chqachaga olib boring","Drag the brick to the pig")[lang];
  const success=tr("Кирпич передан! Поросёнок продолжает строить крепкий дом.","G‘isht yetkazildi! Cho‘chqacha mustahkam uy qurishda davom etmoqda.","Brick delivered! The little pig keeps building a strong house.")[lang];
  return <div className={"wt-brick-play"+(delivered?" is-delivered":"")} ref={layer} aria-label={label}>
    <div className="wt-brick-target" style={{left:(target.x*100)+"%",top:(target.y*100)+"%"}} aria-hidden="true">
      {delivered?<CheckCircle2 size={26}/>:<span className="wt-brick-target-ring"/>}
    </div>
    {!delivered&&<div className="wt-brick-guide" aria-hidden="true"><span>🧱</span><span>➜</span><span>🐷</span></div>}
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
      onPointerCancel={event=>{if(activePointer.current===event.pointerId){activePointer.current=null;initial.current=null;setDragging(false);move(start);}}}
      onKeyDown={onKeyDown}>
      <span aria-hidden="true">🧱</span>
    </div>
    {delivered&&<div className="wt-brick-success" role="status" aria-live="polite"><CheckCircle2 size={17} aria-hidden="true"/>{success}</div>}
  </div>;
}
