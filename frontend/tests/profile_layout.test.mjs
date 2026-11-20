import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile=readFileSync(new URL("../src/ParentAccount.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("offline demo account status is compact, with extra details on demand",()=>{
  assert.match(profile,/className="parent-account-status"/);
  assert.match(profile,/<details className="parent-account-help">/);
  assert.match(profile,/onClick=\{\(\)=>setReadinessAttempt\(n=>n\+1\)\}/);
  assert.match(css,/\.parent-account-page \.parent-account-status\{/);
});

test("reading suggestions are collapsed by default while remaining accessible",()=>{
  assert.match(profile,/<details className="parent-account-reading-section">/);
  assert.match(profile,/<summary><BookOpen size=\{18\}/);
  assert.match(profile,/<ParentReadingGuide lang=\{lang\}\/>/);
  assert.doesNotMatch(profile,/<details className="parent-account-reading-section" open/);
  assert.match(css,/\.parent-account-page \.parent-account-reading-section>summary/);
});

test("auth, saved stories and family actions are preserved",()=>{
  assert.match(profile,/className="parent-account-card" onSubmit=\{submit\}/);
  assert.match(profile,/onLogin\(data\.access_token\)/);
  assert.match(profile,/onClick=\{\(\)=>void onSync\(\)\}/);
  assert.match(profile,/<FamilyProfiles key=\{session\}/);
  assert.match(profile,/onClick=\{onLogout\}/);
});

test("small phone styles keep status and disclosures lightweight",()=>{
  assert.match(css,/@media screen and \(max-width:620px\)\{/);
  assert.match(css,/\.parent-account-page \.parent-account-head\{gap:10px;margin:0 0 14px\}/);
  assert.match(css,/\.parent-account-page \.parent-account-card,\s*\.parent-account-page \.parent-account-unavailable\{/);
});
