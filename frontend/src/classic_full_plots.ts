import type {Lang} from "./i18n";
import {plotsA} from "./classic_full_plots_a";
import {plotsB} from "./classic_full_plots_b";
import {plotsC} from "./classic_full_plots_c";

/** Eight complete illustrated narrative chapters per built-in tale.
 * Public-domain story retellings for children, not verbatim original editions.
 * __HERO__ is replaced in text only, never used in markup or network requests.
 */
const plots:Record<string,Record<Lang,string[]>>={...plotsA,...plotsB,...plotsC};
export const fullPlotIds=Object.freeze(Object.keys(plots));
export function fullClassicChapters(id:string,name:string,language:Lang):string[]|null{
 const template=plots[id]?.[language];
 if(!template||template.length!==8||template.some(part=>!part.trim()))return null;
 return template.map(page=>page.replaceAll("__HERO__",name));
}
