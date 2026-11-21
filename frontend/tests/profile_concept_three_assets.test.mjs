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

test("tariff row is compact and expands with a right-side chevron",()=>{
 assert.match(app,/<ChevronRight size=\{19\} className="profile-plan-chevron"/);
 const tariff=layout.slice(layout.lastIndexOf("/* Tariff row:"));
 assert.match(tariff,/\.account-plans-disclosure > summary\s*\{[^}]*min-height:58px/s);
 assert.match(tariff,/\.profile-plan-icon\s*\{[^}]*width:38px/s);
 assert.match(tariff,/\.profile-plan-copy strong\s*\{[^}]*font-size:13px/s);
 assert.match(tariff,/\.account-plans-disclosure\[open\] \.profile-plan-chevron\s*\{[^}]*rotate\(90deg\)/s);
});

test("tariff crown is centered regardless of browser svg baseline styles",()=>{
 const fix=layout.slice(layout.lastIndexOf("/* Center the crown geometrically"));
 assert.match(fix,/\.account-plans-disclosure > summary \.profile-plan-icon\s*\{[^}]*display:flex/s);
 assert.match(fix,/justify-content:center/);
 assert.match(fix,/align-items:center/);
 assert.match(fix,/\.profile-plan-icon > svg\s*\{[^}]*display:block/s);
 assert.match(fix,/margin:auto/);
});
