import {useEffect,useState} from "react";
import "./billing-dashboard.css";

type Summary={
 mode:"sandbox";currency:"UZS";amount_unit:"tiyin";
 orders:number;paid_orders:number;gross_minor:number;refund_minor:number;net_minor:number;
 order_conversion:number|null;active_subscriptions:number;monthly_list_value_minor:number;
 daily:{day:string;gross_minor:number;refund_minor:number;net_minor:number;orders:number;paid_orders:number}[];
 active_plans:{plan:string;count:number;monthly_list_value_minor:number}[];
};
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n/100)+" сум";
export default function BillingDashboard({api,token}:{api:string;token:string}){
 const [group,setGroup]=useState<"day"|"month">("day");
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
   .then(v=>{if(controller.signal.aborted)return;if(v.mode!=="sandbox"||v.currency!=="UZS"||v.amount_unit!=="tiyin"||!Array.isArray(v.active_plans)||!Array.isArray(v.daily))throw Error("Invalid summary");setData(v);setState("ready");})
   .catch(()=>{if(!controller.signal.aborted)setState("error");});
  return ()=>controller.abort();
 },[api,token,start,end]);
 const buckets=new Map<string,{gross:number;refund:number;net:number}>();
 for(const d of data?.daily??[]){const key=group==="month"?d.day.slice(0,7):d.day;const b=buckets.get(key)??{gross:0,refund:0,net:0};b.gross+=d.gross_minor;b.refund+=d.refund_minor;b.net+=d.net_minor;buckets.set(key,b);}
 const points=Array.from(buckets.entries()).sort(([a],[b])=>a.localeCompare(b));
 const max=Math.max(1,...points.flatMap(([,p])=>[p.gross,p.refund,Math.abs(p.net)]));
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
   <h3>Динамика заказов</h3>
   <div className="billing-filters"><button type="button" aria-pressed={group==="day"} onClick={()=>setGroup("day")}>По дням</button><button type="button" aria-pressed={group==="month"} onClick={()=>setGroup("month")}>По месяцам</button></div>
   <p className="billing-muted">По дате создания заказа, с учётом текущего состояния. Не денежный поток.</p>
   <div style={{maxHeight:320,overflowY:"auto",display:"grid",gap:10}}>{points.map(([date,p])=><div key={date}><small>{date}</small>{([["Объём",p.gross],["Возвраты",p.refund],["Чистый объём",p.net]] as const).map(([label,value])=><div key={label} className="billing-plan-row"><small>{label}</small><progress max={max} value={Math.abs(value)} aria-label={label}/><small>{money(value)}</small></div>)}</div>)}</div>
   {!points.length&&<p>Нет операций за период</p>}
   <h3>Активные тарифы на текущий момент</h3>
   {data.active_plans.length===0&&<p>Нет активных подписок</p>}
   {data.active_plans.map(p=><div className="billing-plan-row" key={p.plan}><span>{p.plan}</span><progress max={Math.max(1,data.active_subscriptions)} value={p.count} aria-label={p.plan}/><strong>{p.count}</strong></div>)}
   <p className="billing-muted">Стоимость активных тарифов не является MRR: автопродление отключено.</p>
  </>}
 </section>;
}
