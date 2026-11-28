/** Device-only reading preferences.
 * These settings are convenience controls, not authenticated parental gates.
 * Never contain names, birthdates, access tokens or reading history.
 */
export type FamilyReadingPreferences={extraActivities:boolean;ambientSoundAllowed:boolean};
export const FAMILY_PREFERENCES_KEY="wondertale_family_reading_v1";
export const DEFAULT_FAMILY_PREFERENCES:FamilyReadingPreferences={extraActivities:true,ambientSoundAllowed:true};
export function parseFamilyReadingPreferences(raw:string|null):FamilyReadingPreferences{
 if(!raw)return {...DEFAULT_FAMILY_PREFERENCES};
 try{
   const o:unknown=JSON.parse(raw);
   if(!o||typeof o!=="object"||Array.isArray(o))return {...DEFAULT_FAMILY_PREFERENCES};
   const val=o as Record<string,unknown>;
   return {
     extraActivities:typeof val.extraActivities==="boolean"?val.extraActivities:true,
     ambientSoundAllowed:typeof val.ambientSoundAllowed==="boolean"?val.ambientSoundAllowed:true
   };
 }catch{return {...DEFAULT_FAMILY_PREFERENCES};}
}
export function readFamilyReadingPreferences():FamilyReadingPreferences{
 try{return parseFamilyReadingPreferences(localStorage.getItem(FAMILY_PREFERENCES_KEY));}
 catch{return {...DEFAULT_FAMILY_PREFERENCES};}
}
export function saveFamilyReadingPreferences(value:FamilyReadingPreferences):boolean{
 try{
   localStorage.setItem(FAMILY_PREFERENCES_KEY,JSON.stringify({
     extraActivities:value.extraActivities,
     ambientSoundAllowed:value.ambientSoundAllowed
   }));
   return true;
 }catch{return false;}
}
