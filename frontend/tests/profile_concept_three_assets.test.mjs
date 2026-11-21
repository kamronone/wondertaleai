import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const profile=readFileSync(new URL("../src/ParentAccount.tsx",import.meta.url),"utf8");
const layout=readFileSync(new URL("../src/profile-concept-three.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const legal=readFileSync(new URL("../src/ProfileLegalMenu.tsx",import.meta.url),"utf8");

const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
for(const name of ["profile-story-hero.png","profile-castle.png"]){
 test(name+" is a real local PNG asset",()=>{
   const image=readFileSync(new URL("../public/images/"+name,import.meta.url));
   assert.ok(image.subarray(0,8).equals(pngSignature),name);
   assert.ok(image.length>1000,name);
 });
}

test("approved concept three includes both artwork pieces in profile hero",()=>{
 assert.match(profile,/src="\/images\/profile-story-hero\.png"/);
 assert.match(profile,/src="\/images\/profile-castle\.png"/);
 assert.match(profile,/Komron Giyosov/);
 assert.match(layout,/\.profile-concept-three \.parent-account-hero/);
 assert.match(layout,/\.profile-concept-three \.parent-account-castle img/);
});

test("demo state is not falsely presented as a functional switch",()=>{
 assert.match(profile,/<details className="parent-account-unavailable">/);
 assert.match(profile,/className="parent-profile-demo-pill" aria-hidden="true"/);
 assert.doesNotMatch(profile,/<input[^>]+type="checkbox"[^>]+demo/);
});

test("legal menu and plans remain clickable and separate from footer",()=>{
 assert.match(legal,/onClick=\{\(\)=>onOpen\(id\)\}/);
 assert.match(app,/className="profile-concept-three"/);
 assert.match(app,/className="account-plans-disclosure"/);
 assert.match(app,/\{ru:"Профиль",uz:"Profil",en:"Profile"\}/);
 const footer=app.slice(app.indexOf('<footer className="site-legal-footer">'),app.indexOf('</footer>',app.indexOf('<footer className="site-legal-footer">')));
 assert.doesNotMatch(footer,/<nav|openLegal/);
});
