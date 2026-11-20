import { useState } from "react";
import type { Lang } from "./i18n";

type Role = "explorer" | "guardian" | "inventor";
type Hero = { name:string; role:Role };
const KEY = "wondertale_demo_character_templates_v1";
const MAX = 6;
const roles:Record<Lang,Record<Role,string>>={
  ru:{explorer:"Исследователь",guardian:"Защитник друзей",inventor:"Изобретатель"},
  uz:{explorer:"Sayohatchi",guardian:"Dostlar himoyachisi",inventor:"Ixtirochi"},
  en:{explorer:"Explorer",guardian:"Friend protector",inventor:"Inventor"}
};
const copy={
  ru:{title:"Конструктор персонажа",intro:"Придумайте героя и добавьте его в сказку.",name:"Имя героя",role:"Роль",preview:"Ваш герой",apply:"Добавить в сказку",save:"Сохранить шаблон",saved:"Мои персонажи",remove:"Удалить",notice:"До 6 шаблонов только в этом браузере, без синхронизации. В аккаунте родителя сохранение выключено.",privateNotice:"В приватном аккаунте шаблоны не сохраняются на общем устройстве.",error:"Не удалось сохранить. Проверьте настройки Safari.",empty:"Пока нет персонажей.",full:"Можно сохранить не больше 6 персонажей.",duplicate:"Этот герой уже сохранён.",hint:"Шаблон подставляет имя второго героя. Внешность не генерируется."},
  uz:{title:"Qahramon yaratish",intro:"Qahramon yarating va ertakka qoshing.",name:"Qahramon ismi",role:"Roli",preview:"Sening qahramoning",apply:"Ertakka qoshish",save:"Saqlash",saved:"Mening qahramonlarim",remove:"Ochirish",notice:"Faqat shu brauzerda 6 tagacha qahramon; sinxronlash yoq. Ota-ona akkauntida saqlash ochirilgan.",privateNotice:"Shaxsiy akkauntda qahramonlar umumiy qurilmada saqlanmaydi.",error:"Saqlab bolmadi. Safari sozlamalarini tekshiring.",empty:"Qahramonlar hali yoq.",full:"6 tadan ortiq qahramon saqlab bolmaydi.",duplicate:"Bu qahramon allaqachon saqlangan.",hint:"Shablon ikkinchi qahramon ismini toldiradi. Surat yaratilmaydi."},
  en:{title:"Character creator",intro:"Invent a hero and bring them into the story.",name:"Character name",role:"Role",preview:"Your hero",apply:"Add to story",save:"Save template",saved:"My characters",remove:"Remove",notice:"Up to 6 templates on this browser only, without syncing. Saving is disabled in parent accounts.",privateNotice:"Templates are not saved on shared devices while signed into a parent account.",error:"Could not save. Check Safari storage settings.",empty:"No saved characters yet.",full:"You can save up to 6 characters.",duplicate:"This character is already saved.",hint:"The template fills the second hero's name. Appearance is not generated."}
} as const;

function validHero(value:unknown):value is Hero {
  if(!value||typeof value!=="object")return false;
  const item=value as Partial<Hero>;
  return typeof item.name==="string"&&item.name.trim().length>0&&item.name.length<=45&&
    (item.role==="explorer"||item.role==="guardian"||item.role==="inventor");
}
function readHeroes():Hero[]{
  try{
    const raw=sessionStorage.getItem(KEY);
    if(!raw)return [];
    const parsed:unknown=JSON.parse(raw);
    if(!Array.isArray(parsed))return [];
    return parsed.filter(validHero).slice(0,MAX);
  }catch{return [];}
}
export function CharacterBuilder({lang,onApply,allowSave=false}:{lang:Lang;onApply:(name:string)=>void;allowSave?:boolean}){
  const [name,setName]=useState("");
  const [role,setRole]=useState<Role>("explorer");
  const [saved,setSaved]=useState<Hero[]>(()=>allowSave?readHeroes():[]);
  const [message,setMessage]=useState("");
  const t=copy[lang];
  const safeName=name.trim().replace(/\s+/g," ");
  const persist=(next:Hero[])=>{
    try{sessionStorage.setItem(KEY,JSON.stringify(next));setSaved(next);setMessage("");}
    catch{setMessage(t.error);}
  };
  const save=()=>{
    if(!allowSave||!safeName||safeName.length>45)return;
    if(saved.some(hero=>hero.name.toLocaleLowerCase()===safeName.toLocaleLowerCase()&&hero.role===role)){setMessage(t.duplicate);return;}
    if(saved.length>=MAX){setMessage(t.full);return;}
    persist([...saved,{name:safeName,role}]);
  };
  return <section className="character-builder" aria-label={t.title}>
    <h4>{t.title}</h4><p>{t.intro}</p>
    <label>{t.name}<input type="text" maxLength={45} value={name} onChange={e=>{setName(e.target.value);setMessage("");}} /></label>
    <fieldset><legend>{t.role}</legend><div className="character-roles">{(["explorer","guardian","inventor"] as const).map(id=>
      <button key={id} type="button" aria-pressed={role===id} onClick={()=>setRole(id)}>{roles[lang][id]}</button>
    )}</div></fieldset>
    <div className="character-preview" aria-live="polite"><strong>{t.preview}:</strong> {safeName||"…"} · {roles[lang][role]}</div>
    <small>{t.hint}</small>
    <div className="character-actions">
      <button className="character-apply" type="button" disabled={!safeName} onClick={()=>onApply(safeName)}>{t.apply}</button>
      {allowSave&&<button type="button" disabled={!safeName} onClick={save}>{t.save}</button>}
    </div>
    <small>{allowSave?t.notice:t.privateNotice}</small>
    {message&&<p role="status" className="character-feedback">{message}</p>}
    {allowSave&&<div className="character-saved"><strong>{t.saved}</strong>
      {!saved.length?<p>{t.empty}</p>:<ul>{saved.map((hero,index)=><li key={hero.name+":"+hero.role}>
        <button type="button" onClick={()=>{setName(hero.name);setRole(hero.role);setMessage("");}}>{hero.name} · {roles[lang][hero.role]}</button>
        <button type="button" aria-label={t.remove+" "+hero.name} onClick={()=>persist(saved.filter((_,i)=>i!==index))}>{t.remove}</button>
      </li>)}</ul>}
    </div>}
  </section>;
}
