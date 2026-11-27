import {useEffect,useState} from "react";
import "./billing-dashboard.css";

type Summary={
 mode:"sandbox";currency:"UZS";amount_unit:"tiyin";
 orders:number;paid_orders:number;gross_minor:number;refund_minor:number;net_minor:number;
 order_conversion:number|null;active_subscriptions:number;monthly_list_value_minor:number;
 active_plans:{plan:string;count:number;monthly_list_value_minor:number}[];
};
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n/100)+" сум";
export default function BillingDashboard({api,token}:{api:string;token:string}){
 const [start,setStart]=useState(()=>day(-29));
 const [end,setEnd]=useState(()=>day(0));
 const [data,setData]=useState<Summary|null>(null);
 const [state,setState]=useState<"loading"|"error"|"ready">("loading");
 useEffect(()=>{
  const controller=new AbortController();
  setData(null);setState("loading");
  const from=new Date(start+"T00:00:00Z"),to=new Date(end+"T00:00:00Z");
  to.setUTCDate(to.getUTCDate()+1);
  if(!token||!api||!Number.isFinite(+from)||!Number.isFinite(+to)||+to<=+from||+to-+from>366*86400000){setState("error");return;}
  const query=new URLSearchParams({start:from.toISOString(),end:to.toISOString()});
  fetch(api.replace(/\/$/,"")+"/api/billing/admin/analytics/summary?"+query,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error("Unavailable");return r.json() as Promise<Summary>;})
   .then(v=>{if(controller.signal.aborted)return;if(v.mode!=="sandbox"||v.currency!=="UZS"||v.amount_unit!=="tiyin"||!Array.isArray(v.active_plans))throw Error("Invalid summary");setData(v);setState("ready");})
   .catch(()=>{if(!controller.signal.aborted)setState("error");});
  return ()=>controller.abort();
 },[api,token,start,end]);
 return <section className="billing-dashboard">
  <h2>Финансовая аналитика</h2>
  <p className="billing-muted">Тестовые операции, не реальные доходы. Период по дате создания заказа (UTC).</p>
  <div className="billing-filters">
   <label>С<input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
   <label>По<input type="date" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label>
   <button type="button" onClick={()=>{setStart(day(-6));setEnd(day(0));}}>7 дней</button>
   <button type="button" onClick={()=>{setStart(day(-29));setEnd(day(0));}}>30 дней</button>
  </div>
  {state==="loading"&&<p role="status">Загрузка…</p>}
  {state==="error"&&<p role="alert">Статистика недоступна. Проверьте доступ и период.</p>}
  {data&&<>
   <div className="billing-metrics">{[
    ["Общий объём",money(data.gross_minor)],["После возвратов",money(data.net_minor)],
    ["Возвраты",money(data.refund_minor)],["Заказы",String(data.orders)],
    ["Оплаченные",String(data.paid_orders)],["Конверсия",data.order_conversion===null?"—":(data.order_conversion*100).toFixed(1)+"%"],
    ["Активные подписки",String(data.active_subscriptions)],["Стоимость активных тарифов",money(data.monthly_list_value_minor)]
   ].map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
   <h3>Активные тарифы на текущий момент</h3>
   {data.active_plans.length===0&&<p>Нет активных подписок</p>}
   {data.active_plans.map(p=><div className="billing-plan-row" key={p.plan}><span>{p.plan}</span><progress max={Math.max(1,data.active_subscriptions)} value={p.count} aria-label={p.plan}/><strong>{p.count}</strong></div>)}
   <p className="billing-muted">Стоимость активных тарифов не является MRR: автопродление отключено.</p>
  </>}
 </section>;
}
