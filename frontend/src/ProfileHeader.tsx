import { Bell, BellOff, Check, ChevronRight, Globe2, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "./i18n";
import {SITE_THEMES,siteThemeLabels,type SiteTheme} from "./site_theme";

type OpenPanel="notifications"|"settings"|null;

const words={
  ru:{
    back:"Назад",notifications:"Уведомления",settings:"Настройки",
    noNotifications:"Новых уведомлений нет",info:"Здесь появятся уведомления приложения, когда соответствующая функция будет подключена.",
    permission:"Разрешение браузера",allow:"Разрешить уведомления",granted:"Разрешено",denied:"Заблокировано в браузере",default:"Не запрошено",unsupported:"Не поддерживается",language:"Язык интерфейса",
    privacy:"Конфиденциальность",permissionInfo:"Разрешение браузера само по себе не включает серверные push-уведомления.",
    close:"Закрыть"
  },
  uz:{
    back:"Orqaga",notifications:"Bildirishnomalar",settings:"Sozlamalar",
    noNotifications:"Yangi bildirishnomalar yoq",info:"Bu yerda funksiya ishga tushirilganda ilova bildirishnomalari paydo boladi.",
    permission:"Brauzer ruxsati",allow:"Bildirishnomalarga ruxsat",granted:"Ruxsat berilgan",denied:"Brauzerda bloklangan",default:"Soralmagan",unsupported:"Mavjud emas",language:"Interfeys tili",
    privacy:"Maxfiylik",permissionInfo:"Brauzer ruxsati server push bildirishnomalarini avtomatik yoqmaydi.",
    close:"Yopish"
  },
  en:{
    back:"Back",notifications:"Notifications",settings:"Settings",
    noNotifications:"No new notifications",info:"App notifications will appear here when that feature is available.",
    permission:"Browser permission",allow:"Enable notifications",granted:"Allowed",denied:"Blocked in browser",default:"Not requested",unsupported:"Not supported",language:"Interface language",
    privacy:"Privacy",permissionInfo:"Browser permission alone does not activate server push notifications.",
    close:"Close"
  }
} as const;

export function ProfileHeader({
 lang,onLanguage,onPrivacy,siteTheme,onSiteTheme
}:{
 lang:Lang;onLanguage:(language:Lang)=>void;onPrivacy:()=>void;siteTheme:SiteTheme;onSiteTheme:(theme:SiteTheme)=>void
}){
 const [open,setOpen]=useState<OpenPanel>(null);
 const [permission,setPermission]=useState<NotificationPermission|"unsupported">(()=>{
   return typeof window!=="undefined"&&"Notification" in window ? Notification.permission : "unsupported";
 });
 const [permissionBusy,setPermissionBusy]=useState(false);
 const containerRef=useRef<HTMLElement>(null);
 const labels=words[lang];
 useEffect(()=>{
   const handler=(event:PointerEvent)=>{
     if(!containerRef.current?.contains(event.target as Node))setOpen(null);
   };
   const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(null);};
   document.addEventListener("pointerdown",handler);
   document.addEventListener("keydown",escape);
   return ()=>{document.removeEventListener("pointerdown",handler);document.removeEventListener("keydown",escape);};
 },[]);
 const requestPermission=async()=>{
   if(!("Notification" in window)||permissionBusy)return;
   setPermissionBusy(true);
   try{setPermission(await Notification.requestPermission());}
   catch{setPermission(Notification.permission);}
   finally{setPermissionBusy(false);}
 };
 const toggle=(panel:Exclude<OpenPanel,null>)=>{
   setPermission("Notification" in window?Notification.permission:"unsupported");
   setOpen(current=>current===panel?null:panel);
 };
 const status=permission==="granted"?labels.granted:permission==="denied"?labels.denied:permission==="default"?labels.default:labels.unsupported;
 return <header className="profile-mockup-topbar" ref={containerRef}>
   <div className="profile-mockup-brand">
     <img src="/icons/icon-192.png" width={44} height={44} alt="" loading="eager"/>
     <span><strong>WonderTale <em>AI</em></strong><small>AI STORY STUDIO</small></span>
   </div>
   <div className="profile-mockup-tools">
     <button type="button" className="profile-mockup-icon-button" aria-label={labels.notifications} aria-controls="profile-notification-panel" aria-expanded={open==="notifications"} onClick={()=>toggle("notifications")}><Bell size={22}/></button>
     <button type="button" className="profile-mockup-icon-button" aria-label={labels.settings} aria-controls="profile-settings-panel" aria-expanded={open==="settings"} onClick={()=>toggle("settings")}><Settings size={22}/></button>
   </div>
   {open==="notifications"&&<section className="profile-mockup-popover" id="profile-notification-panel" aria-label={labels.notifications}>
     <div className="profile-mockup-popover-title"><strong>{labels.notifications}</strong><button type="button" aria-label={labels.close} onClick={()=>setOpen(null)}><X size={17}/></button></div>
     <div className="profile-mockup-empty"><BellOff size={25}/><strong>{labels.noNotifications}</strong><p>{labels.info}</p></div>
     <div className="profile-mockup-permission"><span>{labels.permission}</span><strong>{status}</strong></div>
     {permission==="default"&&<button type="button" className="profile-mockup-enable" disabled={permissionBusy} onClick={()=>void requestPermission()}>{labels.allow}</button>}
     <small>{labels.permissionInfo}</small>
   </section>}
   {open==="settings"&&<section className="profile-mockup-popover" id="profile-settings-panel" aria-label={labels.settings}>
     <div className="profile-mockup-popover-title"><strong>{labels.settings}</strong><button type="button" aria-label={labels.close} onClick={()=>setOpen(null)}><X size={17}/></button></div>
     <label className="profile-mockup-language"><Globe2 size={18}/><span>{labels.language}</span>
       <select value={lang} onChange={event=>onLanguage(event.target.value as Lang)} aria-label={labels.language}>
         <option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option>
       </select>
     </label>
     <div className="wt-theme-settings" role="group" aria-label={siteThemeLabels[lang].heading}>
       <span className="wt-theme-settings-title">{siteThemeLabels[lang].heading}</span>
       <div className="wt-theme-options">{SITE_THEMES.map(theme=><button key={theme} type="button" className="wt-theme-choice" data-option={theme} aria-pressed={siteTheme===theme} onClick={()=>onSiteTheme(theme)}>{theme==="fairy"?"✦":theme==="forest"?"♣":"☾"}<span>{siteThemeLabels[lang][theme]}</span></button>)}</div>
     </div>
     <button type="button" className="profile-mockup-settings-row" onClick={()=>{setOpen(null);onPrivacy();}}><ShieldCheck size={18}/><span>{labels.privacy}</span><ChevronRight size={16}/></button>
   </section>}
 </header>;
}
