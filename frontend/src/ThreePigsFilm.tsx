import {useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";

const filmDirectory="/cartoons/three-pigs";
const poster="/images/classics/three-pigs/pages/page-1.png";
const trackLabels={ru:"Русский",uz:"Özbekça",en:"English"} as const;
const languages=["ru","uz","en"] as const;
const copy={
 ru:{title:"Три поросёнка",info:"1 мин 20 с · Без звука, с субтитрами",error:"Видео не загрузилось.",fallback:"Открыть раскадровку"},
 uz:{title:"Uçta çöçqaça",info:"1 daqiqa 20 soniya · Ovozsiz, subtitrlar bilan",error:"Video yuklanmadi.",fallback:"Sahnalarni oçiş"},
 en:{title:"The Three Little Pigs",info:"1 min 20 sec · Silent, with captions",error:"The video could not load.",fallback:"Open storyboard"}
} as const;

export default function ThreePigsFilm({lang,onStoryboard}:{lang:Lang;onStoryboard:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null);
 const [failed,setFailed]=useState(false);
 const t=copy[lang];

 useEffect(()=>{
  const video=videoRef.current;
  function pauseWhenHidden(){
   if(document.hidden)video?.pause();
  }
  document.addEventListener("visibilitychange",pauseWhenHidden);
  return ()=>{
   document.removeEventListener("visibilitychange",pauseWhenHidden);
   video?.pause();
  };
 },[]);

 return <div className="cartoon-film">
  {failed?<div className="cartoon-film-error">
   <p role="status">{t.error}</p>
   <button type="button" onClick={onStoryboard}>{t.fallback}</button>
  </div>:<video
   ref={videoRef}
   aria-label={t.title}
   src={filmDirectory+"/film.mp4"}
   poster={poster}
   width={384}
   height={512}
   controls
   playsInline
   preload="metadata"
   onError={()=>setFailed(true)}
  >
   {languages.map(language=><track
    key={language}
    kind="captions"
    src={filmDirectory+"/"+language+".vtt"}
    srcLang={language}
    label={trackLabels[language]}
    default={language===lang}
   />)}
  </video>}
  <p className="cartoon-notice">{t.info}</p>
 </div>;
}
