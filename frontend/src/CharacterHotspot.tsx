import {useEffect,useRef,useState} from "react";
import {Sparkles,Hand,Music2,Feather,Heart,Flower2,Sun,Footprints} from "lucide-react";
import type {Lang} from "./i18n";

type Position={x:number;y:number};
type ReactionMotion="wave"|"music"|"flutter"|"bow"|"dance"|"shine"|"bloom"|"cheer";
type Reaction={label:Record<Lang,string>;message:Record<Lang,string>;position:Position;motion:ReactionMotion};
const words=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});

/* Coordinates are fractions of the visible artwork, not the padded card.
   Never use a hotspot on a private photo or generated user illustration. */
const reactions:Record<string,Reaction>={
  "rapunzel:7": {
    motion:"bloom",
    position:{x:.40,y:.62},
    label:words("Поздороваться с Рапунцель","Rapunselga salom berish","Greet Rapunzel"),
    message:words("Рапунцель радуется встрече и приглашает друзей в гости!","Rapunsel do‘stlarini ko‘rib quvonadi va mehmonga taklif qiladi!","Rapunzel smiles and invites her friends to visit!")
  },
  "snow-white:2": {
    motion:"wave",
    position:{x:.48,y:.52},
    label:words("Помахать Белоснежке","Oppog‘oyga qo‘l silkitish","Wave to Snow White"),
    message:words("Белоснежка машет в ответ и улыбается!","Oppog‘oy javoban qo‘l silkitib jilmayadi!","Snow White waves back with a smile!")
  },
  "ugly-duckling:3": {
    motion:"flutter",
    position:{x:.49,y:.65},
    label:words("Подбодрить утёнка","O‘rdakchaga dalda berish","Cheer up the duckling"),
    message:words("Утёнок расправляет крылья и смелее идёт вперёд!","O‘rdakcha qanotlarini yozib, dadil oldinga yuradi!","The duckling spreads its wings and steps forward bravely!")
  },
  "bremen:2": {
    motion:"music",
    position:{x:.46,y:.55},
    label:words("Поддержать музыкантов","Musiqachilarni ruhlantirish","Encourage the musicians"),
    message:words("Друзья весело кивают и начинают репетировать!","Do‘stlar quvonib bosh irg‘aydi va mashqni boshlaydi!","The friends nod happily and begin rehearsing!")
  },
  "hansel-gretel:3": {
    motion:"cheer",
    position:{x:.47,y:.62},
    label:words("Подбодрить детей","Bolalarga dalda berish","Encourage the children"),
    message:words("Гензель и Гретель улыбаются и идут вместе дальше!","Genzel va Gretel jilmayib birga yo‘lda davom etadi!","Hansel and Gretel smile and continue together!")
  },
  "puss-boots:4": {
    motion:"bow",
    position:{x:.48,y:.56},
    label:words("Позвать Кота в сапогах","Etik kiygan mushukni chaqirish","Call Puss in Boots"),
    message:words("Кот учтиво кланяется и подмигивает тебе!","Mushuk xushmuomalalik bilan ta’zim qiladi va ko‘z qisadi!","Puss bows politely and gives you a wink!")
  },
  "sleeping-beauty:5": {
    motion:"shine",
    position:{x:.55,y:.56},
    label:words("Пожелать доброго утра","Xayrli tong tilash","Wish a good morning"),
    message:words("Во дворце становится светлее, а друзья радостно улыбаются!","Qasr yanada yorishadi, do‘stlar esa quvonib jilmayadi!","The castle grows brighter and everyone smiles!")
  },
  "three-pigs:4": {
    motion:"cheer",
    position:{x:.37,y:.54},
    label:words("Помочь поросёнку","Cho'chqachaga yordam berish","Help the little pig"),
    message:words("Поросёнок с улыбкой кладёт ещё один кирпич!","Cho'chqacha jilmayib yana bitta g'isht qo'ydi!","The little pig smiles and places another brick!")
  },
  "three-pigs:7": {
    motion:"wave",
    position:{x:.30,y:.50},
    label:words("Поговорить с волком","Bo'ri bilan gaplashish","Talk to the wolf"),
    message:words("Волк перестал дуть и прислушался к друзьям.","Bo'ri puflashdan to'xtadi va do'stlarni tingladi.","The wolf stopped blowing and listened to the friends.")
  },
  "cinderella:5": {
    motion:"dance",
    position:{x:.51,y:.52},
    label:words("Поддержать Золушку","Zolushkani qo'llab-quvvatlash","Encourage Cinderella"),
    message:words("Золушка улыбнулась и уверенно продолжила танец.","Zolushka jilmayib, raqsni dadil davom ettirdi.","Cinderella smiled and kept dancing with confidence.")
  },
  "red-hood:1": {
    motion:"wave",
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
  const image=container.querySelector<HTMLImageElement>("img.wt-reader-picture");
  if(!image?.naturalWidth||!image.naturalHeight)return null;
  const rect=image.getBoundingClientRect();
  const width=rect.width,height=rect.height;
  if(width<=0||height<=0)return null;
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const drawnW=image.naturalWidth*scale,drawnH=image.naturalHeight*scale;
  const containerRect=container.getBoundingClientRect();
  // Keep the 44px touch target fully inside the image/card on narrow iPhones.
  const left=rect.left-containerRect.left+(width-drawnW)/2+drawnW*position.x;
  const top=rect.top-containerRect.top+(height-drawnH)/2+drawnH*position.y;
  const edge=24;
  return {
    left:Math.max(edge,Math.min(containerRect.width-edge,left)),
    top:Math.max(edge,Math.min(containerRect.height-edge,top))
  };
}

/** Placed on the actual rendered image, without making the rest of the picture interactive.
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
    const picture=stage.querySelector<HTMLImageElement>("img.wt-reader-picture");
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
  // Genuine 8-frame transparent GIFs for these illustrated classic scenes.
  const gifAsset=classicId==="snow-white"&&page===2
    ?"/images/interactions/reactions/snow-white-wave.gif"
    :classicId==="ugly-duckling"&&page===3
      ?"/images/interactions/reactions/duckling-flutter.gif"
      :classicId==="bremen"&&page===2
        ?"/images/interactions/reactions/bremen-music.gif":null;
  const MotionIcon=reaction.motion==="wave"?Hand
    :reaction.motion==="music"?Music2
    :reaction.motion==="flutter"?Feather
    :reaction.motion==="dance"?Footprints
    :reaction.motion==="bloom"?Flower2
    :reaction.motion==="shine"?Sun
    :reaction.motion==="bow"?Heart:Sparkles;
  return <div className="wt-character-hotspot-layer" ref={ref}>
    {point&&<button
      type="button"
      className={"wt-character-hotspot"+(visibleReaction?" is-reacting":"")}
      style={{left:point.left,top:point.top}}
      aria-label={reaction.label[lang]}
      title={reaction.label[lang]}
      onTouchStart={event=>event.stopPropagation()}
      onTouchMove={event=>event.stopPropagation()}
      onTouchEnd={event=>event.stopPropagation()}
      onPointerDown={event=>event.stopPropagation()}
      aria-pressed={visibleReaction}
      onClick={event=>{event.stopPropagation();setVisibleReaction(value=>!value);}}>
      <Sparkles size={18} aria-hidden="true"/>
    </button>}
    {visibleReaction&&point&&<div className={"wt-character-reaction-fx wt-reaction-"+reaction.motion} style={{left:point.left,top:point.top}} aria-hidden="true">
      {gifAsset
        ?<img className="wt-character-reaction-gif" src={gifAsset} alt="" width={80} height={80} decoding="async"/>
        :<><MotionIcon size={26} strokeWidth={2.2}/><MotionIcon size={19} strokeWidth={2.3}/><MotionIcon size={15} strokeWidth={2.4}/></>}
    </div>}
    {visibleReaction&&point&&<div className="wt-character-reaction" role="status" aria-live="polite">
      {reaction.message[lang]}
    </div>}
  </div>;
}
