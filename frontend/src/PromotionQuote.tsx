import { useRef, useState } from 'react';

type Language = 'ru' | 'uz' | 'en';
type Quote = { code: string; plan_id: string; original_minor: number; discount_minor: number; total_minor: number; currency: 'UZS'; guaranteed: boolean };
const labels = {
  ru: ['Промокод','Применить','Стоимость','Скидка','Итого','Промокод недоступен','Расчёт предварительный. Оплата отключена.'],
  uz: ['Promokod','Qo‘llaş','Narxi','Çegirma','Jami','Promokod mavjud emas','Dastlabki hisob. To‘lov o‘çirilgan.'],
  en: ['Promo code','Apply','Price','Discount','Total','Promotion unavailable','Estimate only. Payments disabled.'],
};
export default function PromotionQuote({ language, planId, requestQuote }: { language: Language; planId: string; requestQuote: (planId: string, code: string) => Promise<Quote> }) {
  const t=labels[language];
  const [code,setCode]=useState('');
  const [quote,setQuote]=useState<Quote|null>(null);
  const [error,setError]=useState(false);
  const [busy,setBusy]=useState(false);
  const seq=useRef(0);
  const normalized=code.trim().toUpperCase();
  const current=quote?.plan_id===planId && quote.code===normalized ? quote : null;
  const money=(n:number)=>new Intl.NumberFormat(language==='uz'?'uz-UZ':language==='ru'?'ru-RU':'en-US',{maximumFractionDigits:2}).format(n/100)+' UZS';
  async function apply() {
    const id=++seq.current;
    setBusy(true);setError(false);setQuote(null);
    try {
      const q=await requestQuote(planId,normalized);
      if(id!==seq.current)return;
      if(q.plan_id!==planId || q.code!==normalized || q.currency!=='UZS' || ![q.original_minor,q.discount_minor,q.total_minor].every(Number.isSafeInteger) || q.total_minor<=0 || q.discount_minor<=0 || q.original_minor-q.discount_minor!==q.total_minor)throw new Error('Invalid quote');
      setQuote(q);
    } catch { if(id===seq.current)setError(true); }
    finally { if(id===seq.current)setBusy(false); }
  }
  if(planId==='free')return null;
  return <section aria-label={t[0]} style={{display:'grid',gap:8}}>
    <label htmlFor="billing-promo-code">{t[0]}</label>
    <div style={{display:'flex',gap:8}}>
      <input id="billing-promo-code" value={code} maxLength={32} autoComplete="off" autoCapitalize="characters" onChange={e=>{++seq.current;setCode(e.target.value);setQuote(null);setError(false);setBusy(false);}} style={{minWidth:0,flex:1,fontSize:16}} />
      <button type="button" disabled={busy || !/^[A-Z0-9_-]{4,32}$/.test(normalized)} onClick={()=>void apply()}>{busy?'…':t[1]}</button>
    </div>
    <div aria-live="polite">
      {error && <small role="alert">{t[5]}</small>}
      {current && <dl style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6,margin:0}}>
        <dt>{t[2]}</dt><dd style={{margin:0}}><s>{money(current.original_minor)}</s></dd>
        <dt>{t[3]}</dt><dd style={{margin:0}}>{money(current.discount_minor)}</dd>
        <dt><strong>{t[4]}</strong></dt><dd style={{margin:0}}><strong>{money(current.total_minor)}</strong></dd>
      </dl>}
    </div>
    <small>{t[6]}</small>
  </section>;
}
