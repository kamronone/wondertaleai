import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

const copy={
  ru:{title:"Время чтения",intro:"Таймер сеанса",start:"Начать",pause:"Пауза",resume:"Продолжить",reset:"Сбросить",ready:"Выберите время для чтения.",finished:"Время чтения закончилось. Сделайте перерыв!",remaining:"Осталось",note:"Таймер только напоминает о перерыве и не блокирует приложение.",minute:"мин"},
  uz:{title:"Oqish vaqti",intro:"Oqish taymeri",start:"Boshlash",pause:"Pauza",resume:"Davom ettirish",reset:"Qayta boshlash",ready:"Oqish vaqtini tanlang.",finished:"Oqish vaqti tugadi. Tanaffus qiling!",remaining:"Qoldi",note:"Taymer faqat eslatadi, ilovani bloklamaydi.",minute:"daq"},
  en:{title:"Reading time",intro:"Session timer",start:"Start",pause:"Pause",resume:"Resume",reset:"Reset",ready:"Choose a reading session.",finished:"Reading time is up. Take a break!",remaining:"Remaining",note:"This is a reminder, not an app restriction.",minute:"min"}
} as const;

/** A foreground reading reminder; no account data, no persistence and no access restriction. */
export function ReadingSessionTimer({lang}:{lang:Lang}){
  const [minutes,setMinutes]=useState<5|10|15|20>(10);
  const [remaining,setRemaining]=useState(10*60);
  const [running,setRunning]=useState(false);
  const [deadline,setDeadline]=useState<number|null>(null);
  const [finished,setFinished]=useState(false);
  const t=copy[lang];
  useEffect(()=>{
    if(!running||deadline===null)return;
    const tick=()=>{
      const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
      setRemaining(seconds);
      if(seconds===0){setRunning(false);setDeadline(null);setFinished(true);}
    };
    tick();
    const interval=window.setInterval(tick,1000);
    document.addEventListener("visibilitychange",tick);
    return ()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",tick);};
  },[running,deadline]);
  const reset=(count:5|10|15|20=minutes)=>{
    setMinutes(count);setRemaining(count*60);setRunning(false);setDeadline(null);setFinished(false);
  };
  const toggle=()=>{
    if(running){
      if(deadline!==null)setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
      setRunning(false);setDeadline(null);
    }else if(remaining>0){
      setFinished(false);setDeadline(Date.now()+remaining*1000);setRunning(true);
    }
  };
  const clock=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(remaining%60).padStart(2,"0")}`;
  return <section className="reading-session-timer" aria-label={t.title}>
    <div className="reading-session-top"><strong>{t.title}</strong><span aria-label={t.remaining+" "+clock} aria-live="off">{clock}</span></div>
    <div className="reading-session-duration" role="group" aria-label={t.intro}>
      {([5,10,15,20] as const).map(n=><button key={n} type="button" aria-pressed={minutes===n} onClick={()=>reset(n)}>{n} {t.minute}</button>)}
    </div>
    <div className="reading-session-actions">
      <button type="button" onClick={toggle} disabled={finished}>{running?t.pause:remaining<minutes*60?t.resume:t.start}</button>
      <button type="button" onClick={()=>reset()}>{t.reset}</button>
    </div>
    {finished?<p className="reading-session-finished" role="status">{t.finished}</p>:!running&&remaining===minutes*60?<p>{t.ready}</p>:null}
    <small>{t.note}</small>
  </section>;
}
