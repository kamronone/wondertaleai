import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/reader_family_preferences.ts");
const main=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const prefs=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("device preferences parse safely and do not mix in profile data",()=>{
 const defaults={extraActivities:true,ambientSoundAllowed:true};
 assert.deepEqual(prefs.parseFamilyReadingPreferences(null),defaults);
 assert.deepEqual(prefs.parseFamilyReadingPreferences("{"),defaults);
 assert.deepEqual(prefs.parseFamilyReadingPreferences("[]"),defaults);
 assert.deepEqual(prefs.parseFamilyReadingPreferences('{"extraActivities":false}'),{extraActivities:false,ambientSoundAllowed:true});
 assert.deepEqual(prefs.parseFamilyReadingPreferences('{"extraActivities":true,"ambientSoundAllowed":false}'),{extraActivities:true,ambientSoundAllowed:false});
 for(const secret of ["val.childName","val.birthdate","val.token","val.accountId","val.email"])assert.ok(!source.includes(secret));
});

test("reader family controls disable games hotspots and ambient audio",()=>{
 assert.match(main,/readFamilyReadingPreferences/);
 assert.match(main,/saveFamilyReadingPreferences\(next\)/);
 assert.match(main,/checked=\{familyReadingPreferences.extraActivities\}/);
 assert.match(main,/checked=\{familyReadingPreferences.ambientSoundAllowed\}/);
 assert.match(main,/familyReadingPreferences.extraActivities&&!readerFocusMode/);
 assert.match(main,/familyReadingPreferences.extraActivities&&!readerNightMode/);
 assert.match(main,/if\(!familyReadingPreferences.ambientSoundAllowed\)return/);
 assert.match(main,/if\(!familyReadingPreferences.ambientSoundAllowed&&ambiencePlayback.current\)/);
 assert.match(main,/Это не защищённый родительский контроль/);
});

test("achievements show remaining progress without invented reward states",()=>{
 assert.match(main,/Math.max\(0,item.goal-item.count\)/);
 assert.match(main,/item.unlocked/);
 assert.match(main,/reading-achievement-next/);
 assert.match(css,/\.reader-family-preferences/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/\.reading-achievement-next/);
});
