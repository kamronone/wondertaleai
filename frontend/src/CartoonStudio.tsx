import {useEffect,useMemo,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,Check,Download,Pause,Play,RotateCcw,Volume2,VolumeX} from "lucide-react";
import {classics} from "./classics";
import ClassicFilm,{hasClassicFilm} from "./ClassicFilm";
import {listOfflineFilmIds} from "./cartoon_offline";
import type {Lang} from "./i18n";
import {buildClassicCartoon,nextCartoonScene,sceneDuration} from "./cartoon_storyboard";
import type {CartoonScene} from "./cartoon_storyboard";
import {preferredStoryVoice,STORY_SPEECH_LOCALE} from "./reader_voice_choices";

const filmModeLabels={
 ru:{film:"Мультфильмы",storyboard:"Сцены сказок",label:"Режим просмотра",catalog:"Готовые мультфильмы"},
 uz:{film:"Multfilmlar",storyboard:"Ertak sahnalari",label:"Tomoşa rejimi",catalog:"Tayyor multfilmlar"},
 en:{film:"Films",storyboard:"Story scenes",label:"Viewing mode",catalog:"Available films"}
} as const;

const filmedStories=classics.filter(story=>hasClassicFilm(story.id));

const copy={
 ru:{title:"Студия мультфильмов",intro:"Мультфильмы и сцены любимых сказок",note:"Сцены с иллюстрациями и озвучкой устройства.",choose:"Выберите сказку",play:"Смотреть",pause:"Пауза",next:"Далее",restart:"Сначала",scene:"Сцена",voice:"Озвучивание",silent:"Без звука",noVoice:"На устройстве нет подходящего локального голоса. Доступны субтитры.",finished:"Конец сказки",previous:"Предыдущая сцена",nextScene:"Следующая сцена",transcript:"Текст сцены"},
 uz:{title:"Multfilm studiyasi",intro:"Sevimli ertaklaringizni tomoşa qiling",note:"Rasmli sahnalarni qurilma ovozi bilan tinglang.",choose:"Ertakni tanlang",play:"Tomoşa qiliş",pause:"Pauza",next:"Keyingi",restart:"Boşidan",scene:"Sahna",voice:"Ovozli öqiş",silent:"Ovozsiz",noVoice:"Qurilmada mos mahalliy ovoz yöq. Subtitrlar mavjud.",finished:"Ertak tugadi",previous:"Oldingi sahna",nextScene:"Keyingi sahna",transcript:"Sahna matni"},
 en:{title:"Cartoon studio",intro:"Films and scenes from your favorite stories",note:"Illustrated scenes with on-device narration.",choose:"Choose a story",play:"Watch",pause:"Pause",next:"Next",restart:"Restart",scene:"Scene",voice:"Narration",silent:"Muted",noVoice:"No matching on-device voice is available. Captions remain available.",finished:"The end",previous:"Previous scene",nextScene:"Next scene",transcript:"Scene text"}
} as const;

type LocalCartoonBook={id:string;title:string;pages:{number:number;text:string;image_url:string}[];language?:Lang};
const personalCopy={
 ru:{personal:"Мои сказки",classic:"Классические сказки",note:"Персональная раскадровка: иллюстрации и локальная озвучка. Это не AI-видео.",empty:"Создайте сказку в конструкторе, чтобы посмотреть её сцены."},
 uz:{personal:"Mening ertaklarim",classic:"Klassik ertaklar",note:"Şaxsiy sahnalar: rasmlar va mahalliy ovoz. Bu AI video emas.",empty:"Sahnalarni tomoşa qiliş uçun ertak yarating."},
 en:{personal:"My stories",classic:"Classic stories",note:"Personal storyboard with illustrations and local narration. Not AI-generated video.",empty:"Create a story to watch its scenes."}
} as const;
const safeLocalArt=(url:string)=>/^\/images\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(url)&&!url.includes("..")?url:"/images/wondertale-hero.webp";
export default function CartoonStudio({lang,localBooks=[]}:{lang:Lang;localBooks?:readonly LocalCartoonBook[]}){
 const t=copy[lang];
 const [id,setId]=useState("three-pigs");
 const [downloads,setDownloads]=useState<Set<string>>(()=>new Set());
 const [downloadRevision,setDownloadRevision]=useState(0);
 const canChooseInitialFilm=useRef(true);
 const [view,setView]=useState<"film"|"storyboard">("film");
 const modeLabels=filmModeLabels[lang];
 const downloadedLabel={ru:"Скачано",uz:"Yuklangan",en:"Downloaded"}[lang];
 const personal=localBooks.find(book=>id==="book:"+book.id);
 const narrationLang=personal?.language??lang;
 const selectedTitle=personal?.title??classics.find(classic=>classic.id===id)?.title[lang]??t.scene;
 const scenes=useMemo<CartoonScene[]>(()=>personal?personal.pages.slice(0,20).map((page,i)=>({
  number:i+1,text:page.text,image:safeLocalArt(page.image_url),animation:null,fallback:"/images/wondertale-hero.webp",seconds:sceneDuration(page.text)
 })):buildClassicCartoon(id,lang),[personal,id,lang]);
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [muted,setMuted]=useState(false);
 const [ended,setEnded]=useState(false);
 const [voiceMissing,setVoiceMissing]=useState(false);
 const [failed,setFailed]=useState(0);
 const [elapsed,setElapsed]=useState(0);
 const lastFilm=useRef(id);
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
 const reset=()=>{cancel();setPlaying(false);setEnded(false);setIndex(0);setElapsed(0);setFailed(0);setVoiceMissing(false);};
 useEffect(()=>{reset();return cancel;},[id,lang]);
 useEffect(()=>{if(id.startsWith("book:")&&!personal){reset();setId("three-pigs");}},[id,personal]);
 useEffect(()=>{setFailed(0);},[index]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState==="hidden"){cancel();setPlaying(false);}};
  document.addEventListener("visibilitychange",hide);
  return ()=>{document.removeEventListener("visibilitychange",hide);cancel();};
 },[]);
 useEffect(()=>{
  if(!("caches" in window))return;
  let active=true;
  void listOfflineFilmIds().then(saved=>{
   if(!active)return;
   setDownloads(saved);
   if(canChooseInitialFilm.current&&!navigator.onLine&&!saved.has(lastFilm.current)){
    const first=filmedStories.find(story=>saved.has(story.id));
    if(first){
     lastFilm.current=first.id;
     setId(first.id);
    }
   }
   canChooseInitialFilm.current=false;
  }).catch(()=>{});
  return ()=>{active=false;};
 },[downloadRevision]);

 function selectView(next:"film"|"storyboard"){
  canChooseInitialFilm.current=false;
  if(next===view)return;
  cancel();
  setPlaying(false);
  if(next==="film"){
   if(hasClassicFilm(id))lastFilm.current=id;
   else setId(lastFilm.current);
  }
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
   const voice=preferredStoryVoice(engine.getVoices().filter(v=>v.localService===true),narrationLang,null);
   if(voice){
    try{
     const speech=new SpeechSynthesisUtterance(scene.text);
     speech.lang=STORY_SPEECH_LOCALE[narrationLang];speech.voice=voice;speech.rate=.9;
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
  <div className="cartoon-heading">
   <div><h1>{t.title}</h1><p>{t.intro}</p></div>
  </div>
  <div className="cartoon-view-switch" role="group" aria-label={modeLabels.label}>
   <button type="button" className="chip" aria-pressed={view==="film"} onClick={()=>selectView("film")}>{modeLabels.film}</button>
   <button type="button" className="chip" aria-pressed={view==="storyboard"} onClick={()=>selectView("storyboard")}>{modeLabels.storyboard}</button>
  </div>
  {view==="film"&&<>
   <div className="cartoon-catalog" role="group" aria-label={modeLabels.catalog}>
    {filmedStories.map(story=><button key={story.id} type="button" className="book-tile cartoon-tile" aria-pressed={id===story.id} aria-description={downloads.has(story.id)?downloadedLabel:undefined} onClick={()=>{canChooseInitialFilm.current=false;lastFilm.current=story.id;setId(story.id);}}>
     <img src={"/images/classics/"+story.id+"/pages/page-1.png"} width={48} height={50} alt=""/>
     <strong>{story.title[lang]}</strong>
     {downloads.has(story.id)&&<span className="cartoon-downloaded" title={downloadedLabel} aria-hidden="true"><Download size={10}/></span>}
     {id===story.id&&<Check size={15} aria-hidden="true"/>}
    </button>)}
   </div>
   <ClassicFilm key={id+":"+lang} storyId={id} title={selectedTitle} lang={lang} onStoryboard={()=>selectView("storyboard")} onDownloadsChanged={()=>setDownloadRevision(previous=>previous+1)}/>
  </>}
  {view==="storyboard"&&current&&<div className="form-card cartoon-player">
   <label className="cartoon-select">{t.choose}
    <select value={id} onChange={e=>{cancel();setPlaying(false);setIndex(0);setId(e.target.value);}}>
     <optgroup label={personalCopy[lang].classic}>{classics.map(story=><option key={story.id} value={story.id}>{story.title[lang]}</option>)}</optgroup>
     {localBooks.length>0&&<optgroup label={personalCopy[lang].personal}>{localBooks.filter(book=>book.pages.length>0).map(book=><option key={book.id} value={"book:"+book.id}>{book.title}</option>)}</optgroup>}
    </select>
   </label>
   <div className="cartoon-screen">
    <div className={"cartoon-picture"+(playing?" cartoon-moving":"")} key={id+":"+index}>
     <img src={image} alt={selectedTitle} onError={()=>setFailed(f=>Math.min(2+(current.animation?1:0),f+1))}/>
    </div>
    <span className="cartoon-scene-label">{t.scene} {index+1}/{scenes.length}</span>
    {ended&&<div className="cartoon-end">{t.finished}</div>}
   </div>
   <div className="cartoon-progress" role="progressbar" aria-label={t.scene} aria-valuenow={index+1} aria-valuemin={1} aria-valuemax={scenes.length}><span style={{width:((index+Math.min(1,elapsed/current.seconds))/scenes.length*100)+"%"}}/></div>
   <div className="cartoon-controls">
    <button type="button" className="icon-button" aria-label={t.previous} disabled={index===0} onClick={()=>jump(index-1)}><ChevronLeft size={21}/></button>
    <button type="button" className="primary-button cartoon-play" onClick={()=>{if(playing){cancel();setPlaying(false);}else start(ended?0:index);}}>{playing?<Pause size={19}/>:<Play size={19}/>} {playing?t.pause:t.play}</button>
    <button type="button" className="icon-button" aria-label={t.nextScene} disabled={index>=scenes.length-1} onClick={()=>jump(index+1)}><ChevronRight size={21}/></button>
    <button type="button" className="icon-button" aria-label={muted?t.silent:t.voice} aria-pressed={!muted} onClick={()=>{cancel();setPlaying(false);setMuted(v=>!v);}}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>
    <button type="button" className="icon-button" aria-label={t.restart} onClick={reset}><RotateCcw size={19}/></button>
   </div>
   {voiceMissing&&!muted&&<p className="cartoon-notice" role="status">{t.noVoice}</p>}
   <p className="cartoon-caption" aria-live="polite">{current.text}</p>
   <div className="cartoon-strip" role="group" aria-label={t.scene}>{scenes.map((scene,i)=><button key={scene.number} type="button" className="icon-button" aria-label={t.scene+" "+scene.number} aria-current={i===index?"step":undefined} onClick={()=>jump(i)}>{scene.number}</button>)}</div>
   <p className="cartoon-notice">{personal?personalCopy[lang].note:t.note}</p>
   {!localBooks.length&&<p className="cartoon-notice">{personalCopy[lang].empty}</p>}
  </div>}
 </section>;
}
