import {useEffect,useRef,useState} from "react";
import type {Lang} from "./i18n";
import {getPhotoConsent,setPhotoConsent,type PhotoConsent} from "./photo_consents";

const text={
  ru:{
    title:"Фотографии ребёнка",summary:"Управление отдельными разрешениями родителя",
    intro:"Загрузка фотографий и персональная ИИ-генерация сейчас недоступны на публичном сайте.",
    local:"Локальная обработка фотографии",
    external:"Передача снимка внешнему ИИ",
    localInfo:"Разрешение на кратковременную обработку фото внутри сервиса. Оно не позволяет отправлять снимок стороннему ИИ.",
    externalInfo:"Если генерация будет включена позднее, изображение может передаваться OpenAI для создания сказочных иллюстраций. Фотография относится к персональным данным ребёнка. Прежде чем включить функцию, сервис должен дополнительно сообщить действующие правила обработки, хранения и удаления данных.",
    disabled:"Функция отключена",granted:"Разрешено",denied:"Не разрешено",
    check:"Я родитель или законный представитель и отдельно разрешаю потенциальную передачу фото ребёнка внешнему провайдеру ИИ.",
    allow:"Дать согласие",revoke:"Отозвать согласие",
    load:"Проверка разрешений…",failure:"Не удалось получить разрешения. Проверьте соединение.",
    saving:"Сохраняем…",saveError:"Не удалось сохранить решение.",retry:"Повторить",
    note:"Само согласие не запускает генерацию и не передаёт фото. При отзыве внешнего разрешения временная фотография удаляется."
  },
  uz:{
    title:"Bola suratlari",summary:"Ota-ona ruxsatlarini ayrıça başqariş",
    intro:"Ommaviy saytda surat yuklaş va şaxsiy AI rasm yaratiş hozirça öçirilgan.",
    local:"Suratni mahalliy işlaş",external:"Suratni taşqi AI xizmatiga yuboriş",
    localInfo:"Suratni xizmat içinde vaqtinça işlaşga ruxsat. Bu suratni taşqi AI xizmatiga yuborişga ruxsat bermaydi.",
    externalInfo:"Keyinçalik generatsiya işga tuşirilsa, ertak rasmlarini yaratiş uçun surat OpenAI xizmatiga yuborilişi mumkin. Bola surati şaxsiy ma’lumotdir. Funksiya açılişidan oldin ma’lumotlarni işlaş, saqlaş va öçiriş qoidalari açıqlanişi kerak.",
    disabled:"Funksiya öçirilgan",granted:"Ruxsat berilgan",denied:"Ruxsat berilmagan",
    check:"Men ota-ona yoki qonuniy vakilman va bola suratini taşqi AI xizmatiga yuboriş ehtimoliga alohida roziman.",
    allow:"Rozilik beriş",revoke:"Rozilikni bekor qiliş",
    load:"Ruxsatlar tekşirilmoqda…",failure:"Ruxsatlarni olib bölmadi. Ulanişni tekşiring.",
    saving:"Saqlanmoqda…",saveError:"Qarorni saqlab bölmadi.",retry:"Qayta tekşiriş",
    note:"Rozilikning özi generatsiyani işga tuşirmaydi va surat yubormaydi. Taşqi ruxsat bekor qilinsa, vaqtinçalik surat öçiriladi."
  },
  en:{
    title:"Child photographs",summary:"Manage separate parental permissions",
    intro:"Photo uploads and personalized AI image generation are currently unavailable on the public site.",
    local:"Local photo processing",external:"Send photos to an external AI provider",
    localInfo:"Permission for temporary processing inside the service. It does not permit sending the photo to an external AI provider.",
    externalInfo:"If generation becomes available, a photo may be sent to OpenAI to create illustrated story scenes. A child's photograph is personal information. The service must disclose the actual data handling, storage and deletion rules before enabling this feature.",
    disabled:"Feature disabled",granted:"Consent granted",denied:"No consent",
    check:"I am a parent or legal guardian and separately agree to potential transfer of the child's photograph to an external AI provider.",
    allow:"Give consent",revoke:"Revoke consent",load:"Checking permissions…",
    failure:"Could not load permissions. Check your connection.",
    saving:"Saving…",saveError:"Could not save your decision.",retry:"Try again",
    note:"Giving consent does not enable generation or transfer a photo. Revoking external permission deletes the temporary reference."
  }
} as const;

export function PhotoPermissionsPanel({api,session,lang}:{
  api:string;session:string;lang:Lang
}){
  const t=text[lang];
  const [open,setOpen]=useState(false);
  const [local,setLocal]=useState<PhotoConsent|null>(null);
  const [external,setExternal]=useState<PhotoConsent|null>(null);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [version,setVersion]=useState(0);
  const [saveError,setSaveError]=useState("");
  const mutation=useRef<AbortController|null>(null);
  useEffect(()=>()=>{mutation.current?.abort();mutation.current=null;},[api,session]);
  useEffect(()=>{
    if(!open||busy)return;
    const controller=new AbortController();
    setLoading(true);setError("");setLocal(null);setExternal(null);setChecked(false);
    void Promise.all([
      getPhotoConsent(api,session,"local",controller.signal),
      getPhotoConsent(api,session,"external",controller.signal)
    ]).then(([a,b])=>{
      if(!controller.signal.aborted){setLocal(a);setExternal(b);}
    }).catch(()=>{
      if(!controller.signal.aborted)setError(t.failure);
    }).finally(()=>{
      if(!controller.signal.aborted)setLoading(false);
    });
    return ()=>controller.abort();
  },[api,session,open,busy,version,t.failure]);
  const update=async(kind:"local"|"external",agreed:boolean)=>{
    if(busy||mutation.current||!local||!external)return;
    if(kind==="external"&&agreed&&(!local.agreed||!checked))return;
    const controller=new AbortController();
    mutation.current=controller;
    setBusy(true);setError("");setSaveError("");setChecked(false);
    // Never show an old grant or revoke as current during an uncertain write.
    setLocal(null);setExternal(null);
    try{
      await setPhotoConsent(api,session,kind,agreed,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
    }catch{
      if(!controller.signal.aborted)setSaveError(t.saveError);
    }finally{
      if(mutation.current===controller){
        mutation.current=null;
        // Both permissions are reloaded after every write, including a lost
        // response; revoking local permission may revoke external permission.
        setVersion(v=>v+1);
        setBusy(false);
      }
    }
  };
  return <details className="photo-permissions-panel" open={open}
      onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary><strong>{t.title}</strong><span>{t.summary}</span></summary>
    <div className="photo-permissions-body">
      <p>{t.intro}</p>
      {busy&&<p role="status">{t.saving}</p>}
      {!busy&&loading&&<p role="status">{t.load}</p>}
      {saveError&&<p role="alert">{saveError}</p>}
      {error&&<p role="alert">{error}</p>}
      {!busy&&!loading&&(!local||!external)&&<button type="button" onClick={()=>setVersion(v=>v+1)}>{t.retry}</button>}
      {!busy&&!loading&&local&&external&&<>
        <div className="photo-permissions-item">
          <div><strong>{t.local}</strong><small>{local.photo_upload_enabled?t.granted:t.disabled}</small></div>
          <p>{t.localInfo}</p>
          <span>{local.agreed?t.granted:t.denied}</span>
          <button type="button" disabled={busy} onClick={()=>void update("local",!local.agreed)}>
            {busy?t.saving:local.agreed?t.revoke:t.allow}
          </button>
        </div>
        <div className="photo-permissions-item">
          <div><strong>{t.external}</strong><small>{external.external_photo_processing_enabled?t.granted:t.disabled}</small></div>
          <p>{t.externalInfo}</p>
          <span>{external.agreed?t.granted:t.denied}</span>
          {!external.agreed&&local.agreed&&<label className="photo-permissions-check">
            <input type="checkbox" checked={checked} disabled={busy}
              onChange={event=>setChecked(event.target.checked)}/>
            <span>{t.check}</span>
          </label>}
          {external.agreed?<button type="button" disabled={busy}
            onClick={()=>void update("external",false)}>{busy?t.saving:t.revoke}</button>
          :<button type="button" disabled={busy||!local.agreed||!checked}
            onClick={()=>void update("external",true)}>{busy?t.saving:t.allow}</button>}
        </div>
      </>}
      <p className="photo-permissions-note">{t.note}</p>
    </div>
  </details>;
}
