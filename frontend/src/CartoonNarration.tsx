import {useEffect,useRef,useState} from "react";
import {Mic,Square,Trash2} from "lucide-react";
import type {Lang} from "./i18n";
import {MAX_NARRATION_BYTES,MAX_NARRATION_SECONDS,narrationFormat,stopNarrationTracks} from "./cartoon_narration";
import "./cartoon-narration.css";

const copy={
 ru:{title:"Голос родителя",note:"Запись остаётся в памяти этой страницы. Начните чтение с первой сцены в порядке экспорта. До 120 секунд.",record:"Записать голос",stop:"Остановить",remove:"Удалить запись",preview:"Прослушать запись",consent:"Разрешаю использовать микрофон для этой записи.",error:"Не удалось записать звук. Проверьте разрешение микрофона.",unsupported:"Запись голоса недоступна в этом браузере.",waiting:"Ожидаем разрешение микрофона",ready:"Запись готова"},
 uz:{title:"Ota-ona ovozi",note:"Yozuv faqat şu sahifa xotirasida qoladi. Eksport tartibidagi birinçi sahnadan öqing. 120 soniyagaça.",record:"Ovoz yoziş",stop:"Töxtatiş",remove:"Yozuvni öçiriş",preview:"Yozuvni tinglaş",consent:"Uşbu yozuv uçun mikrofondan foydalanishga roziman.",error:"Ovoz yozilmadi. Mikrofon ruxsatini tekşiring.",unsupported:"Brauzer ovoz yozişni qöllamaydi.",waiting:"Mikrofon ruxsati kutilmoqda",ready:"Yozuv tayyor"},
 en:{title:"Parent narration",note:"Recording stays in this page's memory. Read from the first scene in export order. Up to 120 seconds.",record:"Record voice",stop:"Stop",remove:"Delete recording",preview:"Listen to recording",consent:"I allow microphone access for this recording.",error:"Could not record audio. Check microphone permission.",unsupported:"Voice recording is unavailable in this browser.",waiting:"Waiting for microphone permission",ready:"Recording ready"}
} as const;

export default function CartoonNarration({lang,disabled,blob,onChange,onStart,onActivity}:{
 lang:Lang;disabled:boolean;blob:Blob|null;onChange:(blob:Blob|null)=>void;onStart:()=>void;onActivity:(active:boolean)=>void
}){
 const t=copy[lang],format=narrationFormat();
 const supported=Boolean(format&&navigator.mediaDevices?.getUserMedia&&typeof AudioContext!=="undefined");
 const [consent,setConsent]=useState(false);
 const [phase,setPhase]=useState<"idle"|"waiting"|"recording">("idle");
 const [seconds,setSeconds]=useState(0);
 const [error,setError]=useState(false);
 const [preview,setPreview]=useState<string|null>(null);
 const active=useRef<{stream:MediaStream|null;recorder:MediaRecorder|null;timer:number|null;cancelled:boolean}|null>(null);
 const activity=useRef(onActivity);activity.current=onActivity;
 const stop=(discard=false)=>{
  const job=active.current;if(!job)return;
  job.cancelled=job.cancelled||discard;
  if(job.timer!==null){window.clearInterval(job.timer);job.timer=null;}
  if(job.recorder?.state==="recording"){try{job.recorder.stop();}catch{job.cancelled=true;active.current=null;setPhase("idle");activity.current(false);}}
  else{active.current=null;setPhase("idle");activity.current(false);}
  stopNarrationTracks(job.stream);job.stream=null;
 };
 useEffect(()=>{
  const hide=()=>{if(document.hidden)stop(true);};
  document.addEventListener("visibilitychange",hide);
  return ()=>{
   document.removeEventListener("visibilitychange",hide);
   const job=active.current;active.current=null;
   if(job){job.cancelled=true;if(job.timer!==null)window.clearInterval(job.timer);
    try{if(job.recorder?.state==="recording")job.recorder.stop();}catch{}
    stopNarrationTracks(job.stream);}
   activity.current(false);
  };
 },[]);
 useEffect(()=>{
  if(!blob){setPreview(null);return;}
  const url=URL.createObjectURL(blob);setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[blob]);
 async function start(){
  if(active.current||!supported||!format||!consent||disabled||document.hidden)return;
  const job={stream:null,recorder:null,timer:null,cancelled:false} as NonNullable<typeof active.current>;
  active.current=job;onStart();activity.current(true);setPhase("waiting");setSeconds(0);setError(false);
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(active.current!==job||job.cancelled||document.hidden){stopNarrationTracks(stream);if(active.current===job){active.current=null;setPhase("idle");activity.current(false);}return;}
   job.stream=stream;
   const recorder=new MediaRecorder(stream,{mimeType:format,audioBitsPerSecond:64000});
   job.recorder=recorder;
   const chunks:Blob[]=[];let bytes=0;
   recorder.ondataavailable=e=>{if(job.cancelled||!e.data.size)return;bytes+=e.data.size;if(bytes>MAX_NARRATION_BYTES){job.cancelled=true;stop(true);return;}chunks.push(e.data);};
   recorder.onerror=()=>{if(active.current===job){setError(true);stop(true);}};
   recorder.onstop=()=>{
    stopNarrationTracks(job.stream);job.stream=null;
    if(job.timer!==null)window.clearInterval(job.timer);
    if(active.current!==job)return;
    active.current=null;setPhase("idle");activity.current(false);
    if(job.cancelled)return;
    const result=new Blob(chunks,{type:recorder.mimeType||format});
    if(result.size&&result.size<=MAX_NARRATION_BYTES){onChange(result);}else setError(true);
   };
   recorder.start(250);
   const started=performance.now();setPhase("recording");
   job.timer=window.setInterval(()=>{
    const elapsed=Math.min(MAX_NARRATION_SECONDS,Math.floor((performance.now()-started)/1000));
    setSeconds(elapsed);
    if(elapsed>=MAX_NARRATION_SECONDS)stop();
   },200);
  }catch{
   stopNarrationTracks(job.stream);if(active.current!==job)return;
   active.current=null;setPhase("idle");activity.current(false);setError(true);
  }
 }
 return <details className="wt-narration">
  <summary>{t.title}</summary>
  <p className="cartoon-notice">{supported?t.note:t.unsupported}</p>
  {supported&&<>
   <label className="wt-narration-consent"><input type="checkbox" checked={consent} disabled={disabled||phase!=="idle"} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
   <div className="wt-narration-actions">
    {phase==="idle"?<button type="button" className="secondary-button" disabled={disabled||!consent} onClick={()=>void start()}><Mic size={16}/>{t.record}</button>:<button type="button" className="secondary-button" onClick={()=>stop(phase==="waiting")}><Square size={15}/>{t.stop}</button>}
    {blob&&<button type="button" className="icon-button" aria-label={t.remove} disabled={disabled||phase!=="idle"} onClick={()=>onChange(null)}><Trash2 size={16}/></button>}
    {phase==="recording"&&<span role="status">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</span>}
   </div>
   {phase==="waiting"&&<p role="status">{t.waiting}</p>}
   {preview&&blob&&phase==="idle"&&<><p className="cartoon-notice">{t.ready}</p><audio src={preview} controls preload="metadata" aria-label={t.preview}/></>}
   {error&&<p role="alert" className="cartoon-notice">{t.error}</p>}
  </>}
 </details>;
}
