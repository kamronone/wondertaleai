export type SiteTheme="fairy"|"forest"|"night";
export const SITE_THEME_KEY="wondertale_site_theme_v1";
export const SITE_THEMES:readonly SiteTheme[]=["fairy","forest","night"];
export const siteThemeLabels={
  ru:{fairy:"Сказочная",forest:"Лесная",night:"Ночная",heading:"Тема сайта",change:"Сменить оформление"},
  uz:{fairy:"Sehrli",forest:"O‘rmon",night:"Tungi",heading:"Sayt mavzusi",change:"Ko‘rinishni o‘zgartirish"},
  en:{fairy:"Fairy tale",forest:"Forest",night:"Night",heading:"Website theme",change:"Change appearance"}
} as const;
export function readSiteTheme():SiteTheme{
 try{
  const value=localStorage.getItem(SITE_THEME_KEY);
  return value==="forest"||value==="night"?value:"fairy";
 }catch{return "fairy";}
}
export function saveSiteTheme(theme:SiteTheme):void{
 try{localStorage.setItem(SITE_THEME_KEY,theme);}catch{/* Private Safari may block storage. Theme still works this session. */}
}
export function nextSiteTheme(theme:SiteTheme):SiteTheme{
 return SITE_THEMES[(SITE_THEMES.indexOf(theme)+1)%SITE_THEMES.length];
}
