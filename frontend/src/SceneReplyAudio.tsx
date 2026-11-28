import {useEffect,useRef,useState} from "react";
import {Volume2,Square} from "lucide-react";
import type {Lang} from "./i18n";
import {preferredStoryVoice,STORY_SPEECH_LOCALE} from "./reader_voice_choices";

/** Scene dialogue only. Audio requires a direct tap; no automatic playback. */
export function SceneReplyAudio({text,lang,onBeforeSpeak}:{text:string;lang:Lang;onBeforeSpeak:()=>void}){
 const [playing,setPlaying]=useState(false);
 const [unavailable,setUnavailable]=useState(false);
 const current=useRef<SpeechSynthesisUtterance|null>(null);
 const run=useRef(0);
 useEffect(()=>()=> {
   run.current++;
   if(current.current&&"speechSynthesis" in window){
     window.speechSynthesis.cancel();
   }
   current.current=null;
 },[]);
 const toggle=()=>{
   if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
     setUnavailable(true);return;
   }
   const engine=window.speechSynthesis;
   if(playing){
     run.current++;
     current.current=null;
     engine.cancel();
     setPlaying(false);
     return;
   }
   const voice=preferredStoryVoice(engine.getVoices(),lang,null);
   if(!voice){setUnavailable(true);return;}
   onBeforeSpeak();
   const id=++run.current;
   const spoken=new SpeechSynthesisUtterance(text);
   spoken.lang=STORY_SPEECH_LOCALE[lang];
   spoken.voice=voice;
   spoken.rate=.9;
   spoken.onend=()=>{
     if(id!==run.current)return;
     current.current=null;setPlaying(false);
   };
   spoken.onerror=()=>{
     if(id!==run.current)return;
     current.current=null;setPlaying(false);setUnavailable(true);
   };
   try{
     engine.cancel();
     current.current=spoken;
     engine.speak(spoken);
     setPlaying(true);setUnavailable(false);
   }catch{
     current.current=null;setPlaying(false);setUnavailable(true);
   }
 };
 return <div className="wt-scene-reply-controls"
   onPointerDown={event=>event.stopPropagation()}
   onPointerMove={event=>event.stopPropagation()}
   onPointerUp={event=>event.stopPropagation()}
   onTouchStart={event=>event.stopPropagation()}
   onTouchMove={event=>event.stopPropagation()}
   onTouchEnd={event=>event.stopPropagation()}
   onTouchCancel={event=>event.stopPropagation()}>
   <button type="button" aria-pressed={playing} onClick={event=>{event.stopPropagation();toggle();}}>
    {playing?<Square size={15} aria-hidden="true"/>:<Volume2 size={16} aria-hidden="true"/>}
    {playing?({ru:"Остановить ответ",uz:"Javobni töxtatiş",en:"Stop reply"} as const)[lang]
      :({ru:"Озвучить ответ",uz:"Javobni tinglaş",en:"Hear the reply"} as const)[lang]}
   </button>
   {unavailable&&<span role="status">{({ru:"Голос для этого языка недоступен на устройстве.",uz:"Bu til uchun ovoz qurilmada mavjud emas.",en:"No voice for this language is available on this device."} as const)[lang]}</span>}
 </div>;
}
