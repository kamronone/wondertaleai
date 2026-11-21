import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
const client=read("../src/illustration_consent.ts");
const panel=read("../src/IllustrationConsentPanel.tsx");
const main=read("../src/main.tsx");

test("consent only sent with parent bearer token and current policy revision",()=>{
  assert.match(client,/Authorization:"Bearer "\+token/g);
  assert.match(client,/cache:"no-store"/g);
  assert.match(client,/ILLUSTRATION_POLICY_VERSION="illustration-pilot-v1"/);
  assert.match(client,/body:JSON\.stringify\(\{agreed,policy_version:ILLUSTRATION_POLICY_VERSION\}\)/);
  assert.match(client,/if\(updated\.agreed!==agreed\)/);
});
test("consent UI starts unchecked and requests explicit action",()=>{
  assert.match(panel,/useState\(false\)/);
  assert.match(panel,/checked=\{checked\}/);
  assert.match(panel,/disabled=\{!checked\|\|saving\}/);
  assert.match(panel,/onClick=\{\(\)=>void submit\(true\)\}/);
  assert.match(panel,/onClick=\{\(\)=>void submit\(false\)\}/);
});
test("account switch revokes active requests and hides previous data",()=>{
  assert.match(main,/key=\{privateToken\} api=\{API\} session=\{privateToken\} lang=\{lang\}/);
  assert.match(panel,/controller\.abort\(\)/);
  assert.match(panel,/epoch\.current===current/);
  assert.match(panel,/setConsent\(null\);setChecked\(false\)/);
});
test("pilot panel is disabled by default and has legal links",()=>{
  assert.match(main,/VITE_ENABLE_AI_ILLUSTRATION_CONSENT==="true"&&privateToken&&API/);
  assert.match(main,/onOpenPrivacy=\{\(\)=>openLegal\("privacy"\)\}/);
  assert.match(main,/onOpenParents=\{\(\)=>openLegal\("parents"\)\}/);
});
test("all three languages disclose third-party AI and revocation",()=>{
  assert.match(panel,/ru:\{/);
  assert.match(panel,/uz:\{/);
  assert.match(panel,/en:\{/);
  assert.match(panel,/Отозвать согласие/);
  assert.match(panel,/Rozilikni bekor qilish/);
  assert.match(panel,/Revoke consent/);
});
