import {useEffect,useState} from "react";
import type {FormEvent} from "react";
type Promotion={code:string;discount_kind:"percent"|"fixed";discount_value:number;plan_id:string|null;starts_at:string;ends_at:string;max_uses:number;enabled:boolean;reserved:number;used:number};
export default function PromotionAdmin({api,session}:{api:string;session:string}){
 const [items,setItems]=useState<Promotion[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 const [cursor,setCursor]=useState("");
 const endpoint=api+"/api/billing/admin/promotions";
 const headers={Authorization:"Bearer "+session,"Content-Type":"application/json"};
 useEffect(()=>{
  const controller=new AbortController();
  setItems([]);setError("");
  fetch(endpoint+"?limit=50"+(cursor?"&after_code="+encodeURIComponent(cursor):""),{headers:{Authorization:"Bearer "+session},signal:controller.signal,cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error();return r.json();})
   .then(data=>{if(!controller.signal.aborted)setItems(data.items);})
   .catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить акции");});
  return ()=>controller.abort();
 },[endpoint,session,revision,cursor]);
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  const form=e.currentTarget;const d=new FormData(form);
  setBusy(true);setError("");
  try{
   const kind=String(d.get("kind"));
   const value=Number(d.get("value"))*(kind==="fixed"?100:1);
   if(!Number.isSafeInteger(value)||value<=0)throw Error();
   const body={code:String(d.get("code")).trim().toUpperCase(),kind,value,plan_id:d.get("plan")||null,starts_at:new Date(String(d.get("start"))).toISOString(),ends_at:new Date(String(d.get("end"))).toISOString(),max_uses:Number(d.get("limit"))};
   const r=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(body)});
   if(!r.ok)throw Error();form.reset();setCursor("");setRevision(v=>v+1);
  }catch{setError("Не удалось создать промокод. Проверьте данные и права доступа.");}
  finally{setBusy(false);}
 }
 async function toggle(p:Promotion){
  if(busy)return;setBusy(true);setError("");
  try{const r=await fetch(endpoint+"/"+encodeURIComponent(p.code),{method:"PATCH",headers,body:JSON.stringify({enabled:!p.enabled})});if(!r.ok)throw Error();setRevision(v=>v+1);}
  catch{setError("Не удалось изменить статус");}finally{setBusy(false);}
 }
 return <section className="pricing-section"><h2>Управление промокодами</h2><p>Тестовая среда. Реальные платежи отключены.</p>
 <form className="pricing-estimate" onSubmit={create} style={{display:"grid",gap:8}}>
 <label>Промокод<input name="code" required pattern="[A-Za-z0-9_-]{4,32}" maxLength={32}/></label>
 <label>Тип скидки<select name="kind"><option value="percent">Процент</option><option value="fixed">Фиксированная (сум)</option></select></label>
 <label>Размер скидки<input name="value" type="number" min="1" step="1" required/></label>
 <label>Тариф<select name="plan"><option value="">Все платные</option><option value="plus">Plus</option><option value="family">Family</option></select></label>
 <label>Начало (местное время)<input name="start" type="datetime-local" required/></label>
 <label>Окончание (местное время)<input name="end" type="datetime-local" required/></label>
 <label>Лимит активаций<input name="limit" type="number" min="1" max="1000000" required/></label>
 <button className="pricing-compare" disabled={busy}>Создать неактивный промокод</button></form>
 {error&&<p role="alert">{error}</p>}
 <div className="pricing-grid">{items.map(p=><article className="pricing-card" key={p.code}><h3>{p.code}</h3><p>{p.discount_kind==="percent"?p.discount_value+"%":(p.discount_value/100).toLocaleString("ru-RU")+" сум"} · {p.plan_id||"Все платные"}</p><p>Использовано: {p.used}/{p.max_uses} · Резерв: {p.reserved}</p><p>{new Date(p.ends_at).toLocaleString("ru-RU")}</p><button type="button" className="pricing-compare" disabled={busy} onClick={()=>void toggle(p)}>{p.enabled?"Отключить":"Включить"}</button></article>)}</div>
 {cursor&&<button type="button" onClick={()=>setCursor("")}>В начало</button>}
 {items.length===50&&<button type="button" onClick={()=>setCursor(items[items.length-1].code)}>Следующая страница</button>}
 </section>;
}
