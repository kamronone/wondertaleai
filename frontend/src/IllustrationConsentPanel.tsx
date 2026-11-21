import {useCallback,useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";
import {fetchIllustrationConsent,updateIllustrationConsent,type IllustrationConsent} from "./illustration_consent";

const translations={
  ru:{
    title:"AI-иллюстрации · согласие родителя",
    intro:"Экспериментальная функция. Перед будущей генерацией иллюстраций требуется отдельное разрешение родителя.",
    details:"Если функция будет запущена, сервис передаст внешнему AI-провайдеру подготовленное описание вымышленной сцены. Имя ребёнка, фотография и текст личной сказки не отправляются этим модулем. Результат и история заданий хранятся в вашем закрытом аккаунте.",
    note:"Согласие не запускает AI и не является покупкой. Генерация и оплата сейчас выключены. Отозвать разрешение можно в любое время. Отзыв останавливает новые задания, но не удаляет уже созданные изображения.",
    check:"Я родитель или законный представитель, прочитал(а) объяснение и разрешаю будущую AI-генерацию иллюстраций по этим условиям.",
    grant:"Подтвердить согласие",revoke:"Отозвать согласие",active:"Согласие дано",inactive:"Согласие не дано",
    loading:"Проверяем разрешение…",saving:"Сохраняем…",failed:"Не удалось загрузить согласие. Проверьте подключение и повторите.",saveFailed:"Не удалось сохранить решение. Повторите позже.",retry:"Повторить",
    privacy:"Политика конфиденциальности",parents:"Информация для родителей",notSigned:"Для управления согласием войдите в родительский аккаунт."
  },
  uz:{
    title:"AI rasmlar · ota-ona roziligi",
    intro:"Sinov funksiyasi. Kelajakda ertakka AI rasmlar yaratish uchun ota-onaning alohida roziligi kerak.",
    details:"Funksiya ishga tushirilsa, tashqi AI xizmatiga o‘ylab topilgan sahnaning tayyor tavsifi yuboriladi. Bu modul bolaning ismi, surati yoki shaxsiy ertak matnini yubormaydi. Natija va vazifalar tarixi yopiq akkauntingizda saqlanadi.",
    note:"Rozilik AI ni ishga tushirmaydi va xarid emas. Hozir generatsiya va to‘lovlar o‘chiq. Rozilikni istalgan vaqtda bekor qilish mumkin. Bu yangi vazifalarni to‘xtatadi, ammo oldingi rasmlarni o‘chirmaydi.",
    check:"Men ota-ona yoki qonuniy vakilman, tushuntirishni o‘qidim va shu shartlar asosida kelajakdagi AI rasmlariga roziman.",
    grant:"Rozilik berish",revoke:"Rozilikni bekor qilish",active:"Rozilik berilgan",inactive:"Rozilik berilmagan",
    loading:"Rozilik tekshirilmoqda…",saving:"Saqlanmoqda…",failed:"Rozilik holatini yuklab bo‘lmadi. Internetni tekshiring.",saveFailed:"Qarorni saqlab bo‘lmadi. Qayta urinib ko‘ring.",retry:"Qayta urinish",
    privacy:"Maxfiylik siyosati",parents:"Ota-onalar uchun ma’lumot",notSigned:"Rozilikni boshqarish uchun ota-ona akkauntiga kiring."
  },
  en:{
    title:"AI illustrations · parental consent",
    intro:"This is an experimental feature. Future AI illustration generation requires a separate opt-in by a parent or legal guardian.",
    details:"If enabled later, the service sends a prepared description of a fictional scene to an external AI provider. This module does not send the child's name, photo, or private story text. Results and job history stay in your private account.",
    note:"Consent does not start AI or purchase anything. Generation and payments are currently off. You can revoke consent at any time. Revocation prevents new jobs, but does not delete previously created images.",
    check:"I am a parent or legal guardian, have read this explanation, and agree to future AI illustration generation under these terms.",
    grant:"Give consent",revoke:"Revoke consent",active:"Consent granted",inactive:"No consent",
    loading:"Checking consent…",saving:"Saving…",failed:"Could not load consent. Check your connection and retry.",saveFailed:"Could not save your decision. Try again.",retry:"Retry",
    privacy:"Privacy policy",parents:"For parents",notSigned:"Sign in to your parent account to manage consent."
  }
} as const satisfies Record<Lang,Record<string,string>>;

export function IllustrationConsentPanel({api,session,lang,onOpenPrivacy,onOpenParents}:{
  api:string;session:string;lang:Lang;onOpenPrivacy:()=>void;onOpenParents:()=>void;
}){
  const t=translations[lang];
  const [consent,setConsent]=useState<IllustrationConsent|null>(null);
  const [checked,setChecked]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [requestId,setRequestId]=useState(0);
  const epoch=useRef(0);
  const refresh=useCallback(()=>setRequestId(value=>value+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    const current=++epoch.current;
    setConsent(null);setChecked(false);setLoading(true);setError("");
    void fetchIllustrationConsent(api,session,controller.signal)
      .then(result=>{if(epoch.current===current)setConsent(result);})
      .catch(()=>{if(epoch.current===current&&!controller.signal.aborted)setError(t.failed);})
      .finally(()=>{if(epoch.current===current)setLoading(false);});
    return ()=>{++epoch.current;controller.abort();};
  },[api,session,requestId,t.failed]);
  const submit=async(agreed:boolean)=>{
    if(!consent||saving||(agreed&&!checked))return;
    const current=epoch.current;
    setSaving(true);setError("");
    try{
      const result=await updateIllustrationConsent(api,session,agreed,AbortSignal.timeout(15000));
      if(epoch.current===current){setConsent(result);setChecked(false);}
    }catch{
      if(epoch.current===current)setError(t.saveFailed);
    }finally{
      if(epoch.current===current)setSaving(false);
    }
  };
  return <section className="illustration-consent-panel" aria-labelledby="illustration-consent-title">
    <div className="illustration-consent-head">
      <h3 id="illustration-consent-title">{t.title}</h3>
      {consent&&<span className="illustration-consent-state">{consent.agreed?t.active:t.inactive}</span>}
    </div>
    <p>{t.intro}</p>
    <details className="illustration-consent-details" open>
      <summary>{({ru:"Что важно знать",uz:"Muhim ma’lumot",en:"What you should know"} as const)[lang]}</summary>
      <p>{t.details}</p>
      <p>{t.note}</p>
      <div className="illustration-consent-links">
        <button type="button" onClick={onOpenPrivacy}>{t.privacy}</button>
        <button type="button" onClick={onOpenParents}>{t.parents}</button>
      </div>
    </details>
    {loading&&<p role="status">{t.loading}</p>}
    {error&&<p role="alert" className="illustration-consent-error">{error}</p>}
    {!loading&&!consent&&<button type="button" className="small-button" onClick={refresh}>{t.retry}</button>}
    {!loading&&consent&&!consent.agreed&&<>
      <label className="illustration-consent-check">
        <input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)} disabled={saving}/>
        <span>{t.check}</span>
      </label>
      <button type="button" className="illustration-consent-primary" disabled={!checked||saving} onClick={()=>void submit(true)}>{saving?t.saving:t.grant}</button>
    </>}
    {!loading&&consent?.agreed&&
      <button type="button" className="illustration-consent-revoke" disabled={saving} onClick={()=>void submit(false)}>{saving?t.saving:t.revoke}</button>}
  </section>;
}
