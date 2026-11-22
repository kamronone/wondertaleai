import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/private_library.ts",import.meta.url),"utf8");
const queue=readFileSync(new URL("../src/offline_queue.ts",import.meta.url),"utf8");
const sw=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");

test("all direct private actions are no-store",()=>{
  assert.match(app,/fetch\(API\+"\/api\/auth\/logout",\{method:"POST",cache:"no-store"/);
  assert.match(app,/fetch\(API\+"\/api\/books\/generate",\{\s*method:"POST",\s*cache:"no-store"/);
  assert.match(app,/fetch\(API\+"\/api\/books\/"\+book\.id,\{method:"DELETE",cache:"no-store"/);
});
test("private API reads and offline parent verification bypass HTTP caches",()=>{
  assert.match(api,/cache:"no-store",\s*headers:\{"Authorization"/);
  assert.match(queue,/fetch\(api\+"\/api\/me",\{\s*cache:"no-store"/);
});
test("service worker never intercepts auth or API paths",()=>{
  assert.match(sw,/const PRIVATE_PATH = \^/);
  assert.match(sw,/PRIVATE_PATH\.test\(url\.pathname\)/);
  assert.match(sw,/request\.headers\.has\("Authorization"\)/);
});
