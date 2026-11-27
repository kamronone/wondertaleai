import {useEffect,useState} from "react";
import {LayoutDashboard,Users,BookOpen,BrainCircuit,ClipboardList,Activity,ArrowUpRight,Download,ShieldCheck,ChevronRight} from "lucide-react";
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

type AdminSection="finance"|"users"|"content"|"ai"|"audit"|"system";
type DemoRole="admin"|"moderator"|"viewer";
type DemoAudit={id:number;time:string;role:DemoRole;action:string;target:string};
const roleLabels:Record<DemoRole,string>={admin:"Администратор",moderator:"Модератор",viewer:"Наблюдатель"};
const canManageUsers=(role:DemoRole)=>role==="admin";
const canModerate=(role:DemoRole)=>role==="admin"||role==="moderator";
type DemoUser={id:string;plan:"free"|"plus"|"family";status:"active"|"paused";books:number};
type DemoContent={id:string;title:string;kind:"story"|"film";status:"review"|"approved"|"hidden"};
const demoUsers=():DemoUser[]=>Array.from({length:24},(_,i)=>({id:"DEMO-"+String(i+1).padStart(3,"0"),plan:i%5===0?"family":i%3===0?"plus":"free",status:i%7===0?"paused":"active",books:(i*3)%17}));
const demoContent=():DemoContent[]=>[
 {id:"C-01",title:"Три поросёнка",kind:"story",status:"approved"},
 {id:"C-02",title:"Красная Шапочка",kind:"film",status:"approved"},
 {id:"C-03",title:"Волшебный сад",kind:"story",status:"review"},
 {id:"C-04",title:"Лесное приключение",kind:"film",status:"review"},
 {id:"C-05",title:"Звёздный корабль",kind:"story",status:"hidden"}
];
const sectionNames:Record<AdminSection,string>={finance:"Финансы",users:"Пользователи",content:"Контент",ai:"AI и расходы",audit:"Журнал",system:"Система"};
const sectionIcons={finance:LayoutDashboard,users:Users,content:BookOpen,ai:BrainCircuit,audit:ClipboardList,system:Activity};
const planNames={free:"Free",plus:"Plus",family:"Family"};
const contentStatus={review:"На проверке",approved:"Одобрено",hidden:"Скрыто"};
const metricCards=(items:[string,string|number][])=> <div className="billing-metrics">{items.map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>;
function AdminDemoSections({section}:{section:AdminSection}){
 const [role,setRole]=useState<DemoRole>("admin");
 const [audit,setAudit]=useState<DemoAudit[]>([]);
 const [sequence,setSequence]=useState(0);
 const [auditFilter,setAuditFilter]=useState<"all"|DemoRole>("all");
 const [errorFilter,setErrorFilter]=useState<"all"|"warning"|"error">("all");
 function log(action:string,target:string,actor:DemoRole=role){
  const event={id:sequence+1,time:new Date().toISOString(),role:actor,action,target};
  setSequence(n=>n+1);setAudit(rows=>[event,...rows].slice(0,100));
 }
 function changeRole(next:DemoRole){if(next!==role){log("Смена демонстрационной роли",roleLabels[next]);setRole(next);}}
 const errors=[{id:"SIM-101",level:"error",component:"AI worker",message:"Превышено время обработки иллюстрации"},{id:"SIM-102",level:"warning",component:"Video export",message:"Браузер не поддерживает выбранный формат"},{id:"SIM-103",level:"error",component:"Billing sandbox",message:"Отклонён тестовый платёж"},{id:"SIM-104",level:"warning",component:"Offline cache",message:"Мало свободного места"}] as const;
 const [users,setUsers]=useState(demoUsers);
 const [content,setContent]=useState(demoContent);
 const [query,setQuery]=useState("");
 const [plan,setPlan]=useState<"all"|DemoUser["plan"]>("all");
 const [contentFilter,setContentFilter]=useState<"all"|DemoContent["status"]>("all");
 const [budget,setBudget]=useState(10);
 useEffect(()=>setQuery(""),[section]);
 const jobs=[{name:"Текст сказок",done:120,failed:4,cost:240},{name:"Иллюстрации",done:80,failed:7,cost:360},{name:"Видео",done:12,failed:2,cost:180}];
 const spent=jobs.reduce((n,j)=>n+j.cost,0);
 const usd=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
 const visibleUsers=users.filter(user=>(plan==="all"||user.plan===plan)&&user.id.toLowerCase().includes(query.trim().toLowerCase()));
 const visibleContent=content.filter(item=>(contentFilter==="all"||item.status===contentFilter)&&item.title.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="billing-dashboard" hidden={section==="finance"} style={section==="finance"?{display:"none"}:undefined}>
  <p className="billing-muted" role="status">Синтетические данные. Изменения сохраняются только в памяти до перезагрузки страницы. Сервер не вызывается.</p>
  <div className="billing-filters"><label>Проверить интерфейс роли<select value={role} onChange={e=>changeRole(e.target.value as DemoRole)}>{Object.entries(roleLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
  <p className="billing-muted">Роли демонстрационные: это не серверная авторизация. Наблюдатель только читает; модератор изменяет контент; администратор также управляет аккаунтами и бюджетом.</p>
  {section==="users"&&<>
   <h2>Пользователи</h2>
   {metricCards([["Демо-аккаунты",users.length],["Активные",users.filter(u=>u.status==="active").length],["Приостановленные",users.filter(u=>u.status==="paused").length],["Сказки",users.reduce((n,u)=>n+u.books,0)]])}
   <div className="billing-filters">
    <label>Поиск по ID<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="DEMO-001"/></label>
    <label>Тариф<select value={plan} onChange={e=>setPlan(e.target.value as typeof plan)}><option value="all">Все тарифы</option>{Object.entries(planNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <button type="button" disabled={!canManageUsers(role)} onClick={()=>{if(!canManageUsers(role))return;setUsers(demoUsers());setQuery("");setPlan("all");log("Сброс пользователей","Демо");}}>Сбросить демо</button>
   </div>
   {!visibleUsers.length&&<p>Ничего не найдено.</p>}
   <div className="admin-record-list">{visibleUsers.map(user=><article key={user.id}>
    <strong>{user.id}</strong><small>{planNames[user.plan]} · {user.books} сказок</small>
    <span className="admin-status" data-tone={user.status==="active"?"good":"warning"}>{user.status==="active"?"Активен":"Приостановлен"}</span>
    <button type="button" className="secondary-button" disabled={!canManageUsers(role)} onClick={()=>{if(!canManageUsers(role))return;const status=user.status==="active"?"paused":"active";setUsers(items=>items.map(item=>item.id===user.id?{...item,status}:item));log(status==="paused"?"Приостановка":"Активация",user.id);}}>{user.status==="active"?"Приостановить (демо)":"Активировать (демо)"}</button>
   </article>)}</div>
  </>}
  {section==="content"&&<>
   <h2>Модерация контента</h2>
   {metricCards([["Всего",content.length],["На проверке",content.filter(c=>c.status==="review").length],["Одобрено",content.filter(c=>c.status==="approved").length],["Скрыто",content.filter(c=>c.status==="hidden").length]])}
   <div className="billing-filters">
    <label>Поиск<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Статус<select value={contentFilter} onChange={e=>setContentFilter(e.target.value as typeof contentFilter)}><option value="all">Все статусы</option>{Object.entries(contentStatus).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <button type="button" disabled={!canModerate(role)} onClick={()=>{if(!canModerate(role))return;setContent(demoContent());setQuery("");setContentFilter("all");log("Сброс контента","Демо");}}>Сбросить демо</button>
   </div>
   {!visibleContent.length&&<p>Ничего не найдено.</p>}
   <div className="admin-record-list">{visibleContent.map(item=><article key={item.id}><strong>{item.title}</strong><small>{item.kind==="story"?"Сказка":"Мультфильм"}</small><span className="admin-status" data-tone={item.status==="approved"?"good":item.status==="review"?"warning":"neutral"}>{contentStatus[item.status]}</span>
    <label>Изменить статус<select disabled={!canModerate(role)} value={item.status} onChange={e=>{if(!canModerate(role))return;const status=e.target.value as DemoContent["status"];setContent(rows=>rows.map(row=>row.id===item.id?{...row,status}:row));log("Модерация: "+contentStatus[status],item.id);}}>{Object.entries(contentStatus).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </article>)}</div>
  </>}
  {section==="ai"&&<>
   <h2>AI и расходы</h2>
   <p className="billing-muted">Пример расчёта в USD за условный день. Не реальные цены провайдера, не счёт и не активный лимит.</p>
   {metricCards([["Успешные задачи",jobs.reduce((n,j)=>n+j.done,0)],["Ошибки",jobs.reduce((n,j)=>n+j.failed,0)],["Условные расходы",usd(spent)],["Остаток условного лимита",usd(Math.max(0,budget*100-spent))]])}
   <div className="billing-filters"><label>Демо-лимит<select disabled={!canManageUsers(role)} value={budget} onChange={e=>{if(!canManageUsers(role))return;const next=Number(e.target.value);setBudget(next);log("Изменение условного бюджета",usd(next*100));}}>{[5,10,20,50].map(value=><option key={value} value={value}>{usd(value*100)}</option>)}</select></label></div>
   <progress aria-label="Использование условного лимита" max={budget*100} value={Math.min(spent,budget*100)}/>
   <p role="status">{spent>=budget*100?"Условный лимит исчерпан":"Условный лимит не превышен"}</p>
   <div className="billing-metrics">{jobs.map(job=><article key={job.name}><strong>{job.name}</strong><small>Успешно: {job.done} · Ошибки: {job.failed}</small><small>Условная стоимость: {usd(job.cost)}</small></article>)}</div>
  </>}
  {section==="audit"&&<>
   <h2>Журнал административных действий</h2>
   <p className="billing-muted">До 100 последних действий текущей страницы. Время UTC. Журнал не сохраняется на сервере.</p>
   <div className="billing-filters"><label>Роль<select value={auditFilter} onChange={e=>setAuditFilter(e.target.value as typeof auditFilter)}><option value="all">Все роли</option>{Object.entries(roleLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
   {!audit.filter(item=>auditFilter==="all"||item.role===auditFilter).length&&<p>Нет действий по выбранному фильтру.</p>}
   <div className="admin-event-list">{audit.filter(item=>auditFilter==="all"||item.role===auditFilter).map(item=><article key={item.id}><strong>{item.action}</strong><small>{item.target} · {roleLabels[item.role]}</small><small><time dateTime={item.time}>{item.time.replace("T"," ").slice(0,19)} UTC</time></small></article>)}</div>
  </>}
  {section==="system"&&<>
   <h2>Мониторинг системы</h2>
   <p className="billing-muted">Сценарии ошибок для проверки интерфейса. Не результаты диагностики реального сервера.</p>
   {metricCards([["Тестовые события",errors.length],["Ошибки",errors.filter(e=>e.level==="error").length],["Предупреждения",errors.filter(e=>e.level==="warning").length],["Реальные проверки","Не подключены"]])}
   <div className="billing-filters"><label>Уровень<select value={errorFilter} onChange={e=>setErrorFilter(e.target.value as typeof errorFilter)}><option value="all">Все события</option><option value="error">Ошибки</option><option value="warning">Предупреждения</option></select></label></div>
   <div className="admin-event-list">{errors.filter(e=>errorFilter==="all"||e.level===errorFilter).map(event=><article key={event.id}><strong>{event.component}</strong><small>{event.id}</small><span className="admin-status" data-tone={event.level==="error"?"danger":"warning"}>{event.level==="error"?"Ошибка":"Предупреждение"}</span><small>{event.message}</small></article>)}</div>
  </>}
 </div>;
}

export default function BillingDashboard({api,token,demo=false}:{api:string;token:string;demo?:boolean}){
 const [section,setSection]=useState<AdminSection>("finance");
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
 return <section className={demo?"billing-dashboard admin-shell":"billing-dashboard"}>
  {demo&&<aside className="admin-sidebar">
   <div className="admin-brand"><span className="admin-brand-icon"><BookOpen size={21}/></span><div><strong>Ertakcha</strong><small>ADMIN WORKSPACE</small></div></div>
   <nav className="admin-navigation" aria-label="Разделы админки">{(Object.keys(sectionNames) as AdminSection[]).map(key=>{const Icon=sectionIcons[key];return <button type="button" key={key} aria-pressed={section===key} onClick={()=>setSection(key)}><Icon size={18}/><span>{sectionNames[key]}</span></button>;})}</nav>
   <a className="admin-exit" href="/"><ArrowUpRight size={16}/> Открыть Ertakcha</a>
  </aside>}
  <div className={demo?"admin-main":"billing-dashboard"}>
  {demo&&<header className="admin-header"><div><small className="admin-breadcrumb">Рабочее пространство <ChevronRight size={12}/> {sectionNames[section]}</small><h1>{section==="finance"?"Обзор финансов":sectionNames[section]}</h1></div><span className="admin-demo-label"><ShieldCheck size={15}/> Демо</span></header>}
  {demo&&<AdminDemoSections section={section}/>}
  {(!demo||section==="finance")&&<>
  {!demo&&<h2>Финансовая аналитика</h2>}{demo&&<p className="admin-demo-notice" role="status">Демонстрационные данные · без подключения к серверу</p>}
  <p className="billing-muted">Тестовые операции, не реальные доходы. Период по дате создания заказа (UTC).</p>
  <div className="billing-filters admin-date-panel">
   <div className="admin-date-fields">
    <label>С<input type="date" aria-label="Начало периода" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label>
    <label>По<input type="date" aria-label="Конец периода" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label>
   </div>
   <div className="admin-period-buttons" role="group" aria-label="Быстрый выбор периода">
    <button type="button" onClick={()=>{setStart(day(-6));setEnd(day(0));}} aria-pressed={start===day(-6)&&end===day(0)}>7 дней</button>
    <button type="button" onClick={()=>{setStart(day(-29));setEnd(day(0));}} aria-pressed={start===day(-29)&&end===day(0)}>30 дней</button>
    <button type="button" onClick={()=>{setStart(day(-89));setEnd(day(0));}} aria-pressed={start===day(-89)&&end===day(0)}>90 дней</button>
   </div>
  </div>
  {state==="loading"&&<p role="status">Загрузка…</p>}
  {state==="error"&&<p role="alert">Статистика недоступна. Проверьте доступ и период (не более 366 дней).</p>}
  {data&&<>
   <div className="billing-filters"><button className="admin-export" type="button" onClick={exportCsv}><Download size={16}/> Экспорт CSV</button></div>
   <div className="billing-metrics admin-kpis">{[
    ["Общий объём",money(data.gross_minor)],["После возвратов",money(data.net_minor)],
    ["Возвраты",money(data.refund_minor)],["Заказы",String(data.orders)],
    ["Оплаченные",String(data.paid_orders)],["Конверсия",data.order_conversion===null?"—":(data.order_conversion*100).toFixed(1)+"%"],
    ["Не оплачено",String(data.orders-data.paid_orders)],["Средний оплаченный заказ",data.paid_orders?money(data.gross_minor/data.paid_orders):"—"],["Доля возвратов по сумме",data.gross_minor?(data.refund_minor/data.gross_minor*100).toFixed(1)+"%":"—"],["Активные подписки",String(data.active_subscriptions)],["Стоимость активных тарифов",money(data.monthly_list_value_minor)]
   ].map(([label,value])=><article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
   <h3>Динамика заказов</h3>
   <div className="billing-filters"><button type="button" aria-pressed={group==="day"} onClick={()=>setGroup("day")}>По дням</button><button type="button" aria-pressed={group==="month"} onClick={()=>setGroup("month")}>По месяцам</button></div>
   <p className="billing-muted">По дате создания заказа, с учётом текущего состояния. Не денежный поток.</p>
   <div className="admin-chart-panel">{points.map(([date,p])=><div key={date}><small>{date}</small>{([["Объём",p.gross],["Возвраты",p.refund],["Чистый объём",p.net]] as const).map(([label,value])=><div key={label} className="billing-plan-row"><small>{label}</small><progress max={max} value={Math.abs(value)} aria-label={label}/><small>{money(value)}</small></div>)}</div>)}</div>
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
  </>}
  </div>
 </section>;
}
