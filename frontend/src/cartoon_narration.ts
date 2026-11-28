/** In-memory microphone recording. No upload, storage or background recording. */
export const MAX_NARRATION_SECONDS=120;
export const MAX_NARRATION_BYTES=12*1024*1024;
export function narrationFormat():string|null{
 if(typeof MediaRecorder==="undefined")return null;
 return ["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find(type=>MediaRecorder.isTypeSupported(type))??null;
}
export function stopNarrationTracks(stream:MediaStream|null){
 stream?.getTracks().forEach(track=>track.stop());
}
export function narrationPlaybackSeconds(recorded:number,video:number):number{
 if(!Number.isFinite(recorded)||!Number.isFinite(video)||recorded<=0||video<=0)return 0;
 return Math.min(recorded,video,MAX_NARRATION_SECONDS);
}
export async function prepareNarration(audio:AudioContext,blob:Blob):Promise<AudioBuffer>{
 if(!blob.size||blob.size>MAX_NARRATION_BYTES||!blob.type.startsWith("audio/"))throw Error("Invalid narration");
 const decoded=await audio.decodeAudioData(await blob.arrayBuffer());
 if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>MAX_NARRATION_SECONDS+2)throw Error("Invalid narration duration");
 return decoded;
}
export function playNarration(audio:AudioContext,destination:MediaStreamAudioDestinationNode,buffer:AudioBuffer,videoSeconds:number){
 const duration=narrationPlaybackSeconds(buffer.duration,videoSeconds);
 if(!duration)return;
 const source=audio.createBufferSource(),gain=audio.createGain();
 source.buffer=buffer;
 gain.gain.value=.78;
 source.connect(gain).connect(destination);
 source.onended=()=>{source.disconnect();gain.disconnect();};
 source.start(audio.currentTime,0,duration);
}


export const MAX_SCENE_NARRATION_SECONDS=30;
export const MAX_SCENE_NARRATION_BYTES=24*1024*1024;
export const MAX_DECODED_NARRATION_BYTES=96*1024*1024;

/** Bind clips to original scene numbers, not their current export positions. */
export async function prepareSceneNarrations(audio:AudioContext,clips:ReadonlyMap<number,Blob>,
  sceneNumbers:readonly number[],signal:AbortSignal):Promise<Map<number,AudioBuffer>>{
 if(sceneNumbers.length>20||new Set(sceneNumbers).size!==sceneNumbers.length)
  throw Error("Invalid narration scene list");
 const selected=sceneNumbers.flatMap(number=>{
  const blob=clips.get(number);return blob?[[number,blob] as const]:[];
 });
 if(selected.reduce((sum,[,blob])=>sum+blob.size,0)>MAX_SCENE_NARRATION_BYTES)
  throw Error("Scene narration limit");
 const buffers=new Map<number,AudioBuffer>();
 let decodedBytes=0;
 for(const [number,blob] of selected){
  if(signal.aborted)throw Error("Cancelled");
  const decoded=await prepareNarration(audio,blob);
  if(signal.aborted)throw Error("Cancelled");
  if(decoded.duration>MAX_SCENE_NARRATION_SECONDS+2)throw Error("Scene narration duration limit");
  decodedBytes+=decoded.length*decoded.numberOfChannels*4;
  if(!Number.isSafeInteger(decodedBytes)||decodedBytes>MAX_DECODED_NARRATION_BYTES)
   throw Error("Decoded scene narration limit");
  buffers.set(number,decoded);
 }
 return buffers;
}
