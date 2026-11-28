/** Speech Synthesis voice filtering. Never use a voice in another language. */
export type StoryVoice={name:string;lang:string;voiceURI:string;localService?:boolean};
export type StoryLanguage="ru"|"uz"|"en";
export const STORY_SPEECH_LOCALE:Record<StoryLanguage,string>={ru:"ru-RU",uz:"uz-UZ",en:"en-US"};
export const STORY_VOICE_STORAGE_KEY="wondertale_reader_voice_v1";

export function voicesForStoryLanguage<T extends StoryVoice>(voices:readonly T[],language:StoryLanguage):T[]{
  const prefix=language.toLowerCase()+"-";
  return voices.filter(voice=>{
    const lang=(voice.lang||"").toLowerCase().replace(/_/g,"-");
    return lang===language||lang.startsWith(prefix);
  }).sort((a,b)=>{
    const exactA=a.lang.toLowerCase().replace(/_/g,"-")===STORY_SPEECH_LOCALE[language].toLowerCase()?1:0;
    const exactB=b.lang.toLowerCase().replace(/_/g,"-")===STORY_SPEECH_LOCALE[language].toLowerCase()?1:0;
    return exactB-exactA || a.name.localeCompare(b.name);
  });
}

export function preferredStoryVoice<T extends StoryVoice>(voices:readonly T[],language:StoryLanguage,selectedUri:string|null):T|null{
  const choices=voicesForStoryLanguage(voices,language);
  if(!choices.length)return null;
  return (selectedUri?choices.find(v=>v.voiceURI===selectedUri):undefined)??choices[0];
}

export function parseStoredVoiceChoices(raw:string|null):Record<StoryLanguage,string>{
  const fallback={ru:"",uz:"",en:""};
  if(!raw)return fallback;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return fallback;
    const obj=parsed as Record<string,unknown>;
    const clean=(key:StoryLanguage)=>typeof obj[key]==="string"&&obj[key].length<=256?obj[key]:"";
    return {ru:clean("ru"),uz:clean("uz"),en:clean("en")};
  }catch{return fallback;}
}
