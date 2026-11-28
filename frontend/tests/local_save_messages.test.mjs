import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");

test("Saving damaged local stories never suggests clearing browser data",()=>{
  assert.match(app,/const libraryHealth=getLocalLibraryHealth\(\);/);
  assert.match(app,/const localSaveError=libraryHealth==="corrupt"/);
  assert.match(app,/Не очищайте данные Safari или PWA/);
  assert.match(app,/Do not clear Safari or PWA data/);
});

test("Blocked Safari storage has a separate localized explanation",()=>{
  assert.match(app,/libraryHealth==="unavailable"/);
  assert.match(app,/Хранилище Safari недоступно/);
  assert.match(app,/Safari storage is unavailable/);
});

test("Generic storage problems retain a free-space error message",()=>{
  assert.match(app,/Не удалось сохранить изменения на этом устройстве/);
  assert.match(app,/Check available storage and browser settings/);
});
