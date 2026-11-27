import {useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";

import {classicFilmIds,classicFilmUrl,classicFilmPoster,findOfflineFilmLanguage,hasOfflineFilm,saveOfflineFilm,removeOfflineFilm} from "./cartoon_offline";

export function hasClassicFilm(id:string){
 return classicFilmIds.has(id);
}
const trackLabels={ru:"Русский",uz:"Özbekça",en:"English"} as const;
const languages=["ru","uz","en"] as const;
const copy={
 ru:{audio:"Озвучка",error:"Видео не загрузилось.",fallback:"Открыть сцены сказки"},
 uz:{audio:"Ovoz tili",error:"Video yuklanmadi.",fallback:"Ertak sahnalarini oçiş"},
 en:{audio:"Narration",error:"The video could not load.",fallback:"Open story scenes"}
} as const;

type FilmPosition={
 time:number;
 playing:boolean;
 rate:number;
 captions:TextTrackMode[];
};

export default function ClassicFilm({storyId,title,lang,onStoryboard,onDownloadsChanged}:{storyId:string;title:string;lang:Lang;onStoryboard:()=>void;onDownloadsChanged:()=>void}){
 const filmDirectory="/cartoons/"+storyId;
 const poster=classicFilmPoster(storyId);
 const videoRef=useRef<HTMLVideoElement>(null);
 const triedOfflineFallback=useRef(false);
 const position=useRef<FilmPosition|null>(null);
 const [audioLanguage,setAudioLanguage]=useState(lang);
 const [failed,setFailed]=useState(false);
 const [duration,setDuration]=useState<number|null>(null);
 const durationLabel=duration===null?null:new Intl.NumberFormat(lang,{minimumIntegerDigits:2,useGrouping:false}).format(Math.floor(duration/60))+":"+new Intl.NumberFormat(lang,{minimumIntegerDigits:2,useGrouping:false}).format(Math.floor(duration%60));
 const t=copy[lang];
 const offlineCopy={
  ru:{save:"Сохранить офлайн",remove:"Удалить загрузку",busy:"Подождите…",error:"Не удалось обновить загрузку."},
  uz:{save:"Oflayn saqlaş",remove:"Yuklamani öçiriş",busy:"Biroz kuting…",error:"Yuklamani yangilab bölmadi."},
  en:{save:"Save offline",remove:"Remove download",busy:"Please wait…",error:"Could not update the download."}
 }[lang];
 const filmUrl=classicFilmUrl(storyId,audioLanguage);
 const [savedUrl,setSavedUrl]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [offlineError,setOfflineError]=useState(false);

 useEffect(()=>{
  let active=true;
  setOfflineError(false);
  if("caches" in window)void hasOfflineFilm(storyId,audioLanguage)
   .then(saved=>{if(active)setSavedUrl(saved?filmUrl:null);})
   .catch(()=>{if(active)setSavedUrl(null);});
  return ()=>{active=false;};
 },[storyId,audioLanguage,filmUrl]);

 useEffect(()=>{
  if(navigator.onLine||!("caches" in window))return;
  let active=true;
  void (async()=>{
   if(await hasOfflineFilm(storyId,lang))return;
   const savedLanguage=await findOfflineFilmLanguage(storyId,lang);
   if(active&&savedLanguage){
    setAudioLanguage(current=>current===lang?savedLanguage:current);
    setFailed(false);
   }
  })().catch(()=>{});
  return ()=>{active=false;};
 },[storyId,lang]);

 async function toggleOffline(){
  setBusy(true);
  setOfflineError(false);
  try{
   if(savedUrl===filmUrl){
    await removeOfflineFilm(storyId,audioLanguage);
    setSavedUrl(null);
   }else{
    await saveOfflineFilm(storyId,audioLanguage);
    setSavedUrl(filmUrl);
   }
   onDownloadsChanged();
  }catch{setOfflineError(true);}
  finally{setBusy(false);}
 }

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
  triedOfflineFallback.current=false;
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
  setDuration(null);
  setAudioLanguage(next);
 }

 async function handleVideoError(video:HTMLVideoElement){
  const source=video.src;
  if(!triedOfflineFallback.current&&"caches" in window){
   const savedLanguage=await findOfflineFilmLanguage(storyId,audioLanguage).catch(()=>null);
   if(videoRef.current!==video||video.src!==source)return;
   if(savedLanguage){
    changeAudio(savedLanguage);
    triedOfflineFallback.current=true;
    return;
   }
  }
  setFailed(true);
 }

 function restorePosition(video:HTMLVideoElement){
  const previous=position.current;
  if(!previous||video.currentSrc!==video.src)return;
  position.current=null;
  video.currentTime=Number.isFinite(video.duration)?Math.min(previous.time,video.duration):previous.time;
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
   <select disabled={busy} value={audioLanguage} onChange={event=>changeAudio(event.target.value as Lang)}>
    {languages.map(language=><option key={language} value={language} lang={language}>{trackLabels[language]}</option>)}
   </select>
   </span>
   </label>
   {durationLabel!==null&&<span className="cartoon-notice">{durationLabel}</span>}
  </div>
  {failed?<div className="cartoon-film-error">
   <p role="status">{t.error}</p>
   <button type="button" className="secondary-button" onClick={onStoryboard}>{t.fallback}</button>
  </div>:<video
   ref={videoRef}
   aria-label={title}
   src={filmUrl}
   poster={poster}
   width={384}
   height={512}
   controls
   playsInline
   preload="metadata"
   onLoadedMetadata={event=>{
    const video=event.currentTarget;
    setDuration(Number.isFinite(video.duration)&&video.duration>0?video.duration:null);
    restorePosition(video);
   }}
   onDurationChange={event=>{
    const value=event.currentTarget.duration;
    setDuration(Number.isFinite(value)&&value>0?value:null);
   }}
   onError={event=>void handleVideoError(event.currentTarget)}
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
  {"caches" in window&&<button type="button" className="secondary-button cartoon-offline-button" disabled={busy} onClick={()=>void toggleOffline()}>
   {busy?offlineCopy.busy:savedUrl===filmUrl?offlineCopy.remove:offlineCopy.save}
  </button>}
  {offlineError&&<p className="cartoon-notice" role="status">{offlineCopy.error}</p>}
 </div>;
}
