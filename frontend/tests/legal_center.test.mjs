import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const legal=readFileSync(new URL("../src/LegalCenter.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");
const menu=readFileSync(new URL("../src/ProfileLegalMenu.tsx",import.meta.url),"utf8");

test("RU/UZ/EN legal pages include terms privacy copyright and child protection",()=>{
  for(const title of ["Условия использования","Политика конфиденциальности","Авторские права","Правила для родителей и детей","Foydalanish shartlari","Maxfiylik siyosati","Mualliflik huquqi","Ota-onalar uchun qoidalar","Terms of use","Privacy policy","Copyright and intellectual property","Parents and child safety"]){
    assert.ok(legal.includes(title),title);
  }
  for(const id of ["terms","privacy","copyright","parents"])assert.ok(legal.includes(id));
});

test("legal document links can be opened directly from a browser hash",()=>{
  assert.match(app,/readLegalHash/);
  assert.match(app,/hashchange/);
  assert.match(app,/#legal\//);
  assert.match(app,/className="site-legal-footer"/);
  assert.match(app,/<ProfileLegalMenu lang=\{lang\} onOpen=\{openLegal\}\/>/);
  assert.match(menu,/\{id:"copyright",Icon:Copyright\}/);
  assert.match(app,/<LegalCenter lang=\{lang\} document=\{legalDocument\}/);
});

test("reading legal terms returns to unfinished story wizard without clearing fields",()=>{
  assert.match(app,/setLegalReturnTab\(tab\)/);
  assert.match(app,/onBack=\{\(\)=>setTab\(legalReturnTab\)\}/);
  assert.match(app,/className="legal-consent-links"/);
});

test("creation requires separate parental confirmation and terms acceptance",()=>{
  assert.match(app,/const \[acceptedLegal,setAcceptedLegal\]=useState\(false\)/);
  assert.match(app,/setConsent\(false\);setAcceptedLegal\(false\)/);
  assert.match(app,/if\(!acceptedLegal\)/);
  assert.match(app,/if\(!consent\)/);
  assert.match(app,/disabled=\{busy\|\|!consent\|\|!acceptedLegal\} type="submit"/);
});

test("legal screens do not claim unverified compliance or registered trademarks",()=>{
  assert.match(legal,/does not claim that Uzbekistan/);
  assert.match(legal,/not establish ownership or trademark registration/);
  assert.match(legal,/simple checkbox may not meet/);
  assert.match(legal,/The current AI generator does not accept child photos/);
  assert.match(css,/\.legal-center \.legal-tabs/);
});
