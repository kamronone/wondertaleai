import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowLeft,ChevronLeft,ChevronRight,Film,Pause,Play,RotateCcw,Volume2,VolumeX} from "lucide-react";
import {classics} from "./classics";
import ThreePigsFilm from "./ThreePigsFilm";
import type {Lang} from "./i18n";
import {buildClassicCartoon,nextCartoonScene} from "./cartoon_storyboard";
import {preferredStoryVoice,STORY_SPEECH_LOCALE} from "./reader_voice_choices";
import "./cartoon-studio.css";

const filmModeLabels={
 ru:{film:"Мультфильм",storyboard:"Раскадровка",label:"Режим просмотра"},
 uz:{film:"Multfilm",storyboard:"Sahnalar",label:"Tomoşa rejimi"},
 en:{film:"Film",storyboard:"Storyboard",label:"Viewing mode"}
} as const;

const copy={
 ru:{title:"Студия мультфильмов",intro:"Сказка оживает на экране",demo:"Анимированная раскадровка",note:"Это локальный просмотр сцен с иллюстрациями и движением камеры, а не сгенерированное ИИ-видео.",choose:"Выберите сказку",play:"Смотреть",pause:"Пауза",back:"Назад",next:"Далее",restart:"Сначала",scene:"Сцена",voice:"Озвучивание",silent:"Без звука",noVoice:"На устройстве нет подходящего локального голоса. Доступны субтитры.",finished:"Конец сказки",previous:"Предыдущая сцена",nextScene:"Следующая сцена",transcript:"Текст сцены"},
 uz:{title:"Multfilm studiyasi",intro:"Ertak ekranda jonlanadi",demo:"Animatsiyali sahnalar",note:"Bu rasmlar va kamera harakati bilan mahalliy namoyiş, AI yaratgan video emas.",choose:"Ertakni tanlang",play:"Tomoşa qiliş",pause:"Pauza",back:"Orqaga",next:"Keyingi",restart:"Boşidan",scene:"Sahna",voice:"Ovozli öqiş",silent:"Ovozsiz",noVoice:"Qurilmada mos mahalliy ovoz yöq. Subtitrlar mavjud.",finished:"Ertak tugadi",previous:"Oldingi sahna",nextScene:"Keyingi sahna",transcript:"Sahna matni"},
 en:{title:"Cartoon studio",intro:"Bring a story to life",demo:"Animated storyboard",note:"This is a local scene preview with illustrated camera motion, not AI-generated video.",choose:"Choose a story",play:"Watch",pause:"Pause",back:"Back",next:"Next",restart:"Restart",scene:"Scene",voice:"Narration",silent:"Muted",noVoice:"No matching on-device voice is available. Captions remain available.",finished:"The end",previous:"Previous scene",nextScene:"Next scene",transcript:"Scene text"}
} as const;

export default function CartoonStudio({lang,onBack}:{lang:Lang;onBack:()=>void}){
 const t=copy[lang];
 const [id,setId]=useState("three-pigs");
 const [view,setView]=useState<"film"|"storyboard">("storyboard");
 const modeLabels=filmModeLabels[lang];
 const scenes=useMemo(()=>buildClassicCartoon(id,lang),[id,lang]);
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [muted,setMuted]=useState(false);
 const [ended,setEnded]=useState(false);
 const [voiceMissing,setVoiceMissing]=useState(false);
 const [failed,setFailed]=useState(0);
 const [elapsed,setElapsed]=useState(0);
 const run=useRef(0);
 const timer=useRef<number|null>(null);
 const utterance=useRef<SpeechSynthesisUtterance|null>(null);
 const current=scenes[index];
 const cancel=()=>{
  ++run.current;
  if(timer.current!==null){window.clearInterval(timer.current);timer.current=null;}
  if(utterance.current&&"speechSynthesis" in window){utterance.current.onend=null;utterance.current.onerror=null;window.speechSynthesis.cancel();}
  utterance.current=null;
 };
 const reset=()=>{cancel();setPlaying(false);setEnded(false);setIndex(0);setElapsed(0);setFailed(0);};
 useEffect(()=>{reset();return cancel;},[id,lang]);
 useEffect(()=>{setFailed(0);},[index]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState==="hidden"){cancel();setPlaying(false);}};
  document.addEventListener("visibilitychange",hide);
  return ()=>{document.removeEventListener("visibilitychange",hide);cancel();};
 },[]);
 function selectView(next:"film"|"storyboard"){
  if(next===view)return;
  cancel();
  setPlaying(false);
  setView(next);
 }
 function jump(next:number){
  cancel();setPlaying(false);setEnded(false);setIndex(Math.max(0,Math.min(scenes.length-1,next)));setElapsed(0);setFailed(0);
 }
 function start(at:number){
  cancel();
  const scene=scenes[at];
  if(!scene)return;
  setIndex(at);setFailed(0);setElapsed(0);setEnded(false);setPlaying(true);setVoiceMissing(false);
  const token=run.current;
  const started=performance.now();
  let narration=false;
  const advance=()=>{
   if(run.current!==token)return;
   const next=nextCartoonScene(at,scenes.length);
   if(next===null){cancel();setPlaying(false);setElapsed(scene.seconds);setEnded(true);}
   else start(next);
  };
  if(!muted&&"speechSynthesis" in window&&"SpeechSynthesisUtterance" in window){
   // Only a device-local matching voice. No cloud narration or user data upload.
   const engine=window.speechSynthesis;
   const voice=preferredStoryVoice(engine.getVoices().filter(v=>v.localService===true),lang,null);
   if(voice){
    try{
     const speech=new SpeechSynthesisUtterance(scene.text);
     speech.lang=STORY_SPEECH_LOCALE[lang];speech.voice=voice;speech.rate=.9;
     speech.onend=advance;
     speech.onerror=()=>{if(run.current===token){narration=false;setVoiceMissing(true);}};
     utterance.current=speech;engine.speak(speech);narration=true;
    }catch{narration=false;setVoiceMissing(true);}
   }else setVoiceMissing(true);
  }else if(!muted)setVoiceMissing(true);
  timer.current=window.setInterval(()=>{
   if(run.current!==token)return;
   const seconds=(performance.now()-started)/1000;
   setElapsed(Math.min(seconds,scene.seconds));
   // A bounded watchdog also handles missing Safari speech completion events.
   if(seconds>=(narration?Math.max(scene.seconds*2,30):scene.seconds))advance();
  },200);
 }
 const image=current?(failed===0&&current.animation?current.animation:failed<=(current.animation?1:0)?current.image:current.fallback||"/images/wondertale-hero.webp"):"";
 return <section className="cartoon-studio">
  <button className="cartoon-back" type="button" onClick={()=>{cancel();onBack();}}><ArrowLeft size={17}/>{t.back}</button>
  <div className="cartoon-heading"><span><Film size={23}/></span><div><h1>{t.title}</h1><p>{t.intro}</p></div></div>
  <label className="cartoon-select">{t.choose}<select value={id} onChange={e=>{reset();setView("storyboard");setId(e.target.value);}}>{classics.map(c=><option key={c.id} value={c.id}>{c.title[lang]}</option>)}</select></label>
  {id==="three-pigs"&&<div className="cartoon-view-switch" role="group" aria-label={modeLabels.label}>
   <button type="button" aria-pressed={view==="storyboard"} onClick={()=>selectView("storyboard")}>{modeLabels.storyboard}</button>
   <button type="button" aria-pressed={view==="film"} onClick={()=>selectView("film")}>{modeLabels.film}</button>
  </div>}
  {view==="film"&&id==="three-pigs"&&<ThreePigsFilm key={lang} lang={lang} onStoryboard={()=>selectView("storyboard")}/>}
  {view==="storyboard"&&current&&<>
   <div className="cartoon-screen">
    <div className={"cartoon-picture"+(playing?" cartoon-moving":"")} key={id+":"+index}>
     <img src={image} alt={classics.find(c=>c.id===id)?.title[lang]||t.scene} onError={()=>setFailed(f=>Math.min(2+(current.animation?1:0),f+1))}/>
    </div>
    <span className="cartoon-screen-label">{t.demo}</span>
    <span className="cartoon-scene-label">{t.scene} {index+1}/{scenes.length}</span>
    {ended&&<div className="cartoon-end">{t.finished}</div>}
   </div>
   <div className="cartoon-progress" role="progressbar" aria-label={t.scene} aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={scenes.length}><span style={{width:((index+Math.min(1,elapsed/current.seconds))/scenes.length*100)+"%"}}/></div>
   <div className="cartoon-controls">
    <button type="button" aria-label={t.previous} disabled={index===0} onClick={()=>jump(index-1)}><ChevronLeft size={21}/></button>
    <button type="button" className="cartoon-play" onClick={()=>{if(playing){cancel();setPlaying(false);}else start(ended?0:index);}}>{playing?<Pause size={19}/>:<Play size={19}/>} {playing?t.pause:t.play}</button>
    <button type="button" aria-label={t.nextScene} disabled={index>=scenes.length-1} onClick={()=>jump(index+1)}><ChevronRight size={21}/></button>
    <button type="button" aria-label={muted?t.silent:t.voice} aria-pressed={!muted} onClick={()=>{cancel();setPlaying(false);setMuted(v=>!v);}}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
    <button type="button" aria-label={t.restart} onClick={reset}><RotateCcw size={19}/></button>
   </div>
   {voiceMissing&&!muted&&<p className="cartoon-notice" role="status">{t.noVoice}</p>}
   <p className="cartoon-caption" aria-live="polite">{current.text}</p>
   <div className="cartoon-strip" aria-label={t.scene}>{scenes.map((scene,i)=><button key={scene.number} type="button" aria-label={t.scene+" "+scene.number} aria-current={i===index?"step":undefined} onClick={()=>jump(i)}>{scene.number}</button>)}</div>
   <p className="cartoon-notice">{t.note}</p>
  </>}
 </section>;
}
