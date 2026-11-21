import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const menu=readFileSync(new URL("../src/ProfileLegalMenu.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");
const concept=readFileSync(new URL("../src/profile-concept-three.css",import.meta.url),"utf8");

test("legal entry points live in account profile and not global footer",()=>{
  assert.match(app,/\{tab==="account"&&<section className="profile-concept-three">[\s\S]*?<ProfileLegalMenu lang=\{lang\} onOpen=\{openLegal\}\/>/);
  const footer=app.slice(app.indexOf('<footer className="site-legal-footer">'),app.indexOf('</footer>',app.indexOf('<footer className="site-legal-footer">')));
  assert.match(footer,/Komron Giyosov/);
  assert.doesNotMatch(footer,/openLegal|<nav/);
});

test("all four legal documents are accessible through functional profile buttons",()=>{
  for(const entry of ['{id:"terms",Icon:FileText}','{id:"privacy",Icon:ShieldCheck}','{id:"copyright",Icon:Copyright}','{id:"parents",Icon:UsersRound}'])
    assert.ok(menu.includes(entry),entry);
  assert.match(menu,/onClick=\{\(\)=>onOpen\(id\)\}/);
  assert.match(menu,/type="button"/);
  assert.match(menu,/ProfileLegalMenu/);
  assert.match(menu,/Huquqiy ma'lumot/);
});

test("mobile layout uses readable full-width rows without overflow",()=>{
  assert.match(styles,/\.profile-legal-links\s*>\s*button\s*\{[^}]*min-height:52px/s);
  assert.match(styles,/@media screen and \(max-width:620px\)\{\s*\.profile-legal-menu/);
  assert.match(styles,/\.profile-legal-links\s*\{\s*grid-template-columns:1fr/s);
});

test("opening a profile legal page preserves return tab",()=>{
  assert.match(app,/if\(tab!=="legal"\)setLegalReturnTab\(tab\)/);
  assert.match(app,/onBack=\{\(\)=>setTab\(legalReturnTab\)\}/);
});

test("concept three renders one legal list and a distinct collapsed plan card",()=>{
  assert.match(concept,/\.profile-concept-three \.profile-legal-links\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(concept,/\.profile-concept-three \.profile-legal-links > button\s*\{[^}]*min-height: 67px/s);
  assert.match(app,/className="profile-plan-icon"/);
  assert.match(app,/className="profile-plan-copy"/);
  assert.match(app,/className="profile-plan-chevron"/);
});
