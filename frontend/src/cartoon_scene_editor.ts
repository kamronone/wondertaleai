import type {CartoonScene} from "./cartoon_storyboard";
export type SceneDuration=3|6|10|"auto";
export type SceneEdit={number:number;duration:SceneDuration|null};
export type ExportScene=CartoonScene & {durationOverride?:SceneDuration};
export function initialSceneEdits(scenes:readonly CartoonScene[]):SceneEdit[]{
 return scenes.slice(0,20).map(scene=>({number:scene.number,duration:null}));
}
export function moveScene(edits:readonly SceneEdit[],index:number,delta:-1|1):SceneEdit[]{
 const next=[...edits],target=index+delta;
 if(!Number.isInteger(index)||(delta!==-1&&delta!==1)||index<0||index>=next.length||target<0||target>=next.length)return next;
 [next[index],next[target]]=[next[target],next[index]];
 return next;
}
export function setSceneDuration(edits:readonly SceneEdit[],number:number,value:SceneDuration|null):SceneEdit[]{
 if(value!==null&&value!==3&&value!==6&&value!==10&&value!=="auto")return [...edits];
 return edits.map(edit=>edit.number===number?{...edit,duration:value}:edit);
}
export function applySceneEdits(scenes:readonly CartoonScene[],edits:readonly SceneEdit[]):ExportScene[]{
 const originals=initialSceneEdits(scenes);
 const byNumber=new Map(scenes.slice(0,20).map(scene=>[scene.number,scene]));
 const valid=edits.length===originals.length&&new Set(edits.map(edit=>edit.number)).size===originals.length&&edits.every(edit=>byNumber.has(edit.number));
 return (valid?edits:originals).map(edit=>({...byNumber.get(edit.number)!,durationOverride:edit.duration??undefined}));
}
export function editedSceneSeconds(scene:ExportScene,fallback:SceneDuration):number{
 const duration=scene.durationOverride??fallback;
 return duration==="auto"?Math.min(30,Math.max(8,Number.isFinite(scene.seconds)?Math.ceil(scene.seconds):8)):duration;
}
