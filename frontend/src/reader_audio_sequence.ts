/** One completed narration may advance to exactly one next page.
 * Built-in interactions are pauses in the story, not screens to skip.
 * The caller validates the current book and speech run before using this.
 */
export type AudioAdvanceScene={
 page:number;
 pageCount:number;
 classicId?:string;
 giftsEnabled:boolean;
 focusMode:boolean;
 nightMode:boolean;
 bedtimeActive:boolean;
 hasGift:boolean;
};
export function canAutoAdvanceAudio(scene:AudioAdvanceScene):boolean{
 const {page,pageCount,classicId,giftsEnabled,focusMode,nightMode,bedtimeActive,hasGift}=scene;
 if(!Number.isInteger(page)||!Number.isInteger(pageCount)||pageCount<1||page<0||page>=pageCount-1)return false;
 const visible=!focusMode&&!nightMode&&!bedtimeActive;
 if(visible&&classicId==="three-pigs"&&page===3)return false;
 if(visible&&giftsEnabled&&hasGift)return false;
 return true;
}
export type AudioAdvanceTarget={bookId:string;page:number};
export function consumeAudioAdvanceTarget(target:AudioAdvanceTarget|null,bookId:string,page:number):boolean{
 return target!==null&&target.bookId===bookId&&target.page===page;
}
