import { useState } from "react";
import type { Lang } from "./i18n";

const copy={
  ru:{title:"Рекомендации для родителей",desc:"Подсказки для выбора книг по возрасту. Это не блокировка доступа и не замена родительского контроля.",age:"Возраст ребёнка",guide:"Совет по чтению",time:"Продолжительность",privacy:"Эти настройки работают только на открытой странице, не передаются на сервер и не изменяют аккаунт.",tips:["Читайте вместе, обсуждайте иллюстрации и выбирайте короткие истории.","Предлагайте ребёнку пересказывать сказку и объяснять поступки героев.","Обсуждайте выбор героев и попросите придумать свою концовку."],times:["5–10 минут","10–15 минут","15–20 минут"]},
  uz:{title:"Ota-onalar uchun tavsiyalar",desc:"Yoshga qarab kitob tanlashga yordam. Bu kirishni bloklamaydi va ota-ona nazorati emas.",age:"Bola yoshi",guide:"Oqish tavsiyasi",time:"Davomiyligi",privacy:"Bu tanlovlar faqat ochiq sahifada ishlaydi, serverga yuborilmaydi va akkauntni ozgartirmaydi.",tips:["Birga oqing, rasmlarni muhokama qiling va qisqa ertaklarni tanlang.","Bola ertakni qayta aytsin va qahramonlar harakatini tushuntirsin.","Qahramonlar tanlovini muhokama qiling va yangi yakun oylab toping."],times:["5–10 daqiqa","10–15 daqiqa","15–20 daqiqa"]},
  en:{title:"Parent reading guide",desc:"Age-based suggestions for choosing stories. This does not restrict access or replace parental controls.",age:"Child's age",guide:"Reading tip",time:"Suggested session",privacy:"These choices live only on this open page. They are not sent to the server or saved to the account.",tips:["Read together, talk about pictures and choose short stories.","Invite your child to retell the story and explain the characters' choices.","Discuss decisions in the story and invent an alternative ending."],times:["5–10 minutes","10–15 minutes","15–20 minutes"]}
} as const;
export function ParentReadingGuide({lang}:{lang:Lang}){
  const [age,setAge]=useState(5);
  const t=copy[lang];
  const index=age<6?0:age<9?1:2;
  return <section className="parent-reading-guide" aria-label={t.title}>
    <h3>{t.title}</h3>
    <p>{t.desc}</p>
    <label>{t.age}
      <select value={age} onChange={event=>setAge(Number(event.target.value))}>
        {Array.from({length:13},(_,i)=>i+2).map(years=><option key={years} value={years}>{years}</option>)}
      </select>
    </label>
    <div className="parent-reading-advice"><strong>{t.guide}</strong><p>{t.tips[index]}</p><strong>{t.time}</strong><p>{t.times[index]}</p></div>
    <small>{t.privacy}</small>
  </section>;
}
