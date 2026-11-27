import {useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";

const filmIds=new Set(["three-pigs","red-hood"]);

export function hasClassicFilm(id:string){
 return filmIds.has(id);
}
const trackLabels={ru:"Русский",uz:"Özbekça",en:"English"} as const;
const languages=["ru","uz","en"] as const;
const copy={
 ru:{info:"1 мин 20 с",audio:"Озвучка",error:"Видео не загрузилось.",fallback:"Открыть сцены сказки"},
 uz:{info:"1 daqiqa 20 soniya",audio:"Ovoz tili",error:"Video yuklanmadi.",fallback:"Ertak sahnalarini oçiş"},
 en:{info:"1 min 20 sec",audio:"Narration",error:"The video could not load.",fallback:"Open story scenes"}
} as const;

type FilmPosition={
 time:number;
 playing:boolean;
 rate:number;
 captions:TextTrackMode[];
};

export default function ClassicFilm({storyId,title,lang,onStoryboard}:{storyId:string;title:string;lang:Lang;onStoryboard:()=>void}){
 const filmDirectory="/cartoons/"+storyId;
 const poster="/images/classics/"+storyId+"/pages/page-1.png";
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

 return <div className="form-card cartoon-player cartoon-film">
  <div className="cartoon-film-toolbar">
   <label className="cartoon-select cartoon-film-audio">
   {t.audio}
   <span className="cartoon-audio-field">
    <span className="cartoon-audio-value" aria-hidden="true">{trackLabels[audioLanguage]}</span>
   <select value={audioLanguage} onChange={event=>changeAudio(event.target.value as Lang)}>
    {languages.map(language=><option key={language} value={language} lang={language}>{trackLabels[language]}</option>)}
   </select>
   </span>
   </label>
   <span className="cartoon-notice">{t.info}</span>
  </div>
  {failed?<div className="cartoon-film-error">
   <p role="status">{t.error}</p>
   <button type="button" className="secondary-button" onClick={onStoryboard}>{t.fallback}</button>
  </div>:<video
   ref={videoRef}
   aria-label={title}
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
 </div>;
}
