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

const exportCopy={
 ru:{save:"Сохранить видеоряд",cancel:"Отменить экспорт",note:"Видеоряд без звука. Формат зависит от браузера.",error:"Не удалось создать видео.",unsupported:"Экспорт видео не поддерживается этим браузером.",ready:"Видео готово",download:"Скачать видео"},
 uz:{save:"Videoni saqlaş",cancel:"Bekor qiliş",note:"Ovozsiz video. Format brauzerga boğliq.",error:"Video yaratib bölmadi.",unsupported:"Brauzer video eksportini qöllamaydi.",ready:"Video tayyor",download:"Videoni yuklaş"},
 en:{save:"Create video",cancel:"Cancel export",note:"Silent montage. Format depends on the browser.",error:"Could not create video.",unsupported:"Video export is not supported by this browser.",ready:"Video ready",download:"Download video"}
} as const;

const exportSettings={
 ru:{duration:"Длительность сцены",seconds:"сек.",auto:"По тексту",captions:"Субтитры",estimated:"Примерная длительность",preview:"Предпросмотр",on:"Включены",off:"Выключены"},
 uz:{duration:"Sahna davomiyligi",seconds:"son.",auto:"Matn böyiça",captions:"Subtitrlar",estimated:"Tahminiy davomiylik",preview:"Oldindan köriş",on:"Yoqilgan",off:"Öçirilgan"},
 en:{duration:"Scene duration",seconds:"sec.",auto:"Reading time",captions:"Captions",estimated:"Estimated duration",preview:"Preview",on:"On",off:"Off"}
} as const;
type ExportDuration=3|6|10|"auto";
function exportSceneSeconds(scene:CartoonScene,duration:ExportDuration):number{
 return duration==="auto"?Math.min(30,Math.max(8,scene.seconds)):duration;
}
function captionPages(ctx:CanvasRenderingContext2D,text:string):string[][]{
 ctx.font="bold 21px sans-serif";
 const words=text.replace(/\s+/gu," ").trim().split(" ").filter(Boolean);
 const lines:string[]=[];let line="";
 for(const word of words){
  const candidate=line?line+" "+word:word;
  if(ctx.measureText(candidate).width<=580){line=candidate;continue;}
  if(line){lines.push(line);line="";}
  for(const char of Array.from(word)){
   if(ctx.measureText(line+char).width>580&&line){lines.push(line);line="";}
   line+=char;
  }
 }
 if(line)lines.push(line);
 const pages:string[][]=[];
 for(let i=0;i<lines.length;i+=3)pages.push(lines.slice(i,i+3));
 return pages;
}
function localVideoFormat(){
 if(typeof MediaRecorder==="undefined"||typeof HTMLCanvasElement==="undefined"||typeof HTMLCanvasElement.prototype.captureStream!=="function")return null;
 return ["video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(type=>MediaRecorder.isTypeSupported(type))??null;
}
function localVideoImage(url:string,signal:AbortSignal):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error("Cancelled"));return;}
  const img=new Image();
  const finish=(error?:Error)=>{window.clearTimeout(timeout);signal.removeEventListener("abort",abort);img.onload=null;img.onerror=null;if(error){img.src="";reject(error);}else resolve(img);};
  const abort=()=>finish(new Error("Cancelled"));
  const timeout=window.setTimeout(()=>finish(new Error("Image timeout")),10000);
  signal.addEventListener("abort",abort,{once:true});
  img.onload=()=>finish();img.onerror=()=>finish(new Error("Image unavailable"));img.src=safeLocalArt(url);
 });
}
function waitFrame(ms:number,signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new Error("Cancelled"));return;}
  const abort=()=>{window.clearTimeout(timer);reject(new Error("Cancelled"));};
  const timer=window.setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
  signal.addEventListener("abort",abort,{once:true});
 });
}
async function recordLocalMontage(scenes:CartoonScene[],duration:ExportDuration,captions:boolean,signal:AbortSignal,onProgress:(n:number)=>void):Promise<Blob>{
 const mime=localVideoFormat();
 if(!mime||!scenes.length||scenes.length>20||signal.aborted)throw new Error("Unavailable");
 const canvas=document.createElement("canvas");canvas.width=640;canvas.height=480;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
 const stream=canvas.captureStream(24);
 let recorder:MediaRecorder|null=null;
 try{
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000});
  const active=recorder;const chunks:Blob[]=[];
  const output=new Promise<Blob>((resolve,reject)=>{
   active.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   active.onerror=()=>reject(new Error("Recording failed"));
   active.onstop=()=>{const blob=new Blob(chunks,{type:active.mimeType||mime});if(blob.size)resolve(blob);else reject(new Error("Empty video"));};
  });
  void output.catch(()=>{});
  for(let i=0;i<scenes.length;i++){
   if(signal.aborted||document.hidden)throw new Error("Cancelled");
   const scene=scenes[i];let image:HTMLImageElement|null=null;
   try{image=await localVideoImage(scene.image,signal);}catch{if(signal.aborted)throw new Error("Cancelled");image=await localVideoImage("/images/wondertale-hero.webp",signal);}
   if(signal.aborted)throw new Error("Cancelled");
   const frame=image;
   const scale=Math.min(640/frame.naturalWidth,480/frame.naturalHeight);
   const w=frame.naturalWidth*scale,h=frame.naturalHeight*scale;
   const seconds=exportSceneSeconds(scene,duration);
   const pages=captions?captionPages(ctx,scene.text):[];
   const started=performance.now();
   const draw=()=>{
    ctx.fillStyle="#201849";ctx.fillRect(0,0,640,480);ctx.drawImage(frame,(640-w)/2,(480-h)/2,w,h);
    if(pages.length){
     const fraction=Math.min(.999,Math.max(0,(performance.now()-started)/(seconds*1000)));
     const lines=pages[Math.floor(fraction*pages.length)];
     ctx.fillStyle="rgba(20,16,34,.9)";ctx.fillRect(0,480-lines.length*28-22,640,lines.length*28+22);
     ctx.font="bold 21px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";
     lines.forEach((line,i)=>ctx.fillText(line,320,480-lines.length*28-8+i*28,580));
    }
   };
   draw();
   if(i===0)active.start(1000);
   const refresh=window.setInterval(draw,100);
   try{await waitFrame(seconds*1000,signal);}finally{window.clearInterval(refresh);}
   onProgress(Math.round((i+1)/scenes.length*100));
  }
  if(active.state!=="inactive")active.stop();
  const blob=await output;
  if(signal.aborted)throw new Error("Cancelled");
  return blob;
 }finally{
  if(recorder&&recorder.state!=="inactive")recorder.stop();
  stream.getTracks().forEach(track=>track.stop());
 }
}
function StoryboardVideoExport({scenes,lang,onStart}:{scenes:CartoonScene[];lang:Lang;onStart:()=>void}){
 const t=exportCopy[lang];
 const controller=useRef<AbortController|null>(null);
 const objectUrl=useRef<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState(false);
 const [result,setResult]=useState<{url:string;ext:string}|null>(null);
 const supported=Boolean(localVideoFormat());
 const settings=exportSettings[lang];
 const [duration,setDuration]=useState<ExportDuration>(6);
 const [captions,setCaptions]=useState(true);
 const total=scenes.reduce((sum,scene)=>sum+exportSceneSeconds(scene,duration),0);
 const totalLabel=Math.floor(total/60)+":"+String(total%60).padStart(2,"0");
 useEffect(()=>{
  const hide=()=>{if(document.hidden)controller.current?.abort();};
  document.addEventListener("visibilitychange",hide);
  return ()=>{document.removeEventListener("visibilitychange",hide);controller.current?.abort();controller.current=null;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);};
 },[]);
 async function save(){
  if(controller.current||!supported||!scenes.length)return;
  onStart();setBusy(true);setProgress(0);setError(false);setResult(null);
  if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;}
  const job=new AbortController();controller.current=job;
  try{
   const blob=await recordLocalMontage(scenes,duration,captions,job.signal,n=>{if(controller.current===job)setProgress(n);});
   if(controller.current!==job||job.signal.aborted)return;
   const url=URL.createObjectURL(blob);objectUrl.current=url;setResult({url,ext:blob.type.startsWith("video/mp4")?"mp4":"webm"});
  }catch{if(controller.current===job&&!job.signal.aborted)setError(true);}
  finally{if(controller.current===job){controller.current=null;setBusy(false);}}
 }
 return <div className="form-card" style={{display:"grid",gap:8,padding:10,margin:0}}>
  <p className="cartoon-notice">{supported?t.note:t.unsupported}</p>
  {supported&&<div style={{display:"grid",gap:8}}>
   <label className="cartoon-select">{settings.duration}
    <select disabled={busy} value={duration} onChange={e=>setDuration(e.target.value==="auto"?"auto":Number(e.target.value) as ExportDuration)}>
     {[3,6,10].map(value=><option key={value} value={value}>{value} {settings.seconds}</option>)}
     <option value="auto">{settings.auto}</option>
    </select>
   </label>
   <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
    <input type="checkbox" checked={captions} disabled={busy} onChange={e=>setCaptions(e.target.checked)}/>{settings.captions}
   </label>
   <p className="cartoon-notice">{settings.estimated}: {totalLabel}</p>
  </div>}
  {supported&&<button type="button" className="secondary-button cartoon-offline-button" onClick={()=>busy?controller.current?.abort():void save()}>{busy?t.cancel:t.save}</button>}
  {busy&&<progress max={100} value={progress} aria-label={t.save}/>}
  {error&&<p className="cartoon-notice" role="alert">{t.error}</p>}
  {result&&<><p className="cartoon-notice" role="status">{t.ready}</p><video aria-label={settings.preview} src={result.url} controls playsInline preload="metadata" style={{width:"100%",maxHeight:320,borderRadius:12}}/><a className="secondary-button cartoon-offline-button" href={result.url} download={"ertakcha-story."+result.ext}>{t.download}</a></>}
 </div>;
}

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
   <StoryboardVideoExport key={id+":"+lang} scenes={scenes} lang={lang} onStart={()=>{cancel();setPlaying(false);}}/>
   {!localBooks.length&&<p className="cartoon-notice">{personalCopy[lang].empty}</p>}
  </div>}
 </section>;
}
