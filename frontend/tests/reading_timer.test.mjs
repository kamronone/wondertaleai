import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/ReadingSessionTimer.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
test("reading session timer provides pause, resume and reset",()=>{
  assert.match(source,/setDeadline\(Date\.now\(\)\+remaining\*1000\)/);
  assert.match(source,/setRunning\(false\);setDeadline\(null\)/);
  assert.match(source,/const reset=/);
  assert.match(source,/visibilitychange/);
});
test("reading reminders do not pretend to enforce parental restrictions",()=>{
  assert.match(source,/not an app restriction/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
  assert.doesNotMatch(app,/<ReadingSessionTimer\\b/);
});
