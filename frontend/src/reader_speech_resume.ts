/** A private, in-memory speech checkpoint. Never stored in localStorage or sent to API.
 * Safari provides no reliable progress events on every device, so unknown
 * progress deliberately starts the current page from the beginning.
 */
export type SpeechBookmark={bookId:string;page:number;offset:number};
export function speechStartOffset(bookId:string,page:number,text:string,bookmark:SpeechBookmark|null):number{
 if(!bookmark||bookmark.bookId!==bookId||bookmark.page!==page||!text)return 0;
 if(!Number.isInteger(bookmark.offset)||bookmark.offset<=0||bookmark.offset>=text.length)return 0;
 // Find the start of the reported word (repeat it rather than skip one).
 let start=bookmark.offset;
 while(start>0&&!/\s/u.test(text[start-1]))start--;
 return start;
}
export function speechBoundaryBookmark(bookId:string,page:number,text:string,offset:number):SpeechBookmark|null{
 if(!bookId||!Number.isInteger(page)||page<0||!Number.isInteger(offset)||offset<=0||offset>=text.length)return null;
 return {bookId,page,offset};
}
