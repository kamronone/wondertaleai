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
