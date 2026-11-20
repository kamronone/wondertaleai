import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

type Child={id:string;nickname:string;age:number};
type Props={api:string;session:string;lang:Lang;onSelect:(child:Child|null)=>void};
const copy={
 ru:{title:"Профиль ребёнка",manual:"Ввести данные вручную",loading:"Загружаем профили…",error:"Не удалось загрузить профили. Можно заполнить поля вручную.",hint:"Выбор профиля подставляет имя и возраст. Фото и другие данные не передаются."},
 uz:{title:"Bola profili",manual:"Ma’lumotni qölda kiritiş",loading:"Profillar yuklanmoqda…",error:"Profillar yuklanmadi. Ma’lumotni qölda kiritiş mumkin.",hint:"Profil tanlansa, ism va yoş avtomatik töldiriladi. Surat yuborilmaydi."},
 en:{title:"Child profile",manual:"Enter details manually",loading:"Loading profiles…",error:"Could not load profiles. You can enter details manually.",hint:"Selecting a profile fills in name and age. Photos and other details are not shared."}
} as const;
export function StoryChildPicker({api,session,lang,onSelect}:Props){
 const t=copy[lang];
 const [children,setChildren]=useState<Child[]>([]);
 const [selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  setSelected("");setChildren([]);setLoading(true);setError(false);onSelect(null);
  void fetch(api+"/api/children",{headers:{Authorization:"Bearer "+session},cache:"no-store",signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error("Profiles unavailable");return response.json() as Promise<unknown>;})
   .then(data=>{
    if(controller.signal.aborted)return;
    if(!Array.isArray(data))throw Error("Invalid profiles");
    setChildren(data.filter((child):child is Child=>child&&typeof child.id==="string"&&typeof child.nickname==="string"&&Number.isInteger(child.age)&&child.age>=2&&child.age<=14));
   })
   .catch(()=>{if(!controller.signal.aborted)setError(true);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[api,session]);
 return <div className="story-child-picker">
  <label>{t.title}
   <select value={selected} disabled={loading||error} onChange={event=>{
    const id=event.target.value;setSelected(id);onSelect(children.find(child=>child.id===id)??null);
   }}>
    <option value="">{t.manual}</option>
    {children.map(child=><option key={child.id} value={child.id}>{child.nickname} · {child.age}</option>)}
   </select>
  </label>
  {loading?<small role="status">{t.loading}</small>:error?<small role="alert">{t.error}</small>:<small>{t.hint}</small>}
 </div>;
}
