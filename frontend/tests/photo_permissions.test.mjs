import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=file=>readFileSync(new URL(file,import.meta.url),"utf8");
const api=read("../src/photo_consents.ts");
const panel=read("../src/PhotoPermissionsPanel.tsx");
const app=read("../src/main.tsx");
const css=read("../src/photo-permissions.css");

test("photo consent uses distinct owner-authenticated API routes and policy versions",()=>{
  assert.match(api,/photo-reference-v1/);
  assert.match(api,/photo-external-ai-v1/);
  assert.match(api,/\/api\/photos\/consent/);
  assert.match(api,/\/api\/photos\/external-transfer-consent/);
  assert.match(api,/Authorization:"Bearer "\+session/);
  assert.match(api,/cache:"no-store"/);
  assert.match(api,/acknowledged_provider_transfer:agreed/);
  assert.match(api,/result\.agreed!==agreed/);
  assert.doesNotMatch(api,/localStorage|sessionStorage/);
});

test("parent cannot opt into external sharing implicitly",()=>{
  assert.match(panel,/kind==="external"&&agreed&&\(!local\.agreed\|\|!checked\)/);
  assert.match(panel,/!local\.agreed\|\|!checked/);
  assert.match(panel,/setChecked\(event\.target\.checked\)/);
  assert.match(panel,/setChecked\(false\)/);
  assert.match(panel,/update\("external",false\)/);
  assert.match(panel,/update\("local",!local\.agreed\)/);
  assert.ok(panel.includes("setLocal(null);setExternal(null);"));
  assert.ok(panel.includes("setVersion(v=>v+1);"));
  assert.ok(panel.includes("!busy&&!loading&&local&&external"));
  assert.ok(panel.includes("mutation.current===controller"));
});

test("photo permission panel is in parent account only and explains feature is off",()=>{
  assert.match(app,/privateToken&&API&&<PhotoPermissionsPanel/);
  assert.match(app,/import "\.\/photo-permissions\.css";/);
  assert.match(panel,/Загрузка фотографий и персональная ИИ-генерация сейчас недоступны/);
  assert.match(panel,/Photo uploads and personalized AI image generation are currently unavailable/);
  assert.match(panel,/Suratni taşqi AI xizmatiga yuboriş/);
  assert.match(panel,/external_photo_processing_enabled/);
  assert.match(panel,/role="alert"/);
  assert.doesNotMatch(panel,/type="file"/);
});

test("permission controls fit on narrow mobile widths",()=>{
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/photo-permissions-check/);
  assert.match(css,/min-height:38px/);
});
