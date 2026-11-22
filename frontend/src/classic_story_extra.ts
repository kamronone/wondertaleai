import type {Lang} from "./i18n";
import {extraD} from "./classic_story_extra_d";
import {extraE} from "./classic_story_extra_e";
/** Additional story-specific prose on each of the eight existing illustrated pages.
 * Does not change page numbers, animation targets or user-created books. */
const extra:Record<string,Record<Lang,string[]>>={...extraD,...extraE};
export const extendedClassicIds=Object.freeze(Object.keys(extra));
export function extendIllustratedClassic(id:string,language:Lang,pages:readonly string[]):string[]{
 const additions=extra[id]?.[language];
 if(!additions||additions.length!==8||pages.length!==8)return [...pages];
 return pages.map((text,index)=>text+"\n\n"+additions[index]);
}
