import {useEffect,useRef,useState} from "react";
import {Sparkles} from "lucide-react";
import type {Lang} from "./i18n";

type Position={x:number;y:number};
type Reaction={label:Record<Lang,string>;message:Record<Lang,string>;position:Position};
const words=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});

/* Coordinates are fractions of the visible artwork, not the padded card.
   Never use a hotspot on a private photo or generated user illustration. */
const reactions:Record<string,Reaction>={
  "three-pigs:4": {
    position:{x:.37,y:.54},
    label:words("Помочь поросёнку","Cho'chqachaga yordam berish","Help the little pig"),
    message:words("Поросёнок с улыбкой кладёт ещё один кирпич!","Cho'chqacha jilmayib yana bitta g'isht qo'ydi!","The little pig smiles and places another brick!")
  },
  "three-pigs:7": {
    position:{x:.30,y:.50},
    label:words("Поговорить с волком","Bo'ri bilan gaplashish","Talk to the wolf"),
    message:words("Волк перестал дуть и прислушался к друзьям.","Bo'ri puflashdan to'xtadi va do'stlarni tingladi.","The wolf stopped blowing and listened to the friends.")
  },
  "cinderella:5": {
    position:{x:.51,y:.52},
    label:words("Поддержать Золушку","Zolushkani qo'llab-quvvatlash","Encourage Cinderella"),
    message:words("Золушка улыбнулась и уверенно продолжила танец.","Zolushka jilmayib, raqsni dadil davom ettirdi.","Cinderella smiled and kept dancing with confidence.")
  },
  "red-hood:1": {
    position:{x:.55,y:.57},
    label:words("Помахать Красной Шапочке","Qizil qalpoqchaga qo'l silkitish","Wave to Little Red Riding Hood"),
    message:words("Красная Шапочка весело машет рукой в ответ!","Qizil qalpoqcha quvonch bilan javoban qo'l silkitdi!","Little Red Riding Hood happily waves back!")
  }
};

export function characterHotspotForPage(classicId:string|undefined,page:number):Reaction|null{
  if(!classicId||!Number.isInteger(page)||page<1||page>8)return null;
  return reactions[`${classicId}:${page}`]??null;
}

function imagePoint(container:HTMLElement,position:Position):{left:number;top:number}|null{
  const button=container.querySelector<HTMLButtonElement>(".wt-reader-image-open");
  const image=button?.querySelector<HTMLImageElement>("img");
  if(!button||!image?.naturalWidth||!image.naturalHeight)return null;
  const width=button.clientWidth,height=button.clientHeight;
  if(width<=0||height<=0)return null;
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const drawnW=image.naturalWidth*scale,drawnH=image.naturalHeight*scale;
  const containerRect=container.getBoundingClientRect(),buttonRect=button.getBoundingClientRect();
  return {
    left:buttonRect.left-containerRect.left+(width-drawnW)/2+drawnW*position.x,
    top:buttonRect.top-containerRect.top+(height-drawnH)/2+drawnH*position.y
  };
}

/** Placed on the actual rendered image, leaving the rest of the picture tap-to-zoom.
 * Reaction text is local only: no network calls, analytics, child records or speech.
 */
export function CharacterHotspot({classicId,page,lang,enabled=true}:{classicId:string|undefined;page:number;lang:Lang;enabled?:boolean}){
  const reaction=characterHotspotForPage(classicId,page);
  const ref=useRef<HTMLDivElement|null>(null);
  const [point,setPoint]=useState<{left:number;top:number}|null>(null);
  const [visibleReaction,setVisibleReaction]=useState(false);
  useEffect(()=>{setVisibleReaction(false);setPoint(null);},[classicId,page]);
  useEffect(()=>{
    if(!reaction||!enabled)return;
    const stage=ref.current?.parentElement;
    if(!stage)return;
    const update=()=>setPoint(imagePoint(stage,reaction.position));
    const picture=stage.querySelector<HTMLImageElement>(".wt-reader-image-open img");
    picture?.addEventListener("load",update);
    window.addEventListener("resize",update);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    observer?.observe(stage);
    update();
    return ()=>{
      picture?.removeEventListener("load",update);
      window.removeEventListener("resize",update);
      observer?.disconnect();
    };
  },[classicId,page,enabled,reaction]);
  if(!reaction||!enabled)return null;
  return <div className="wt-character-hotspot-layer" ref={ref}>
    {point&&<button
      type="button"
      className="wt-character-hotspot"
      style={{left:point.left,top:point.top}}
      aria-label={reaction.label[lang]}
      title={reaction.label[lang]}
      onTouchStart={event=>event.stopPropagation()}
      onTouchMove={event=>event.stopPropagation()}
      onTouchEnd={event=>event.stopPropagation()}
      onClick={event=>{event.stopPropagation();setVisibleReaction(value=>!value);}}>
      <Sparkles size={18} aria-hidden="true"/>
    </button>}
    {visibleReaction&&point&&<div className="wt-character-reaction" role="status" aria-live="polite">
      {reaction.message[lang]}
    </div>}
  </div>;
}
