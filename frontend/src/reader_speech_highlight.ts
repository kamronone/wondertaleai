/** Converts native SpeechSynthesis boundary offsets into a safe highlight range.
 * Offsets use UTF-16 code units, just like JavaScript string.slice.
 * No guessing from elapsed time when Safari omits word boundary events.
 */
export type SpokenRange={start:number;end:number};
export function spokenWordRange(text:string,index:number,length=0):SpokenRange|null{
 if(!text||!Number.isInteger(index)||index<0||index>=text.length)return null;
 if(!Number.isInteger(length)||length<0)return null;
 const isSpace=(c:string)=>/\s/u.test(c);
 let start=index;
 // Safari may report punctuation or the whitespace before a word.
 while(start<text.length&&isSpace(text[start]))start++;
 if(start>=text.length)return null;
 let end=Math.min(text.length,start+length);
 if(length===0){
   end=start;
   while(end<text.length&&!isSpace(text[end]))end++;
 }
 if(end<=start)return null;
 // Avoid marking a space-only or punctuation-only boundary.
 if(!/[\p{L}\p{N}]/u.test(text.slice(start,end)))return null;
 return {start,end};
}
export function spokenTextParts(text:string,range:SpokenRange|null){
 if(!range||range.start<0||range.end>text.length||range.end<=range.start)
  return {before:text,active:"",after:""};
 return {before:text.slice(0,range.start),active:text.slice(range.start,range.end),after:text.slice(range.end)};
}
