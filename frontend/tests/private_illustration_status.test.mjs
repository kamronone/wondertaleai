import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const component=read("../src/PrivateReaderIllustration.tsx");
const app=read("../src/main.tsx");
const styles=read("../src/private-reader-illustration-status.css");

test("private pages distinguish missing images from actual private PNGs",()=>{
  assert.match(component,/status==="missing"/);
  assert.match(component,/status==="available"/);
  assert.match(component,/setStatus\("missing"\)/);
  assert.match(component,/setStatus\("error"\)/);
  assert.match(component,/loadPrivatePageIllustration\(/);
  assert.match(component,/private-reader-illustration wt-reader-picture/);
  assert.doesNotMatch(component,/:<>{fallback}<\/>/);
});

test("private reader exposes a safe retry action and revokes blob URLs",()=>{
  assert.match(component,/setRefresh\(v=>v\+1\)/);
  assert.match(component,/URL\.revokeObjectURL\(/);
  assert.match(component,/controller\.abort\(\)/);
  assert.match(component,/role="status"/);
  assert.match(component,/aria-live="polite"/);
});

test("localized notices are visible, without invented images",()=>{
  assert.match(component,/Иллюстрация ещё не создана/);
  assert.match(component,/Rasm hali yaratilmagan/);
  assert.match(component,/Illustration not generated yet/);
  assert.match(component,/Текст сказки доступен без изображения/);
  assert.match(component,/lang:Lang/);
  assert.match(app,/<PrivateReaderIllustration api=\{API\} session=\{privateToken\}/);
  assert.match(app,/alt=\{t\.illustration\+" "\+\(page\+1\)\} lang=\{lang\}/);
  assert.match(app,/import "\.\/private-reader-illustration-status\.css";/);
});

test("placeholder is compact and readable on mobile",()=>{
  assert.match(styles,/private-illustration-placeholder/);
  assert.match(styles,/@media\(max-width:380px\)/);
  assert.match(styles,/focus-visible/);
});
