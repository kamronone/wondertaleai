import {useEffect,useState} from "react";
import type {Lang} from "./i18n";
import "./pricing-plans.css";

type Plan={id:"free"|"plus"|"family";price:number;stories:number;description:Record<Lang,string>;features:Record<Lang,string[]>};
const plans:Plan[]=[
 {id:"free",price:0,stories:0,description:{ru:"Знакомство со сказками",uz:"Ertaklar bilan tanişuv",en:"Discover the stories"},features:{ru:["Классические сказки","Локальное сохранение","Чтение без оплаты"],uz:["Klassik ertaklar","Qurilmada saqlaş","Bepul öqiş"],en:["Classic stories","Save on device","Free reading"]}},
 {id:"plus",price:39000,stories:20,description:{ru:"Персональные истории каждый месяц",uz:"Har oy şaxsiy ertaklar",en:"Personal stories every month"},features:{ru:["До 20 AI-сказок в месяц","Личная библиотека","Прогресс чтения"],uz:["Oyiga 20 tagacha AI ertak","Şaxsiy kutubxona","Öqiş jarayoni"],en:["Up to 20 AI stories monthly","Private library","Reading progress"]}},
 {id:"family",price:79000,stories:60,description:{ru:"Больше историй для семьи",uz:"Oila uçun köproq ertak",en:"More stories for the family"},features:{ru:["До 60 AI-сказок в месяц","Семейные профили (планируется)","Всё из Plus"],uz:["Oyiga 60 tagacha AI ertak","Oila profillari (rejalashtirilgan)","Plus imkoniyatlari"],en:["Up to 60 AI stories monthly","Family profiles (planned)","Everything in Plus"]}}
];
const copy={
 ru:{title:"Тарифы WonderTale",subtitle:"Предварительные тарифы. Оплата пока не подключена, указанные лимиты не действуют.",month:"сум / месяц",free:"Бесплатно",planned:"Скоро",names:{free:"Free",plus:"Plus",family:"Family"},note:"Подписка не оформляется, деньги не списываются. Доступ к AI пока регулируется отдельно."},
 uz:{title:"WonderTale tariflari",subtitle:"Dastlabki tariflar. Tölov hali ulanmagan, körsatilgan limitlar amalda emas.",month:"söm / oy",free:"Bepul",planned:"Tez kunda",names:{free:"Free",plus:"Plus",family:"Family"},note:"Obuna yoq, pul yeçilmaydi. AI imkoniyati hozir alohida başqariladi."},
 en:{title:"WonderTale plans",subtitle:"Proposed pricing. Payments are not enabled and these limits are not active.",month:"UZS / month",free:"Free",planned:"Coming soon",names:{free:"Free",plus:"Plus",family:"Family"},note:"No subscription is created or charged. AI access is currently managed separately."}
};
type BillingStatus={plan:string;subscription_status:string;payments_enabled:boolean;ai_pilot_access:boolean;ai_daily_limit:number;ai_used_today:number;ai_remaining_today:number;quota_timezone:string};
export function PricingPlans({lang,api,session}:{lang:Lang;api:string;session:string|null}){
 const [status,setStatus]=useState<BillingStatus|null>(null);
 useEffect(()=>{
  setStatus(null);
  if(!session||!api)return;
  const controller=new AbortController();
  fetch(api+"/api/billing/status",{headers:{Authorization:"Bearer "+session},signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error("Billing status unavailable");return response.json();})
   .then((value:BillingStatus)=>{if(!controller.signal.aborted)setStatus(value);})
   .catch(()=>{});
  return ()=>controller.abort();
 },[api,session]);
 const t=copy[lang];
 const [selected,setSelected]=useState<Plan["id"]>("plus");
 const [expanded,setExpanded]=useState(false);
 const chosen=plans.find(plan=>plan.id===selected)!;
 const previewCopy={ru:{choose:"Выбрать для сравнения",selected:"Выбран для сравнения",summary:"Предварительный расчёт",year:"За 12 месяцев без скидки",details:"Условия подписки",terms:"Оплата не подключена. Автопродления и списаний нет. AI-иллюстрации и видео не включены в расчёт.",perStory:"Цена за сказку при полном использовании лимита"},uz:{choose:"Taqqoslaş uçun tanlaş",selected:"Taqqoslaş uçun tanlandi",summary:"Dastlabki hisob",year:"12 oy uçun chegirmasiz",details:"Obuna şartlari",terms:"Tölov ulanmagan. Avtomatik uzaytiriş va pul yeçiş yöq. AI rasmlari va video hisobga kiritilmagan.",perStory:"Limit töliq ishlatilganda bitta ertak narxi"},en:{choose:"Select to compare",selected:"Selected for comparison",summary:"Estimated cost",year:"12 months without discount",details:"Subscription terms",terms:"Payments are disabled. No automatic renewal or charges. AI images and video are not included in this estimate.",perStory:"Cost per story at full quota usage"}}[lang];
 const activePlan=status?(typeof status.plan==="string"&&["free","plus","family"].includes(status.plan.toLowerCase())?status.plan.toUpperCase():({ru:"Неизвестен",uz:"Nomaʼlum",en:"Unknown"} as const)[lang]):null;
 const billingSummary=({ru:"Текущий план",uz:"Joriy tarif",en:"Current plan"} as const)[lang];
 const pendingLabel=({ru:"Планируемая функция",uz:"Rejalashtirilgan imkoniyat",en:"Planned feature"} as const)[lang];
 return <section className="pricing-section" aria-labelledby="pricing-heading">
  <div className="pricing-heading"><h2 id="pricing-heading">{t.title}</h2><p>{t.subtitle}</p></div>
  <div className="pricing-grid">{plans.map(plan=><article className={"pricing-card pricing-"+plan.id} key={plan.id}>
   <h3>{t.names[plan.id]}</h3>{plan.id==="plus"&&<span className="pricing-featured">{({ru:"Популярный вариант",uz:"Ommabop variant",en:"Popular option"} as const)[lang]}</span>}<p>{plan.description[lang]}</p>
   <div className="pricing-price">{plan.price?plan.price.toLocaleString("ru-RU"):t.free}{plan.price>0&&<small> {t.month}</small>}</div>
   <ul>{plan.features[lang].map(feature=><li key={feature}>{feature}</li>)}</ul>
   <span className="pricing-status" aria-label={plan.id==="free"?t.free:pendingLabel}>{plan.id==="free"?t.free:t.planned}</span>
   <button type="button" className="pricing-compare" aria-pressed={selected===plan.id} onClick={()=>setSelected(plan.id)}>{selected===plan.id?previewCopy.selected:previewCopy.choose}</button>
  </article>)}</div>
  <div className="pricing-estimate" aria-live="polite"><h3>{previewCopy.summary}: {t.names[selected]}</h3><p>{previewCopy.year}: <strong>{(chosen.price*12).toLocaleString("ru-RU")} {lang==="en"?"UZS":lang==="uz"?"söm":"сум"}</strong></p>{chosen.stories>0&&<p>{previewCopy.perStory}: <strong>{Math.round(chosen.price/chosen.stories).toLocaleString("ru-RU")} {lang==="en"?"UZS":lang==="uz"?"söm":"сум"}</strong></p>}<button type="button" className="pricing-compare" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{previewCopy.details}</button>{expanded&&<p>{previewCopy.terms}</p>}</div>
  {status&&<p className="pricing-note" role="status">{billingSummary+": "+activePlan} · {status.ai_pilot_access?({ru:"Пилотный AI-доступ",uz:"Sinov AI ruxsati",en:"Pilot AI access"} as const)[lang]+": "+status.ai_used_today+"/"+status.ai_daily_limit+" · "+({ru:"Осталось сегодня",uz:"Bugun qolgan",en:"Remaining today"} as const)[lang]+": "+Math.max(0,status.ai_remaining_today)+" (UTC)":({ru:"AI-доступ пока не активирован",uz:"AI ruxsati hali faol emas",en:"AI access is not active yet"} as const)[lang]}</p>}
  <p className="pricing-note">{t.note}</p><p className="pricing-note pricing-disclaimer">{({ru:"Цены и лимиты показаны для ознакомления. Кнопок оплаты нет: это не предложение действующей подписки.",uz:"Narxlar va limitlar faqat tanişuv uçun. Tölov tugmalari yöq: obuna hali işlamaydi.",en:"Prices and limits are illustrative. There are no payment buttons and subscriptions are not yet offered."} as const)[lang]}</p>
 </section>;
}
