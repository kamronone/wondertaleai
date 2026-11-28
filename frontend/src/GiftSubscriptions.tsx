import { useState } from "react";
import GiftCardEditor from "./GiftCardEditor";

type Lang = "ru" | "uz" | "en";
const labels = {
  ru: ["Подарочные подписки","Купить подарок","Активировать код","Купленные","Полученные","Перевыпустить код","Тестовый режим. Реальной оплаты нет.","Операция недоступна","Код активирован","Загрузить историю","Далее","Скопируйте код и сохраните его"],
  uz: ["Sovğa obunalari","Sovğa oliş","Kodni faollaştiriş","Sotib olingan","Qabul qilingan","Kodni yangilaş","Sinov rejimi. Haqiqiy to‘lov yo‘q.","Amal mavjud emas","Kod faollaştirildi","Tarixni yuklaş","Keyingi","Kodni nusxalab saqlang"],
  en: ["Gift subscriptions","Buy a gift","Redeem code","Purchased","Received","Replace code","Test mode. No real payment.","Operation unavailable","Code redeemed","Load history","Next","Copy and save your code"]
};
type Gift = {gift_id:string;plan_id:string;state:string;can_rotate?:boolean;amount_minor?:number};
type Cursor = {before_time:string;before_id:string};
export default function GiftSubscriptions({lang,api,token}:{lang:Lang;api:string;token:string}) {
  const t=labels[lang];
  const [plan,setPlan]=useState<"plus"|"family">("plus");
  const [code,setCode]=useState("");
  const [issued,setIssued]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [items,setItems]=useState<Gift[]>([]);
  const [direction,setDirection]=useState<"purchased"|"received">("purchased");
  const [cursor,setCursor]=useState<Cursor|null>(null);
  const [requestKey,setRequestKey]=useState("");
  async function call(path:string,body?:object) {
    const res=await fetch(api.replace(/\/$/,"")+"/api/billing/gifts"+path,{
      method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      body:body?JSON.stringify(body):undefined,cache:"no-store"
    });
    if(!res.ok) throw new Error("Gift operation failed");
    return res.json();
  }
  async function run(fn:()=>Promise<void>) {
    if(busy)return;
    setBusy(true);setMessage("");
    try{await fn();}catch{setMessage(t[7]);}finally{setBusy(false);}
  }
  function load(next=false) {
    void run(async()=>{
      const query=new URLSearchParams({direction});
      if(next&&cursor){query.set("before_time",cursor.before_time);query.set("before_id",cursor.before_id);}
      const result=await call("?"+query.toString());
      setItems(old=>next?[...old,...result.items]:result.items);setCursor(result.next_cursor);
    });
  }
  return <section className="gift-subscriptions" style={{display:"grid",gap:12}}>
    <h2>{t[0]}</h2><small>{t[6]}</small>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <select aria-label={t[1]} value={plan} disabled={busy} onChange={e=>{setPlan(e.target.value as "plus"|"family");setRequestKey("");}}>
        <option value="plus">Plus · 39 000 UZS</option><option value="family">Family · 79 000 UZS</option>
      </select>
      <button disabled={busy||!token} onClick={()=>void run(async()=>{
        const key=requestKey||crypto.randomUUID();setRequestKey(key);
        const result=await call("/orders",{plan_id:plan,request_key:key});
        setIssued(result.code||"");setRequestKey("");
      })}>{t[1]}</button>
    </div>
    <GiftCardEditor lang={lang} plan={plan}/>
    {issued&&<div><small>{t[11]}</small><input readOnly value={issued} onFocus={e=>e.target.select()} style={{width:"100%",boxSizing:"border-box"}}/></div>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <input aria-label={t[2]} value={code} maxLength={43} autoComplete="off" spellCheck={false} onChange={e=>setCode(e.target.value)} style={{minWidth:0,flex:1}}/>
      <button disabled={busy||!token||code.trim().length!==43} onClick={()=>void run(async()=>{await call("/redeem",{code:code.trim()});setCode("");setMessage(t[8]);})}>{t[2]}</button>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <select aria-label={t[9]} value={direction} disabled={busy} onChange={e=>{setDirection(e.target.value as "purchased"|"received");setItems([]);setCursor(null);}}>
        <option value="purchased">{t[3]}</option><option value="received">{t[4]}</option>
      </select>
      <button disabled={busy||!token} onClick={()=>load()}>{t[9]}</button>
    </div>
    {items.map(g=><div key={g.gift_id} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <span>{g.plan_id.toUpperCase()} · {g.state}</span>
      {g.can_rotate&&<button disabled={busy} onClick={()=>void run(async()=>{const result=await call("/"+encodeURIComponent(g.gift_id)+"/rotate",{});setIssued(result.code);})}>{t[5]}</button>}
    </div>)}
    {cursor&&<button disabled={busy} onClick={()=>load(true)}>{t[10]}</button>}
    <div role="status">{message}</div>
  </section>;
}
