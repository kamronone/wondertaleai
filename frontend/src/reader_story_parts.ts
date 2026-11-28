import type {Lang} from "./i18n";

/**
 * Reader navigation landmarks only. These labels describe the usual narrative
 * structure, not an AI claim about what a specific chapter contains.
 * We never infer a child's private story, alter pages, or rewrite progress.
 */
const LABELS:Record<Lang,readonly [string,string,string,string]>={
 ru:["Начало","Развитие событий","Кульминация","Финал"],
 uz:["Boşlaniş","Voqealar rivoji","Eng muhim voqea","Yakun"],
 en:["Beginning","The journey","Turning point","Ending"],
};
export type ReaderStoryPart={
  id:"beginning"|"journey"|"turning-point"|"ending";
  label:string;
  start:number;
  end:number;
};
const IDS=["beginning","journey","turning-point","ending"] as const;

/** start/end use zero-based, inclusive page indexes. */
export function readerStoryParts(pageCount:number,language:Lang):ReaderStoryPart[]{
 if(pageCount!==12&&pageCount!==20)return [];
 const boundaries=pageCount===20?[0,4,13,17,20]:[0,2,8,10,12];
 const names=LABELS[language]??LABELS.ru;
 return IDS.map((id,i)=>({
  id,
  label:names[i],
  start:boundaries[i],
  end:boundaries[i+1]-1,
 }));
}
export function readerStoryPartForPage(page:number,pageCount:number,language:Lang):ReaderStoryPart|null{
 if(!Number.isInteger(page)||page<0||page>=pageCount)return null;
 return readerStoryParts(pageCount,language).find(part=>page>=part.start&&page<=part.end)??null;
}
