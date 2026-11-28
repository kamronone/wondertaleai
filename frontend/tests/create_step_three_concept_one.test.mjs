import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/create-step-three-concept-one.css",import.meta.url),"utf8");
const third=app.slice(app.indexOf('{createStep===3&&'),app.indexOf('{error&&createStep!==3'));

test("compact final creation step is scoped and loaded after previous wizard CSS",()=>{
 assert.match(app,/import "\.\/create-step-three-concept-one\.css";/);
 assert.ok(app.indexOf('create-step-three-concept-one.css')>app.indexOf('create-step-two-concept-four.css'));
 assert.match(third,/className="wizard-step-three-v1"/);
 assert.match(third,/className="wizard-review wizard-step-three-review"/);
 assert.match(styles,/\.wizard-step-three-v1 \.wizard-step-three-review>dl\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("review keeps four essential facts and hides detailed plot without deleting it",()=>{
 for(const field of ['{t.childName}','{t.age}','{heroKindLabel}','{activeClassic?activeClassic.title[lang]:theme}']){
   assert.ok(third.includes(field),field);
 }
 assert.match(third,/className="wizard-step-three-details"/);
 assert.match(third,/<summary>\{\(\{ru:"Сюжет/);
 assert.match(third,/<p>\{prompt\}<\/p>/);
 assert.match(third,/\{t.storyLanguage\}/);
 assert.match(third,/\{t.style\}/);
 assert.match(third,/onClick=\{\(\)=>setCreateStep\(2\)\}/);
});

test("generation mode, save on device, legal links and required parent consent still work",()=>{
 assert.match(third,/onClick=\{\(\)=>setUsePersonalAi\(false\)\}/);
 assert.match(third,/onClick=\{\(\)=>setUsePersonalAi\(true\)\}/);
 assert.match(third,/checked=\{saveOnDevice\}/);
 assert.match(third,/checked=\{consent\}/);
 assert.match(third,/checked=\{acceptedLegal\}/);
 assert.match(third,/openLegal\("terms"\)/);
 assert.match(third,/openLegal\("privacy"\)/);
 assert.match(third,/openLegal\("parents"\)/);
 assert.match(third,/disabled=\{busy\|\|!consent\|\|!acceptedLegal\}/);
 assert.match(third,/type="submit"/);
});

test("phone buttons keep separate back and create actions",()=>{
 assert.match(styles,/grid-template-columns:minmax\(0,\.85fr\) minmax\(0,1\.15fr\)!important/);
 assert.match(styles,/min-height:48px!important/);
 assert.match(third,/className="wizard-step-actions wizard-step-three-actions"/);
});
