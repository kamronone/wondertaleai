import {useEffect,useRef,useState} from "react";
import {BookOpen,ArrowRight,ChevronDown} from "lucide-react";
import type {Lang} from "./i18n";
import type {RemoteBook} from "./private_library";
import "./private-sequel.css";

type Count=8|12|20;
export type SequelAttempt={key:string;idea:string;count:Count;state:"pending"|"review"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const copy={
 ru:{title:"Создать продолжение",idea:"Что произойдёт дальше?",hint:"Новая часть сохранится отдельной книгой.",length:"Страниц",consent:"Я родитель или законный представитель и разрешаю передать текст предыдущей сказки и новые пожелания AI-провайдеру.",start:"Создать новую часть",busy:"Создаём продолжение…",check:"Проверить результат",pending:"Запрос уже отправлен. Проверьте результат, прежде чем создавать новый.",review:"Результат требует проверки. Повторная генерация отключена.",missing:"Результат пока не найден. Проверьте снова позже.",error:"Не удалось проверить результат. Попробуйте позже.",unavailable:"Генерация недоступна для этого аккаунта.",limit:"Дневной лимит исчерпан.",invalid:"Проверьте описание и данные книги.",offline:"Для продолжения нужен интернет.",previous:"Предыдущая часть",next:"Следующая часть"},
 uz:{title:"Davomini yaratiş",idea:"Keyin nima böladi?",hint:"Yangi qism alohida kitob sifatida saqlanadi.",length:"Sahifalar",consent:"Men ota-ona yoki qonuniy vakilman va avvalgi ertak matni hamda yangi istaklarni AI xizmatiga yuborişga roziman.",start:"Yangi qism yaratiş",busy:"Davomi yaratilmoqda…",check:"Natijani tekşiriş",pending:"Sörov yuborildi. Yangi qism yaratişdan oldin natijani tekşiring.",review:"Natijani tekşiriş kerak. Qayta yaratiş öçirilgan.",missing:"Natija hali topilmadi. Keyinroq tekşiring.",error:"Natijani tekşirib bölmadi. Keyinroq urinib köring.",unavailable:"Bu akkaunt uçun AI mavjud emas.",limit:"Kunlik limit tugadi.",invalid:"Tavsif va kitob ma’lumotlarini tekşiring.",offline:"Davom uçun internet kerak.",previous:"Avvalgi qism",next:"Keyingi qism"},
 en:{title:"Create a sequel",idea:"What happens next?",hint:"The next part will be saved as a separate book.",length:"Pages",consent:"I am a parent or legal guardian and consent to sending the previous story text and new instructions to the AI provider.",start:"Create next part",busy:"Creating the sequel…",check:"Check result",pending:"Request submitted. Check the result before creating another.",review:"The result requires review. Repeat generation is disabled.",missing:"The result is not available yet. Check again later.",error:"Could not check the result. Try again later.",unavailable:"Generation is unavailable for this account.",limit:"Daily limit reached.",invalid:"Check the description and book details.",offline:"Internet is required for a sequel.",previous:"Previous part",next:"Next part"}
} as const;

export function PrivateSequel({api,session,book,lang,attempts,onCreated,onOpen,previous,next}:{
 api:string;session:string;book:RemoteBook;lang:Lang;attempts:Map<string,SequelAttempt>;
 onCreated:(book:RemoteBook)=>void;onOpen:(book:RemoteBook)=>void;previous?:RemoteBook;next:RemoteBook[];
}){
 const t=copy[lang];
 const [idea,setIdea]=useState(()=>attempts.get(book.id)?.idea??"");
 const [count,setCount]=useState<Count>(()=>attempts.get(book.id)?.count??8);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<keyof typeof t|null>(null);
 const [attempt,setAttempt]=useState(()=>attempts.get(book.id));
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const remember=(value:SequelAttempt|undefined)=>{
   if(value)attempts.set(book.id,value);else attempts.delete(book.id);
   setAttempt(value);
 };
 const run=async(checkOnly:boolean)=>{
   if(controller.current||!navigator.onLine){if(!navigator.onLine)setNotice("offline");return;}
   const old=attempts.get(book.id);
   if(checkOnly&&!old)return;
   if(!checkOnly&&(old||!consent||idea.trim().length<12||idea.trim().length>1200))return;
   const current:SequelAttempt=old??{key:crypto.randomUUID(),idea:idea.trim(),count,state:"pending"};
   const c=new AbortController();controller.current=c;setBusy(true);setNotice(null);
   if(!old)remember(current);
   const request=(path:string,init?:RequestInit)=>fetch(api+path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+session,"Content-Type":"application/json",...init?.headers},signal:AbortSignal.any([c.signal,AbortSignal.timeout(checkOnly?15000:120000)])});
   try{
     if(checkOnly){
       const response=await request("/api/books/generation-requests/"+encodeURIComponent(current.key));
       if(c.signal.aborted)return;
       if(response.status===404){setNotice("missing");return;}
       if(!response.ok){setNotice("error");return;}
       const status=await response.json();
       if(c.signal.aborted)return;
       if(status.status==="needs_review"||status.status==="unavailable"){
         remember({...current,state:"review"});setNotice("review");return;
       }
       if(status.status!=="completed"||typeof status.book_id!=="string"||!UUID.test(status.book_id)){setNotice("pending");return;}
       const saved=await request("/api/books/"+status.book_id);
       if(!saved.ok)throw Error("Missing saved sequel");
       const row=await saved.json();
       if(c.signal.aborted)return;
       const story=JSON.parse(row.story);
       if(story.continuation_of!==book.id)throw Error("Invalid sequel relationship");
       const result={id:row.id,title:row.title,pages:story.pages,created_at:row.created_at,continuation_of:story.continuation_of};
       complete(result,current);
     }else{
       const response=await request("/api/books/"+encodeURIComponent(book.id)+"/continue",{
         method:"POST",headers:{"Idempotency-Key":current.key},
         body:JSON.stringify({idea:current.idea,pages_count:current.count,acknowledged_story_transfer:true})
       });
       if(c.signal.aborted)return;
       if(!response.ok){
         // Only unambiguous pre-provider rejections unlock the form.
         if([401,403,404,422,429].includes(response.status)){
           remember(undefined);setConsent(false);
           setNotice(response.status===429?"limit":response.status===422?"invalid":"unavailable");
         }else setNotice("pending");
         return;
       }
       const result=await response.json();
       if(c.signal.aborted)return;
       complete(result,current);
     }
   }catch{if(!c.signal.aborted)setNotice("pending");}
   finally{if(controller.current===c){controller.current=null;if(!c.signal.aborted)setBusy(false);}}
 };
 function complete(raw:unknown,current:SequelAttempt){
   if(!raw||typeof raw!=="object")throw Error("Invalid sequel");
   const value=raw as {id?:unknown;title?:unknown;pages?:unknown;created_at?:unknown;continuation_of?:unknown};
   if(typeof value.id!=="string"||!UUID.test(value.id)||value.id===book.id||value.continuation_of!==book.id||
      typeof value.title!=="string"||!value.title.trim()||value.title.length>120||!Array.isArray(value.pages)||
      value.pages.length!==current.count||!value.pages.every((p,i)=>p&&p.number===i+1&&typeof p.text==="string"&&p.text.trim().length>=70&&p.text.length<=1200))
      throw Error("Invalid sequel response");
   const validatedPages=value.pages as {text:string}[];
   const created:RemoteBook={id:value.id,title:value.title,created_at:typeof value.created_at==="string"?value.created_at:new Date().toISOString(),
     name:book.name,age:book.age,theme:"",prompt:current.idea,style:book.style,language:book.language,
     mode:"private-account",pages:validatedPages.map((p,i)=>({number:i+1,text:p.text,image_url:""})),
     continuationOf:book.id,lastPage:0,favorite:false};
   remember(undefined);onCreated(created);
 }
 return <div className="wt-private-sequel">
   {(previous||next.length>0)&&<div className="wt-series-links">
     {previous&&<button type="button" onClick={()=>onOpen(previous)}><BookOpen size={15}/><span>{t.previous}<strong>{previous.title}</strong></span><ArrowRight size={15}/></button>}
     {next.map(item=><button key={item.id} type="button" onClick={()=>onOpen(item)}><BookOpen size={15}/><span>{t.next}<strong>{item.title}</strong></span><ArrowRight size={15}/></button>)}
   </div>}
   <details open={attempt?true:undefined} className="wt-sequel-details">
     <summary><BookOpen size={17}/>{t.title}<ChevronDown size={16}/></summary>
     <p>{t.hint}</p>
     {!attempt&&<><label>{t.idea}<textarea rows={3} maxLength={1200} value={idea} onChange={e=>setIdea(e.target.value)}/></label>
     <label>{t.length}<select value={count} onChange={e=>setCount(Number(e.target.value) as Count)}>{([8,12,20] as const).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     <label className="wt-sequel-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
     <button type="button" className="primary-button wt-sequel-submit" disabled={busy||!consent||idea.trim().length<12} onClick={()=>void run(false)}>{busy?t.busy:t.start}</button></>}
     {attempt&&<><p role="status">{t[attempt.state==="review"?"review":"pending"]}</p><button type="button" className="small-button wt-sequel-submit" disabled={busy} onClick={()=>void run(true)}>{busy?t.busy:t.check}</button></>}
     {notice&&<p role="status">{t[notice]}</p>}
   </details>
 </div>;
}
