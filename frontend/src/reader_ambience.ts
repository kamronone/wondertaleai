/** Quiet, original browser-generated fairy tale ambience.
 * No audio files, no third-party services or microphones.
 * Must be started by an explicit user gesture (iOS AudioContext policy).
 */
export type ReaderAmbience="forest"|"wind"|"magic";
export type AmbiencePlayback={stop:()=>void};
type AudioContextClass=typeof AudioContext;

export function startReaderAmbience(kind:ReaderAmbience):AmbiencePlayback|null{
  if(typeof window==="undefined")return null;
  const AudioContextImpl=(window.AudioContext||(window as Window & {webkitAudioContext?:AudioContextClass}).webkitAudioContext);
  if(!AudioContextImpl)return null;
  let context:AudioContext;
  try{context=new AudioContextImpl();}catch{return null;}
  const output=context.createGain();
  output.gain.value=.035;
  output.connect(context.destination);
  const nodes:Array<{stop?:(time?:number)=>void;disconnect:()=>void}>=[];
  const duration=2;
  // Soft looping filtered noise for leaves, wind and quiet rain-like rustling.
  const buffer=context.createBuffer(1,Math.floor(context.sampleRate*duration),context.sampleRate);
  const data=buffer.getChannelData(0);
  let prev=0;
  for(let i=0;i<data.length;i++){
    const white=Math.random()*2-1;
    prev=(prev+white*.025)/1.025;
    data[i]=prev*2.5;
  }
  const noise=context.createBufferSource();
  noise.buffer=buffer;
  noise.loop=true;
  const filter=context.createBiquadFilter();
  filter.type="lowpass";
  filter.frequency.value=kind==="wind"?520:kind==="forest"?960:720;
  const swish=context.createGain();
  swish.gain.value=kind==="wind"?.7:.2;
  noise.connect(filter);filter.connect(swish);swish.connect(output);
  noise.start();
  nodes.push(noise,filter,swish);

  // Gentle two-tone music-box shimmer. Low level; no copyrighted melody.
  if(kind==="magic"){
    for(const freq of [523.25,659.25]){
      const tone=context.createOscillator();
      tone.type="sine";
      tone.frequency.value=freq;
      const volume=context.createGain();
      volume.gain.value=.035;
      tone.connect(volume);volume.connect(output);
      tone.start();
      nodes.push(tone,volume);
    }
  }
  if(context.state==="suspended")void context.resume().catch(()=>{});
  let stopped=false;
  return {stop(){
    if(stopped)return;
    stopped=true;
    for(const node of nodes){try{node.stop?.();}catch{}try{node.disconnect();}catch{}}
    try{output.disconnect();}catch{}
    void context.close().catch(()=>{});
  }};
}

/** Scene selection is deterministic and never reads child data. */
export function readerAmbienceForClassic(id:string|undefined):ReaderAmbience{
 if(id==="three-pigs"||id==="bremen")return "wind";
 if(id==="cinderella"||id==="rapunzel"||id==="sleeping-beauty"||id==="snow-white")return "magic";
 return "forest";
}
