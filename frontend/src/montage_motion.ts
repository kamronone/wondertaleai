/** Deterministic local camera framing; no external media or AI provider. */
export type MontageMotion="still"|"cinematic";
export type CameraFrame={x:number;y:number;width:number;height:number;previousOpacity:number};
export function montageFrame(progress:number,index:number,motion:MontageMotion,width=640,height=480):CameraFrame{
 const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 if(motion==="still")return {x:0,y:0,width,height,previousOpacity:0};
 const eased=p*p*(3-2*p);
 const scale=1+.045*Math.sin(Math.PI*eased);
 const w=width*scale,h=height*scale;
 const direction=index%2===0?1:-1;
 const x=(width-w)/2+direction*(w-width)*.18*(2*eased-1);
 const y=(height-h)/2;
 return {x,y,width:w,height:h,previousOpacity:index>0?Math.max(0,1-p/.12):0};
}
