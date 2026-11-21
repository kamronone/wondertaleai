import {useCallback,useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";
import {cancelAiJob,listAiJobs,type AiJob,type AiJobStatus} from "./ai_jobs";

const labels={
  ru:{title:"Очередь AI-сказок",hint:"Статусы сохраняются в аккаунте. Сказки доступны в библиотеке после завершения.",refresh:"Обновить",cancel:"Отменить",empty:"Заданий пока нет.",error:"Не удалось получить задания. Проверьте интернет и повторите.",queued:"В очереди",processing:"Создаётся",completed:"Готова",failed:"Ошибка",needs_review:"Требует проверки",unavailable:"Книга удалена",open:"Открыть библиотеку",cancelError:"Отменить можно только задание, которое ещё не началось."},
  uz:{title:"AI ertaklar navbati",hint:"Holatlar akkauntda saqlanadi. Tayyor ertaklar kutubxonada paydo böladi.",refresh:"Yangila",cancel:"Bekor qil",empty:"Hozirça vazifalar yöq.",error:"Vazifalarni yuklab bölmadi. Internetni tekşiring.",queued:"Navbatda",processing:"Yaratilmoqda",completed:"Tayyor",failed:"Xatolik",needs_review:"Tekşiriş kerak",unavailable:"Kitob öçirilgan",open:"Kutubxonani oçiş",cancelError:"Faqat başlanmagan vazifani bekor qiliş mumkin."},
  en:{title:"AI story queue",hint:"Jobs stay in your account. Completed stories appear in your library.",refresh:"Refresh",cancel:"Cancel",empty:"No jobs yet.",error:"Could not load jobs. Check your connection and retry.",queued:"Queued",processing:"Generating",completed:"Completed",failed:"Failed",needs_review:"Needs review",unavailable:"Book deleted",open:"Open library",cancelError:"Only jobs that have not started can be canceled."}
} as const satisfies Record<Lang,Record<string,string>>;

export function AiJobsPanel({api,session,lang,onOpenLibrary,refreshVersion=0}:{
  api:string;session:string;lang:Lang;onOpenLibrary:()=>void;refreshVersion?:number;
}){
  const t=labels[lang];
  const [jobs,setJobs]=useState<AiJob[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busyId,setBusyId]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const epoch=useRef(0);
  const reload=useCallback(async(signal:AbortSignal,expected:number)=>{
    try{
      const entries=await listAiJobs(api,session,signal);
      if(epoch.current===expected){setJobs(entries);setError("");}
    }catch{
      if(!signal.aborted&&epoch.current===expected)setError(t.error);
    }finally{
      if(epoch.current===expected)setLoading(false);
    }
  },[api,session,t.error]);
  useEffect(()=>{
    const controller=new AbortController();
    const current=++epoch.current;
    setJobs([]);setError("");setLoading(true);
    void reload(controller.signal,current);
    return ()=>{++epoch.current;controller.abort();};
  },[reload,revision,refreshVersion]);
  const cancel=async(job:AiJob)=>{
    if(busyId||job.status!=="queued")return;
    const current=epoch.current;
    setBusyId(job.id);setError("");
    try{
      await cancelAiJob(api,session,job.id,AbortSignal.timeout(15000));
      if(epoch.current===current)setRevision(v=>v+1);
    }catch{
      if(epoch.current===current)setError(t.cancelError);
    }finally{
      if(epoch.current===current)setBusyId(null);
    }
  };
  return <section className="ai-jobs-panel" aria-label={t.title}>
    <div className="ai-jobs-head"><div><h3>{t.title}</h3><p>{t.hint}</p></div>
      <button type="button" className="small-button" onClick={()=>setRevision(v=>v+1)} disabled={loading}>{t.refresh}</button>
    </div>
    {loading&&<p role="status">{({ru:"Загрузка…",uz:"Yuklanmoqda…",en:"Loading…"} as const)[lang]}</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&jobs.length===0&&<p>{t.empty}</p>}
    {!loading&&jobs.length>0&&<ul className="ai-jobs-list">
      {jobs.map(job=><li key={job.id}>
        <span className="ai-jobs-status">{t[job.status as AiJobStatus]}</span>
        {job.status==="queued"&&<button type="button" className="small-button" disabled={!!busyId}
          onClick={()=>void cancel(job)}>{t.cancel}</button>}
        {job.status==="completed"&&<button type="button" className="small-button" onClick={onOpenLibrary}>{t.open}</button>}
      </li>)}
    </ul>}
  </section>;
}
