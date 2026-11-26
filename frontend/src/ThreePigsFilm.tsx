import {useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";

const filmDirectory="/cartoons/three-pigs";
const poster="/images/classics/three-pigs/pages/page-1.png";
const trackLabels={ru:"Русский",uz:"Özbekça",en:"English"} as const;
const languages=["ru","uz","en"] as const;
const copy={
 ru:{title:"Три поросёнка",info:"1 мин 20 с",audio:"Озвучка",error:"Видео не загрузилось.",fallback:"Открыть раскадровку"},
 uz:{title:"Uçta çöçqaça",info:"1 daqiqa 20 soniya",audio:"Ovoz tili",error:"Video yuklanmadi.",fallback:"Sahnalarni oçiş"},
 en:{title:"The Three Little Pigs",info:"1 min 20 sec",audio:"Narration",error:"The video could not load.",fallback:"Open storyboard"}
} as const;

type FilmPosition={
 time:number;
 playing:boolean;
 rate:number;
 captions:TextTrackMode[];
};

export default function ThreePigsFilm({lang,onStoryboard}:{lang:Lang;onStoryboard:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null);
 const position=useRef<FilmPosition|null>(null);
 const [audioLanguage,setAudioLanguage]=useState(lang);
 const [failed,setFailed]=useState(false);
 const t=copy[lang];

 useEffect(()=>{
  const video=videoRef.current;
  function pauseWhenHidden(){
   if(!document.hidden)return;
   if(position.current)position.current.playing=false;
   video?.pause();
  }
  document.addEventListener("visibilitychange",pauseWhenHidden);
  return ()=>{
   document.removeEventListener("visibilitychange",pauseWhenHidden);
   video?.pause();
  };
 },[failed]);

 function changeAudio(next:Lang){
  const video=videoRef.current;
  if(next===audioLanguage)return;
  if(!position.current&&video&&video.readyState>=HTMLMediaElement.HAVE_METADATA){
   position.current={
    time:video.currentTime,
    playing:!video.paused&&!video.ended,
    rate:video.playbackRate,
    captions:Array.from(video.textTracks,track=>track.mode)
   };
  }
  setFailed(false);
  setAudioLanguage(next);
 }

 function restorePosition(video:HTMLVideoElement){
  const previous=position.current;
  if(!previous||video.currentSrc!==video.src)return;
  position.current=null;
  video.currentTime=Math.min(previous.time,video.duration);
  video.playbackRate=previous.rate;
  for(const [i,track] of Array.from(video.textTracks).entries()){
   track.mode=previous.captions[i]??track.mode;
  }
  if(previous.playing&&!document.hidden)void video.play().catch(()=>{});
 }

 return <div className="cartoon-film">
  <label className="cartoon-select cartoon-film-audio">
   {t.audio}
   <select value={audioLanguage} onChange={event=>changeAudio(event.target.value as Lang)}>
    {languages.map(language=><option key={language} value={language} lang={language}>{trackLabels[language]}</option>)}
   </select>
  </label>
  {failed?<div className="cartoon-film-error">
   <p role="status">{t.error}</p>
   <button type="button" onClick={onStoryboard}>{t.fallback}</button>
  </div>:<video
   ref={videoRef}
   aria-label={t.title}
   src={filmDirectory+"/film-"+audioLanguage+".mp4"}
   poster={poster}
   width={384}
   height={512}
   controls
   playsInline
   preload="metadata"
   onLoadedMetadata={event=>restorePosition(event.currentTarget)}
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
