import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const stories=["cinderella","rapunzel","snow-white"];
const root=new URL("../",import.meta.url);
test("all three draft films have complete ordered scripts in three languages",()=>{
 for(const story of stories){
  const source=JSON.parse(readFileSync(new URL("scripts/film-sources/"+story+".json",root),"utf8"));
  assert.equal(source.storyId,story);
  assert.deepEqual(source.languages,["ru","uz","en"]);
  assert.equal(source.scenes.length,8);
  for(const [index,scene] of source.scenes.entries()){
   assert.equal(scene.page,index+1);
   assert.equal(scene.image,"/images/classics/"+story+"/pages/page-"+(index+1)+".png");
   assert.deepEqual(Object.keys(scene.narration).sort(),["en","ru","uz"]);
   for(const text of Object.values(scene.narration))assert.ok(text.trim().length>=10&&text.length<=500&&!text.includes("\n"));
   if(story!=="snow-white")assert.ok(existsSync(new URL("public"+scene.image,root)));
  }
 }
});
test("film builder validates assets before network and supports local narration",()=>{
 const source=readFileSync(new URL("scripts/build-cinderella-film.py",root),"utf8");
 assert.ok(source.includes('parser.add_argument("--check"'));
 assert.ok(source.includes('parser.add_argument("--audio-dir"'));
 assert.ok(source.includes('parser.add_argument("--allow-network-tts"'));
 assert.ok(source.indexOf("missing = validate_source")<source.indexOf("import edge_tts"));
 assert.ok(source.indexOf("if args.check:")<source.indexOf("import edge_tts"));
 assert.ok(source.includes("shutil.copyfile(args.audio_dir"));
 assert.ok(source.includes("if not args.audio_dir and not args.allow_network_tts"));
 assert.ok(source.includes("if not math.isfinite(duration)"));
});


test("Snow White script follows the reviewed eight-panel artwork",()=>{
 const source=JSON.parse(readFileSync(new URL("scripts/film-sources/snow-white.json",root),"utf8"));
 const markers={ru:["яблоко","сон","проснулась","свадьбу","гномов"],uz:["olma","uyqu","uyğondi","töy","mitti"],en:["apple","sleep","awoke","wedding","dwarfs"]};
 for(const lang of source.languages)for(const [i,marker] of markers[lang].entries())assert.ok(source.scenes[i+3].narration[lang].toLowerCase().includes(marker));
});
