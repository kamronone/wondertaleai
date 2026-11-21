/** Shared math for touch zoom in public and private story illustrations. */
export function clampReaderZoom(value:number):number{
 if(!Number.isFinite(value))return 1;
 return Math.min(3,Math.max(1,Math.round(value*100)/100));
}
export function readerFingerDistance(first:{clientX:number;clientY:number},second:{clientX:number;clientY:number}):number{
 return Math.hypot(first.clientX-second.clientX,first.clientY-second.clientY);
}
