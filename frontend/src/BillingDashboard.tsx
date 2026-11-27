import {useEffect,useState} from "react";
import "./billing-dashboard.css";

type Summary={
 mode:"sandbox";currency:"UZS";amount_unit:"tiyin";
 orders:number;paid_orders:number;gross_minor:number;refund_minor:number;net_minor:number;
 order_conversion:number|null;active_subscriptions:number;monthly_list_value_minor:number;
 gifts:{plan:string;orders:number;paid:number;redeemed:number;available:number;expired:number;refunded:number;gross_minor:number}[];
 promotions:{code:string;orders:number;used:number;reserved:number;released:number;discount_minor:number;gross_minor:number}[];
 promotion_limit:number;
 daily:{day:string;gross_minor:number;refund_minor:number;net_minor:number;orders:number;paid_orders:number}[];
 active_plans:{plan:string;count:number;monthly_list_value_minor:number}[];
};
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n/100)+" сум";
export default function BillingDashboard({api,token,demo=false}:{api:string;token:string;demo?:boolean}){
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
  if(!Number.isFinite(+from)||!Number.isFinite(+to)||+to<=+from||+to-+from>366*86400000){setState("error");return;}
  if(demo){
   // Deterministic synthetic orders. No browser library, user identifiers or backend data.
   const samples=Array.from({length:90},(_,i)=>{
    const date=day(i-89),count=3+(i%5);
    return Array.from({length:count},(_,j)=>{
     const paid=j!==count-1,plan=j%3===0?"family":"plus",gift=j===1&&i%4===0;
     const code=j===0&&i%3===0?"WELCOME10":null;
     const list=plan==="plus"?3900000:7900000,discount=code?Math.floor(list/10):0;
     const gross=paid?list-discount:0,refunded=paid&&j===2&&i%11===0;
     return {date,paid,plan,gift,code,discount:paid?discount:0,gross,refund:refunded?gross:0};
    });
   }).flat().filter(row=>row.date>=start&&row.date<=end);
   const sum=(rows:typeof samples,field:"gross"|"refund"|"discount")=>rows.reduce((n,row)=>n+row[field],0);
   const countPaid=(rows:typeof samples)=>rows.filter(row=>row.paid).length;
   const daily=[...new Set(samples.map(row=>row.date))].map(date=>{
    const rows=samples.filter(row=>row.date===date),gross=sum(rows,"gross"),refund=sum(rows,"refund");
    return {day:date,orders:rows.length,paid_orders:countPaid(rows),gross_minor:gross,refund_minor:refund,net_minor:gross-refund};
   });
   const promo=samples.filter(row=>row.code==="WELCOME10");
   const promotions=promo.length?[{code:"WELCOME10",orders:promo.length,used:countPaid(promo),reserved:0,released:promo.length-countPaid(promo),discount_minor:sum(promo,"discount"),gross_minor:sum(promo,"gross")}]:[];
   const gifts=["plus","family"].flatMap(plan=>{
    const rows=samples.filter(row=>row.gift&&row.plan===plan);
    if(!rows.length)return [];
    const paid=countPaid(rows),refunded=rows.filter(row=>row.refund>0).length,redeemed=Math.floor((paid-refunded)/2);
    return [{plan,orders:rows.length,paid,redeemed,available:paid-refunded-redeemed,expired:0,refunded,gross_minor:sum(rows,"gross")}];
   });
   const gross=sum(samples,"gross"),refund=sum(samples,"refund"),paid=countPaid(samples);
   setData({mode:"sandbox",currency:"UZS",amount_unit:"tiyin",orders:samples.length,paid_orders:paid,gross_minor:gross,refund_minor:refund,net_minor:gross-refund,order_conversion:samples.length?paid/samples.length:null,active_subscriptions:20,monthly_list_value_minor:98000000,active_plans:[{plan:"plus",count:15,monthly_list_value_minor:58500000},{plan:"family",count:5,monthly_list_value_minor:39500000}],daily,promotions,promotion_limit:100,gifts});setState("ready");return;
  }
  if(!token||!api){setState("error");return;}
  const query=new URLSearchParams({start:from.toISOString(),end:to.toISOString()});
  fetch(api.replace(/\/$/,"")+"/api/billing/admin/analytics/summary?"+query,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error("Unavailable");return r.json() as Promise<Summary>;})
   .then(v=>{if(controller.signal.aborted)return;if(v.mode!=="sandbox"||v.currency!=="UZS"||v.amount_unit!=="tiyin"||!Array.isArray(v.active_plans)||!Array.isArray(v.daily)||!Array.isArray(v.promotions)||!Array.isArray(v.gifts))throw Error("Invalid summary");setData(v);setState("ready");})
   .catch(()=>{if(!controller.signal.aborted)setState("error");});
  return ()=>controller.abort();
 },[api,token,start,end,demo]);
 function exportCsv(){
  if(!data)return;
  const rows=[["Mode","Basis","UTC date","Orders","Paid orders","Gross UZS","Refund UZS","Net UZS"],...data.daily.map(d=>[demo?"synthetic_demo":"sandbox","order_creation_cohort_current_state",d.day,d.orders,d.paid_orders,(d.gross_minor/100).toFixed(2),(d.refund_minor/100).toFixed(2),(d.net_minor/100).toFixed(2)])];
  const escapeCell=(value:string|number)=>{let s=String(value);if(typeof value==="string"&&/^[=+@\-\t\r]/.test(s))s="\'"+s;return "\""+s.replace(/"/g,"\"\"")+"\"";};
  const blob=new Blob(["\uFEFF"+rows.map(row=>row.map(escapeCell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(demo?"ertakcha-synthetic-demo-":"ertakcha-sandbox-")+start+"-"+end+".csv";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 const buckets=new Map<string,{gross:number;refund:number;net:number}>();
 for(const d of data?.daily??[]){const key=group==="month"?d.day.slice(0,7):d.day;const b=buckets.get(key)??{gross:0,refund:0,net:0};b.gross+=d.gross_minor;b.refund+=d.refund_minor;b.net+=d.net_minor;buckets.set(key,b);}
 const points=Array.from(buckets.entries()).sort(([a],[b])=>a.localeCompare(b));
 const max=Math.max(1,...points.flatMap(([,p])=>[p.gross,p.refund,Math.abs(p.net)]));
 return <section className="billing-dashboard">
  <h2>Финансовая аналитика</h2>{demo&&<p role="status">ДЕМО · вымышленные данные · без подключения к серверу · операции за последние 90 дней</p>}
  <p className="billing-muted">Тестовые операции, не реальные доходы. Период по дате создания заказа (UTC).</p>
  <div className="billing-filters">
   <label>С<input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
   <label>По<input type="date" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label>
   <button type="button" onClick={()=>{setStart(day(-6));setEnd(day(0));}}>7 дней</button>
   <button type="button" onClick={()=>{setStart(day(-29));setEnd(day(0));}}>30 дней</button>
   <button type="button" onClick={()=>{setStart(day(-89));setEnd(day(0));}}>90 дней</button>
  </div>
  {state==="loading"&&<p role="status">Загрузка…</p>}
  {state==="error"&&<p role="alert">Статистика недоступна. Проверьте доступ и период (не более 366 дней).</p>}
  {data&&<>
   <div className="billing-filters"><button type="button" onClick={exportCsv}>Экспорт CSV (Excel)</button></div>
   <div className="billing-metrics">{[
    ["Общий объём",money(data.gross_minor)],["После возвратов",money(data.net_minor)],
    ["Возвраты",money(data.refund_minor)],["Заказы",String(data.orders)],
    ["Оплаченные",String(data.paid_orders)],["Конверсия",data.order_conversion===null?"—":(data.order_conversion*100).toFixed(1)+"%"],
    ["Не оплачено",String(data.orders-data.paid_orders)],["Средний оплаченный заказ",data.paid_orders?money(data.gross_minor/data.paid_orders):"—"],["Доля возвратов по сумме",data.gross_minor?(data.refund_minor/data.gross_minor*100).toFixed(1)+"%":"—"],["Активные подписки",String(data.active_subscriptions)],["Стоимость активных тарифов",money(data.monthly_list_value_minor)]
   ].map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
   <h3>Динамика заказов</h3>
   <div className="billing-filters"><button type="button" aria-pressed={group==="day"} onClick={()=>setGroup("day")}>По дням</button><button type="button" aria-pressed={group==="month"} onClick={()=>setGroup("month")}>По месяцам</button></div>
   <p className="billing-muted">По дате создания заказа, с учётом текущего состояния. Не денежный поток.</p>
   <div style={{maxHeight:320,overflowY:"auto",display:"grid",gap:10}}>{points.map(([date,p])=><div key={date}><small>{date}</small>{([["Объём",p.gross],["Возвраты",p.refund],["Чистый объём",p.net]] as const).map(([label,value])=><div key={label} className="billing-plan-row"><small>{label}</small><progress max={max} value={Math.abs(value)} aria-label={label}/><small>{money(value)}</small></div>)}</div>)}</div>
   {!points.length&&<p>Нет операций за период</p>}
   <h3>Эффективность промокодов</h3>
   <p className="billing-muted">До {data.promotion_limit} кодов по числу использований. Тестовые заказы за выбранный период.</p>
   {!data.promotions.length&&<p>Нет использований промокодов</p>}
   <div className="billing-metrics">{data.promotions.map(p=><article key={p.code}><strong>{p.code}</strong><small>Заказы: {p.orders} · Использовано: {p.used}</small><small>Резерв: {p.reserved} · Освобождено: {p.released}</small><small>Скидки: {money(p.discount_minor)}</small><small>Оплаченный объём: {money(p.gross_minor)}</small><small>Доля использований: {p.orders?(p.used/p.orders*100).toFixed(1)+"%":"—"}</small></article>)}</div>
   <h3>Подарочные подписки</h3>
   {!data.gifts.length&&<p>Нет подарочных заказов</p>}
   <div className="billing-metrics">{data.gifts.map(g=><article key={g.plan}><strong>{g.plan}</strong><small>Заказы: {g.orders} · Оплачено: {g.paid}</small><small>Активировано: {g.redeemed}</small><small>Доступно: {g.available} · Просрочено: {g.expired}</small><small>Возвращено: {g.refunded}</small><small>Общий объём: {money(g.gross_minor)}</small><small>Доля активаций: {g.paid?(g.redeemed/g.paid*100).toFixed(1)+"%":"—"}</small></article>)}</div>
   <h3>Активные тарифы на текущий момент</h3>
   {data.active_plans.length===0&&<p>Нет активных подписок</p>}
   {data.active_plans.map(p=><div className="billing-plan-row" key={p.plan}><span>{p.plan}</span><progress max={Math.max(1,data.active_subscriptions)} value={p.count} aria-label={p.plan}/><strong>{p.count}</strong></div>)}
   <p className="billing-muted">Стоимость активных тарифов не является MRR: автопродление отключено.</p>
  </>}
 </section>;
}
