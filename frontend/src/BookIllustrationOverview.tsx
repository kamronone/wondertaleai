import {useEffect,useState} from "react";
import {loadBookIllustrationStatuses,type PageIllustrationStatus} from "./private_illustration";
import type {Lang} from "./i18n";

const copy={
 ru:{title:"Иллюстрации книги",loading:"Проверяем страницы…",available:"Изображение доступно",missing:"Нет изображения",pending_review:"Ожидает проверки",needs_review:"Нужна проверка",error:"Не удалось проверить",refresh:"Обновить статусы",page:"Страница",note:"По данным сервера. Изображение проверяется при открытии страницы; обновление не запускает генерацию."},
 uz:{title:"Kitob rasmlari",loading:"Sahifalar tekşirilmoqda…",available:"Rasm mavjud",missing:"Rasm yoq",pending_review:"Tekşiruv kutilmoqda",needs_review:"Tekşiriş kerak",error:"Tekşirib bölmadi",refresh:"Holatni yangilaş",page:"Sahifa",note:"Server ma’lumotlari. Rasm sahifa oçilganda tekşiriladi; yangilaş generatsiyani işga tuşirmaydi."},
 en:{title:"Book illustrations",loading:"Checking pages…",available:"Image available",missing:"No image",pending_review:"Awaiting review",needs_review:"Review required",error:"Could not check",refresh:"Refresh statuses",page:"Page",note:"Server metadata only. Images are checked when opened; refreshing does not start generation."}
} as const;
const symbols:Record<PageIllustrationStatus,string>={available:"✓",missing:"·",pending_review:"…",needs_review:"!",error:"?"};
export function BookIllustrationOverview({api,session,bookId,pageCount,lang,onPage}:{
 api:string;session:string;bookId:string;pageCount:number;lang:Lang;onPage:(page:number)=>void;
}){
 const [open,setOpen]=useState(false);
 const [version,setVersion]=useState(0);
 const [statuses,setStatuses]=useState<PageIllustrationStatus[]|null>(null);
 const t=copy[lang];
 useEffect(()=>{
  setStatuses(null);
  if(!open)return;
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),20000);
  void loadBookIllustrationStatuses(api,session,bookId,pageCount,controller.signal)
    .then(result=>{if(!controller.signal.aborted)setStatuses(result);})
    .catch(()=>{if(!controller.signal.aborted)setStatuses(Array.from({length:pageCount},()=>"error" as const));})
    .finally(()=>window.clearTimeout(timer));
  // Timeout is a failed check, not an indefinitely loading indicator.
  const onAbort=()=>setStatuses(Array.from({length:pageCount},()=>"error" as const));
  controller.signal.addEventListener("abort",onAbort,{once:true});
  return ()=>{window.clearTimeout(timer);controller.signal.removeEventListener("abort",onAbort);controller.abort();};
 },[api,session,bookId,pageCount,open,version]);
 return <details className="book-illustration-overview" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{t.title}</summary>
  {open&&<div className="illustration-overview-body">
   {!statuses?<p role="status">{t.loading}</p>:<>
    <p role="status">{t.available}: {statuses.filter(status=>status==="available").length}/{pageCount}</p>
    <div className="illustration-overview-grid">
     {statuses.map((status,i)=><button key={i} type="button" data-status={status} aria-label={t.page+" "+(i+1)+": "+t[status]} onClick={()=>onPage(i+1)}>{i+1}<span aria-hidden="true">{symbols[status]}</span></button>)}
    </div>
    <div className="illustration-overview-legend">{(Object.keys(symbols) as PageIllustrationStatus[]).map(status=><span key={status}>{symbols[status]} {t[status]}</span>)}</div>
    <p>{t.note}</p>
   </>}
   <button type="button" className="illustration-overview-refresh" disabled={!statuses} onClick={()=>setVersion(v=>v+1)}>{t.refresh}</button>
  </div>}
 </details>;
}
