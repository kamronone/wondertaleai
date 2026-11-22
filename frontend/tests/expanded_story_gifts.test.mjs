import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/scene_gift_data.ts");
const app=read("../src/main.tsx");
const gift=read("../src/StoryGiftInteraction.tsx");
const scenes=[
  ["snow-white",4,"flower-basket.svg"],
  ["ugly-duckling",5,"pond-lily.svg"],
  ["bremen",4,"music-bell.svg"],
  ["rapunzel",3,"tower-flower.svg"]
];
test("four new fairy tales offer illustrated page-specific gifts in three languages",async()=>{
 const transpiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
 const {storyGiftForPage}=await import("data:text/javascript;base64,"+Buffer.from(transpiled.code).toString("base64"));
 for(const [id,page,filename] of scenes){
  const entry=storyGiftForPage(id,page);
  assert.ok(entry,id+":"+page);
  assert.equal(entry.asset,"/images/interactions/"+filename);
  assert.ok(existsSync(new URL("../public/images/interactions/"+filename,import.meta.url)));
  const svg=read("../public/images/interactions/"+filename);
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<title/);
  for(const language of ["ru","uz","en"]){
    assert.ok(entry.instruction[language].length>10,id+":"+language);
    assert.ok(entry.reply[language].length>10,id+":"+language);
  }
  for(const position of [entry.start,entry.target]){
    assert.ok(position.x>=0 && position.x<=1);
    assert.ok(position.y>=0 && position.y<=1);
  }
  assert.equal(storyGiftForPage(id,9),null);
 }
 assert.equal(storyGiftForPage("private-book",4),null);
});
test("new scenes do not automatically turn pages and obey family preferences",()=>{
 assert.match(gift,/setDelivered\(true\)/);
 assert.match(gift,/role="status" aria-live="polite"/);
 assert.doesNotMatch(gift,/setTimeout\(|setPage\(|nextPage\(/);
 assert.match(app,/isDemoBook\(active\)&&familyReadingPreferences\.extraActivities&&!readerFocusMode&&!readerNightMode&&bedtimeUntil===null&&storyGiftForPage/);
});
