import { useState } from "react";
import type { Lang } from "./i18n";

const labels={
  ru:{open:"Все страницы",close:"Скрыть страницы",jump:"Перейти к странице",page:"Страница",current:"Сейчас открыта",empty:"В книге пока нет страниц"},
  uz:{open:"Barcha sahifalar",close:"Sahifalarni yashirish",jump:"Sahifaga otish",page:"Sahifa",current:"Hozir ochiq",empty:"Kitobda sahifalar yoq"},
  en:{open:"All pages",close:"Hide pages",jump:"Go to page",page:"Page",current:"Current page",empty:"There are no pages in this book"}
} as const;

/** Works only with page counts and positions, never copies book text or images. */
export function ReaderPageIndex({lang,total,page,onChange}:{
  lang:Lang;total:number;page:number;onChange:(index:number)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  const t=labels[lang];
  const count=Number.isFinite(total)?Math.max(0,Math.min(100,Math.floor(total))):0;
  if(count<=1)return null;
  return <nav className="reader-page-index" aria-label={t.jump}>
    <button type="button" className="reader-index-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?t.close:t.open}<span>{Math.min(count,Math.max(1,page+1))} / {count}</span>
    </button>
    {expanded&&<div className="reader-index-grid" role="group" aria-label={t.jump}>
      {Array.from({length:count},(_,i)=>
        <button key={i} type="button" aria-label={t.page+" "+(i+1)+(i===page?", "+t.current:"")}
          aria-current={i===page?"page":undefined}
          onClick={()=>{onChange(i);setExpanded(false);}}>{i+1}</button>
      )}
    </div>}
  </nav>;
}
