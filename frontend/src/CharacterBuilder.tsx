import React, { useState } from "react";
import type { Lang } from "./i18n";

type Role = "explorer" | "guardian" | "inventor";
const roleLabels:Record<Lang,Record<Role,string>>={
  ru:{explorer:"Исследователь",guardian:"Защитник друзей",inventor:"Изобретатель"},
  uz:{explorer:"Sayohatchi",guardian:"Dostlar himoyachisi",inventor:"Ixtirochi"},
  en:{explorer:"Explorer",guardian:"Friend protector",inventor:"Inventor"}
};
const text:Record<Lang,{heading:string;intro:string;name:string;role:string;preview:string;apply:string;hint:string}>={
  ru:{heading:"Конструктор персонажа",intro:"Добавьте собственного героя в сказку.",name:"Имя героя",role:"Роль",preview:"Ваш герой",apply:"Добавить в сказку",hint:"Персонаж будет добавлен вторым героем. Внешность пока не генерируется."},
  uz:{heading:"Qahramon yaratish",intro:"Ertakka yangi qahramon qoshish.",name:"Qahramon ismi",role:"Roli",preview:"Sening qahramoning",apply:"Ertakka qoshish",hint:"Qahramon ikkinchi ishtirokchi sifatida qoshiladi. Uning rasmi hali yaratilmaydi."},
  en:{heading:"Character creator",intro:"Add your own character to the story.",name:"Hero name",role:"Role",preview:"Your hero",apply:"Add to story",hint:"The character becomes the second hero. Appearance is not generated yet."}
};

/** Local editor only: the selected name flows through the existing validated story form. */
export function CharacterBuilder({lang,onApply}:{lang:Lang;onApply:(name:string)=>void}){
  const [name,setName]=useState("");
  const [role,setRole]=useState<Role>("explorer");
  const t=text[lang];
  const safeName=name.trim().replace(/\s+/g," ");
  return <section className="character-builder" aria-label={t.heading}>
    <h4>{t.heading}</h4><p>{t.intro}</p>
    <label>{t.name}<input type="text" maxLength={45} value={name} onChange={event=>setName(event.target.value)} /></label>
    <fieldset><legend>{t.role}</legend><div className="character-roles">{(["explorer","guardian","inventor"] as const).map(id=>
      <button key={id} type="button" aria-pressed={role===id} onClick={()=>setRole(id)}>{roleLabels[lang][id]}</button>
    )}</div></fieldset>
    <div className="character-preview" aria-live="polite"><strong>{t.preview}:</strong> {safeName||"…"} · {roleLabels[lang][role]}</div>
    <small>{t.hint}</small>
    <button className="character-apply" type="button" disabled={!safeName} onClick={()=>onApply(safeName)}>{t.apply}</button>
  </section>;
}
