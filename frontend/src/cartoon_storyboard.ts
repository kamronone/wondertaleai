import type {Lang} from "./i18n";
import {classics} from "./classics";
import {makeClassicStory} from "./demo";
import {classicReaderImage,classicAnimatedPage,classicPngFallback} from "./classic_page_art";

export type CartoonScene={number:number;text:string;image:string;animation:string|null;fallback:string|null;seconds:number};
export function sceneDuration(text:string):number {
  const words=text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(8,Math.min(120,Math.ceil(words/2.2)));
}

/** Pure local storyboard. No saved books, child names, server or AI calls. */
export function buildClassicCartoon(classicId:string,lang:Lang):CartoonScene[]{
  if(!classics.some(c=>c.id===classicId))return [];
  const name=({ru:"Саша",uz:"Ali",en:"Alex"} as const)[lang];
  const story=makeClassicStory(classicId,name,lang);
  return story.pages.slice(0,20).map((text,index)=>{
    const image=classicReaderImage(classicId,"",index,text);
    return {number:index+1,text,image,animation:classicAnimatedPage(classicId,image,index),
      fallback:classicPngFallback(image),seconds:sceneDuration(text)};
  });
}
export function nextCartoonScene(index:number,count:number):number|null {
  return Number.isInteger(index)&&Number.isInteger(count)&&index>=0&&index+1<count?index+1:null;
}
