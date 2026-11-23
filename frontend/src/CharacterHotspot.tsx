import {useEffect,useRef,useState} from "react";
import {Sparkles,Hand,Music2,Feather,Heart,Flower2,Sun,Footprints,X} from "lucide-react";
import type {Lang} from "./i18n";
import {reactionGifData} from "./reaction_gif_assets";

type Position={x:number;y:number};
type ReactionMotion="wave"|"music"|"flutter"|"bow"|"dance"|"shine"|"bloom"|"cheer";
type Reaction={label:Record<Lang,string>;message:Record<Lang,string>;position:Position;motion:ReactionMotion};
const words=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});

/* Coordinates are fractions of the visible artwork, not the padded card.
   Never use a hotspot on a private photo or generated user illustration. */
const reactions:Record<string,Reaction>={
  "frog-prince:1": {
    motion:"wave",
    position:{x:.48,y:.60},
    label:words("Поздороваться с лягушонком","Qurbaqacha bilan salomlashish","Greet the little frog"),
    message:words("Лягушонок приветливо квакает и рад знакомству!","Qurbaqacha quvonib qurillaydi va tanishganidan xursand!","The little frog croaks a happy hello!")
  },
  "princess-pea:1": {
    motion:"shine",
    position:{x:.54,y:.58},
    label:words("Поприветствовать принцессу","Malikani kutib olish","Welcome the princess"),
    message:words("Принцесса благодарит тебя за тёплый приём!","Malika samimiy kutib olganing uchun rahmat aytadi!","The princess thanks you for your warm welcome!")
  },
  "little-mermaid:1": {
    motion:"flutter",
    position:{x:.50,y:.62},
    label:words("Помахать Русалочке","Suv parisiga qo‘l silkitish","Wave to the mermaid"),
    message:words("Русалочка улыбается, а вокруг неё кружатся пузырьки!","Suv parisi jilmayadi, atrofida pufakchalar aylanadi!","The mermaid smiles as bubbles swirl around her!")
  },
  "snow-queen:1": {
    motion:"shine",
    position:{x:.49,y:.57},
    label:words("Зажечь огонёк дружбы","Do‘stlik nurini yoqish","Light up friendship"),
    message:words("Тёплый свет дружбы сияет даже среди снегов!","Do‘stlikning iliq nuri qorlar orasida ham porlaydi!","The warm light of friendship shines even in the snow!")
  },
  "nutcracker:1": {
    motion:"dance",
    position:{x:.51,y:.58},
    label:words("Позвать Щелкунчика","Yong‘oq chaqadigan askarchani chaqirish","Call the Nutcracker"),
    message:words("Щелкунчик весело кланяется и начинает танцевать!","Askarcha quvonib ta’zim qiladi va raqsga tushadi!","The Nutcracker bows and starts to dance!")
  },
  "aladdin:1": {
    motion:"shine",
    position:{x:.52,y:.55},
    label:words("Поздороваться с Аладдином","Alovuddinga salom berish","Greet Aladdin"),
    message:words("Аладдин машет тебе, и волшебная лампа мягко сияет!","Alovuddin qo‘l silkitadi, sehrli chiroq mayin porlaydi!","Aladdin waves while the magic lamp glows softly!")
  },
  "kolobok:1": {
    motion:"dance",
    position:{x:.51,y:.56},
    label:words("Поздороваться с Колобком","Bo‘g‘irsoqqa salom berish","Greet the runaway bun"),
    message:words("Колобок весело подпрыгивает и приглашает тебя в путешествие!","Bo‘g‘irsoq quvonib sakraydi va seni sayohatga chorlaydi!","The little bun bounces happily and invites you on an adventure!")
  },
  "turnip:1": {
    motion:"cheer",
    position:{x:.55,y:.62},
    label:words("Помочь вытащить репку","Sholg‘omni tortishga yordam berish","Help pull the turnip"),
    message:words("Раз, два, три! Вместе тянуть репку намного легче!","Bir, ikki, uch! Sholg‘omni birga tortish osonroq!","One, two, three! Pulling together makes the job easier!")
  },
  "pinocchio:1": {
    motion:"wave",
    position:{x:.49,y:.55},
    label:words("Поздороваться с Пиноккио","Pinokkioga salom berish","Greet Pinocchio"),
    message:words("Пиноккио машет тебе и обещает говорить правду!","Pinokkio senga qo‘l silkitib, rost gapirishga va’da beradi!","Pinocchio waves and promises to tell the truth!")
  },
  "thumbelina:1": {
    motion:"bloom",
    position:{x:.51,y:.57},
    label:words("Подарить Дюймовочке улыбку","Dyuymovochkaga tabassum hadya etish","Smile at Thumbelina"),
    message:words("Цветы раскрываются, и Дюймовочка улыбается тебе в ответ!","Gullar ochiladi, Dyuymovochka esa senga tabassum qiladi!","The flowers bloom, and Thumbelina smiles back at you!")
  },
  "jack-beanstalk:1": {
    motion:"shine",
    position:{x:.52,y:.62},
    label:words("Пожелать Джеку удачи","Jekka omad tilash","Wish Jack luck"),
    message:words("Джек благодарит тебя и смело начинает своё приключение!","Jek senga rahmat aytib, sarguzashtini dadil boshlaydi!","Jack thanks you and begins his adventure bravely!")
  },
  "goldilocks:1": {
    motion:"flutter",
    position:{x:.51,y:.54},
    label:words("Напомнить о вежливости","Xushmuomalalikni eslatish","Remind Goldilocks to be polite"),
    message:words("Златовласка кивает: чужие вещи нужно беречь и спрашивать разрешения.","Oltinsoch bosh irg‘aydi: boshqalarning buyumlarini ehtiyot qilish va ruxsat so‘rash kerak.","Goldilocks nods: always ask before using somebody else's things.")
  },
  "snow-white:1": {
    motion:"shine",
    position:{x:.49,y:.66},
    label:words("Поздороваться с Белоснежкой","Oppog‘oyga salom berish","Greet Snow White"),
    message:words("Белоснежка улыбается и приглашает тебя в сказку!","Oppog‘oy jilmayib, seni ertakka taklif qiladi!","Snow White smiles and welcomes you into the story!")
  },
  "snow-white:4": {
    motion:"cheer",
    position:{x:.52,y:.60},
    label:words("Подбодрить Белоснежку","Oppog‘oyga dalda berish","Encourage Snow White"),
    message:words("Белоснежка набирается смелости и благодарит тебя!","Oppog‘oy dadilroq bo‘lib, senga rahmat aytadi!","Snow White feels braver and thanks you!")
  },
  "snow-white:8": {
    motion:"bloom",
    position:{x:.50,y:.58},
    label:words("Порадоваться вместе","Birga quvonish","Celebrate together"),
    message:words("Все радуются счастливому окончанию сказки!","Hamma ertakning baxtli yakunidan quvonadi!","Everyone celebrates the story's happy ending!")
  },
  "red-hood:2": {
    motion:"flutter",
    position:{x:.51,y:.56},
    label:words("Поздороваться в лесу","O‘rmonda salomlashish","Say hello in the forest"),
    message:words("Лесные друзья радостно встречают тебя!","O‘rmondagi do‘stlar seni quvonib kutib oladi!","The forest friends greet you happily!")
  },
  "cinderella:1": {
    motion:"shine",
    position:{x:.53,y:.60},
    label:words("Поддержать Золушку","Zolushkaga dalda berish","Cheer for Cinderella"),
    message:words("Золушка улыбается: даже маленькая доброта творит чудеса!","Zolushka jilmayadi: kichik yaxshilik ham mo‘jiza yaratadi!","Cinderella smiles: even a little kindness can make magic!")
  },
  "rapunzel:1": {
    motion:"bloom",
    position:{x:.50,y:.61},
    label:words("Поприветствовать Рапунцель","Rapunsel bilan salomlashish","Greet Rapunzel"),
    message:words("Рапунцель отвечает тебе приветливой улыбкой!","Rapunsel senga samimiy tabassum bilan javob beradi!","Rapunzel welcomes you with a warm smile!")
  },
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
  // Rendered classics can be a PNG/GIF, an authored SVG image, or the local
  // inline SVG fallback. A reaction must not disappear when PNG is unavailable.
  const media=container.querySelector<HTMLElement>("img.wt-reader-picture, img.story-page-image-art, svg.story-image-fallback, .story-page-image > img, .story-page-image > svg");
  if(!media)return null;
  const rect=media.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return null;

  let drawnW=rect.width,drawnH=rect.height;
  let offsetX=0,offsetY=0;
  if(media instanceof HTMLImageElement){
    if(!media.naturalWidth||!media.naturalHeight)return null;
    const fit=window.getComputedStyle(media).objectFit;
    // When the image is cropped by object-fit:cover, its visible rectangle
    // is the actual element box, not the entire source image.
    if(fit!=="cover"&&fit!=="fill"&&fit!=="none"){
      const scale=Math.min(rect.width/media.naturalWidth,rect.height/media.naturalHeight);
      drawnW=media.naturalWidth*scale;
      drawnH=media.naturalHeight*scale;
      offsetX=(rect.width-drawnW)/2;
      offsetY=(rect.height-drawnH)/2;
    }
  }
  const containerRect=container.getBoundingClientRect();
  const left=rect.left-containerRect.left+offsetX+drawnW*position.x;
  const top=rect.top-containerRect.top+offsetY+drawnH*position.y;
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
  const [reactionReplay,setReactionReplay]=useState(0);
  const [gifFailed,setGifFailed]=useState(false);
  useEffect(()=>{setVisibleReaction(false);setReactionReplay(0);setGifFailed(false);setPoint(null);},[classicId,page]);
  useEffect(()=>{
    if(!reaction||!enabled)return;
    const stage=ref.current?.parentElement;
    if(!stage)return;
    // Ignore identical coordinates: otherwise observing the reaction layer itself
    // creates a render -> DOM mutation -> render loop on iPhone Safari.
    const update=()=>{
      const next=imagePoint(stage,reaction.position);
      setPoint(previous=>previous?.left===next?.left&&previous?.top===next?.top?previous:next);
    };
    let picture:HTMLImageElement|null=null;
    const bindImage=()=>{
      const next=stage.querySelector<HTMLImageElement>("img.wt-reader-picture, .story-page-image > img");
      if(next===picture)return;
      picture?.removeEventListener("load",update);
      picture=next;
      picture?.addEventListener("load",update);
    };
    bindImage();
    window.addEventListener("resize",update);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    observer?.observe(stage);
    const mediaObserver=typeof MutationObserver!=="undefined"?new MutationObserver(()=>{
      bindImage();
      update();
    }):null;
    // The observer covers image replacement, but coordinate equality prevents
    // feedback when React inserts animation and dialogue nodes inside the stage.
    mediaObserver?.observe(stage,{childList:true,subtree:true});
    update();
    return ()=>{
      picture?.removeEventListener("load",update);
      window.removeEventListener("resize",update);
      observer?.disconnect();
      mediaObserver?.disconnect();
    };
  },[classicId,page,enabled,reaction]);
  if(!reaction||!enabled)return null;
  // GIF89a data URLs are bundled locally and work offline without 404 requests.
  const gifAsset=reactionGifData[`${classicId}:${page}`]??null;
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
      onClick={event=>{event.stopPropagation();setVisibleReaction(true);setReactionReplay(value=>value+1);}}>
      <MotionIcon size={20} aria-hidden="true"/>
    </button>}
    {visibleReaction&&point&&<div key={reactionReplay} className={"wt-character-reaction-fx wt-reaction-"+reaction.motion} style={{left:point.left,top:point.top}} aria-hidden="true">
      {gifAsset&&!gifFailed
        ?<><img className="wt-character-reaction-gif" src={gifAsset} alt="" width={80} height={80} decoding="async" draggable={false} onError={()=>setGifFailed(true)}/><span className="wt-character-reaction-still"><MotionIcon size={30} aria-hidden="true"/></span></>
        :<><MotionIcon size={26} strokeWidth={2.2}/><MotionIcon size={19} strokeWidth={2.3}/><MotionIcon size={15} strokeWidth={2.4}/></>}
    </div>}
    {visibleReaction&&point&&<div className="wt-character-reaction" onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onTouchStart={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}>
      <span role="status" aria-live="polite">{reaction.message[lang]}</span>
      <button
        type="button"
        className="wt-character-reaction-close"
        aria-label={words("Закрыть реплику","Javobni yopish","Close reply")[lang]}
        title={words("Закрыть","Yopish","Close")[lang]}
        onPointerDown={event=>event.stopPropagation()}
        onTouchStart={event=>event.stopPropagation()}
        onTouchMove={event=>event.stopPropagation()}
        onTouchEnd={event=>event.stopPropagation()}
        onClick={event=>{event.stopPropagation();setVisibleReaction(false);}}
        onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setVisibleReaction(false);}}}
      ><X size={16} aria-hidden="true"/></button>
    </div>}
  </div>;
}
