import { ChevronRight, Copyright, FileText, ShieldCheck, UsersRound } from "lucide-react";
import type { Lang } from "./i18n";
import type { LegalDocument } from "./LegalCenter";

const copy={
  ru:{
    heading:"Правовая информация",
    description:"Условия сервиса, защита данных и права на сказки",
    terms:"Условия использования",
    privacy:"Конфиденциальность",
    copyright:"Авторские права",
    parents:"Для родителей"
  },
  uz:{
    heading:"Huquqiy ma'lumot",
    description:"Foydalanish qoidalari, maxfiylik va mualliflik huquqi",
    terms:"Shartlar",
    privacy:"Maxfiylik",
    copyright:"Mualliflik huquqi",
    parents:"Ota-onalar"
  },
  en:{
    heading:"Legal information",
    description:"Service rules, privacy and intellectual property",
    terms:"Terms of use",
    privacy:"Privacy policy",
    copyright:"Copyright",
    parents:"For parents"
  }
} as const;

const documents=[
  {id:"terms",Icon:FileText},
  {id:"privacy",Icon:ShieldCheck},
  {id:"copyright",Icon:Copyright},
  {id:"parents",Icon:UsersRound}
] as const;

export function ProfileLegalMenu({lang,onOpen}:{lang:Lang;onOpen:(document:LegalDocument)=>void}){
  const t=copy[lang];
  return <section className="profile-legal-menu" aria-labelledby="profile-legal-title">
    <div className="profile-legal-heading">
      <h3 id="profile-legal-title">{t.heading}</h3>
      <p>{t.description}</p>
    </div>
    <nav className="profile-legal-links" aria-label={t.heading}>
      {documents.map(({id,Icon})=><button type="button" key={id} onClick={()=>onOpen(id)}>
        <span className="profile-legal-icon"><Icon size={18} aria-hidden="true"/></span>
        <span className="profile-legal-label">{t[id]}</span>
        <ChevronRight size={17} className="profile-legal-chevron" aria-hidden="true"/>
      </button>)}
    </nav>
  </section>;
}
