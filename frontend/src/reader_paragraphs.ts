/** Layout-only paragraphs for iPhone reading.
 * The original text is never edited, shortened or re-sent.
 * All offsets remain UTF-16 indices into the exact original story page so
 * native SpeechSynthesis word highlighting continues to work.
 */
export type ReaderParagraph={text:string;start:number;end:number};
export function readerParagraphs(text:string):ReaderParagraph[]{
 if(!text)return [];
 const parts:ReaderParagraph[]=[];
 const boundaries:number[]=[];
 // Explicit author-provided paragraph breaks take priority.
 const explicit=/\n[\t \r]*\n+/g;
 let match:RegExpExecArray|null;
 while((match=explicit.exec(text))!==null)boundaries.push(match.index+match[0].length);
 // Long uninterrupted narrative gets visual-only paragraph breaks at sentence
 // boundaries. A word or sentence is never split or lost.
 const sentence=/[.!?…][»”"']?[ \t]+/gu;
 const sentenceEnds:number[]=[];
 while((match=sentence.exec(text))!==null)sentenceEnds.push(match.index+match[0].length);
 const all=[...new Set(boundaries)].sort((a,b)=>a-b);
 let start=0;
 const splitAt=(end:number)=>{
  if(end<=start||end>text.length)return;
  parts.push({text:text.slice(start,end),start,end});
  start=end;
 };
 for(const limit of [...all,text.length]){
  // Inside each explicit author paragraph, use gentle extra breaks only for
  // genuinely long text, at the next suitable sentence after ~260 chars.
  const choices=sentenceEnds.filter(end=>end>start&&end<limit);
  for(const end of choices){
   if(end-start>=240&&limit-end>=95)splitAt(end);
  }
  splitAt(limit);
 }
 return parts;
}
