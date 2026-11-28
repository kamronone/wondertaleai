import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Lang } from "./i18n";

type Child={id:string;nickname:string;age:number;created_at:string};
type Props={api:string;session:string;lang:Lang};
const copy={
 ru:{title:"Детские профили",info:"До 5 профилей в семейном аккаунте. Доступны только родителю.",name:"Имя или псевдоним",age:"Возраст",add:"Добавить",remove:"Удалить",confirm:"Удалить этот профиль?",empty:"Пока нет детских профилей.",error:"Не удалось обновить профили. Проверьте подключение.",limit:"Можно создать не более пяти профилей.",loading:"Загрузка…",retry:"Повторить",saving:"Сохраняем…"},
 uz:{title:"Bolalar profillari",info:"Oilaviy akkauntda 5 tagacha profil. Faqat ota-onaga oçiq.",name:"Ism yoki taxallus",age:"Yoş",add:"Qöşiş",remove:"Öçiriş",confirm:"Bu profil öçirilsinmi?",empty:"Hali bolalar profili yöq.",error:"Profillarni yangilab bölmadi. Ulanişni tekşiring.",limit:"Besta profil yaratiş mumkin.",loading:"Yuklanmoqda…",retry:"Qayta uriniş",saving:"Saqlanmoqda…"},
 en:{title:"Child profiles",info:"Up to 5 profiles per family account. Parent access only.",name:"Name or nickname",age:"Age",add:"Add child",remove:"Remove",confirm:"Remove this profile?",empty:"No child profiles yet.",error:"Could not update profiles. Check your connection.",limit:"Up to five profiles are allowed.",loading:"Loading…",retry:"Retry",saving:"Saving…"}
} as const;

export function FamilyProfiles({api,session,lang}:Props){
 const t=copy[lang];
 const [children,setChildren]=useState<Child[]>([]);
 const [nickname,setNickname]=useState("");
 const [age,setAge]=useState(6);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const requestEpoch=useRef(0);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch(api+"/api/children",{headers:{Authorization:"Bearer "+session},cache:"no-store",signal:signal??AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("Child profiles unavailable");
  const rows:unknown=await response.json();
  if(!Array.isArray(rows))throw Error("Invalid child profiles");
  return rows.filter((row):row is Child=>row&&typeof row.id==="string"&&typeof row.nickname==="string"&&Number.isInteger(row.age));
 },[api,session]);
 useEffect(()=>{
  const controller=new AbortController();
  const epoch=++requestEpoch.current;
  const timeout=window.setTimeout(()=>controller.abort(),15000);
  setLoading(true);setError(false);setChildren([]);
  void refresh(controller.signal).then(rows=>{if(requestEpoch.current===epoch)setChildren(rows);}).catch(()=>{if(requestEpoch.current===epoch)setError(true);}).finally(()=>{window.clearTimeout(timeout);if(requestEpoch.current===epoch)setLoading(false);});
  return ()=>{++requestEpoch.current;window.clearTimeout(timeout);controller.abort();};
 },[refresh,attempt]);
 const add=async(event:FormEvent)=>{
  event.preventDefault();
  if(busy||loading||error||children.length>=5||!nickname.trim()||age<2||age>14)return;
  setBusy(true);
  const epoch=requestEpoch.current;
  try{
   const response=await fetch(api+"/api/children",{method:"POST",headers:{Authorization:"Bearer "+session,"Content-Type":"application/json"},body:JSON.stringify({nickname:nickname.trim(),age}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error("Create failed");
   const rows=await refresh();
   if(requestEpoch.current===epoch){setChildren(rows);setNickname("");setError(false);}
  }catch{if(requestEpoch.current===epoch)setError(true);}finally{if(requestEpoch.current===epoch)setBusy(false);}
 };
 const remove=async(child:Child)=>{
  if(busy||!window.confirm(t.confirm))return;
  setBusy(true);
  const epoch=requestEpoch.current;
  try{
   const response=await fetch(api+"/api/children/"+encodeURIComponent(child.id),{method:"DELETE",headers:{Authorization:"Bearer "+session},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error("Delete failed");
   const rows=await refresh();
   if(requestEpoch.current===epoch){setChildren(rows);setError(false);}
  }catch{if(requestEpoch.current===epoch)setError(true);}finally{if(requestEpoch.current===epoch)setBusy(false);}
 };
 return <div className="parent-account-card" aria-label={t.title}>
  <h3>{t.title}</h3><p className="parent-account-muted">{t.info}</p>
  {loading?<p role="status">{t.loading}</p>:error?<div role="alert"><p className="parent-account-error">{t.error}</p><button type="button" className="parent-account-secondary" onClick={()=>setAttempt(n=>n+1)} disabled={busy}>{t.retry}</button></div>:<>
   {children.length===0?<p className="parent-account-muted">{t.empty}</p>:<ul>{children.map(child=><li key={child.id}><span>{child.nickname} · {child.age}</span> <button type="button" className="parent-account-secondary" disabled={busy} onClick={()=>void remove(child)}>{t.remove}</button></li>)}</ul>}
   {children.length<5?<form onSubmit={add}>
    <label>{t.name}<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={45} required autoComplete="off"/></label>
    <label>{t.age}<input type="number" min={2} max={14} value={age} onChange={e=>setAge(Number(e.target.value))} required/></label>
    <button type="submit" className="parent-account-primary" disabled={busy||!nickname.trim()}>{busy?t.saving:t.add}</button>
   </form>:<p className="parent-account-muted">{t.limit}</p>}
  </>}
 </div>;
}
