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
export function PricingPlans({lang}:{lang:Lang}){
 const t=copy[lang];
 return <section className="pricing-section" aria-labelledby="pricing-heading">
  <div className="pricing-heading"><h2 id="pricing-heading">{t.title}</h2><p>{t.subtitle}</p></div>
  <div className="pricing-grid">{plans.map(plan=><article className={"pricing-card pricing-"+plan.id} key={plan.id}>
   <h3>{t.names[plan.id]}</h3><p>{plan.description[lang]}</p>
   <div className="pricing-price">{plan.price?plan.price.toLocaleString("ru-RU"):t.free}{plan.price>0&&<small> {t.month}</small>}</div>
   <ul>{plan.features[lang].map(feature=><li key={feature}>{feature}</li>)}</ul>
   <span className="pricing-status">{plan.id==="free"?t.free:t.planned}</span>
  </article>)}</div>
  <p className="pricing-note">{t.note}</p>
 </section>;
}
