import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const legal=readFileSync(new URL("../src/LegalCenter.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/legal-release-notice.css",import.meta.url),"utf8");

test("draft notice appears on all legal documents and in each supported language",()=>{
  assert.match(app,/import "\.\/legal-release-notice\.css"/);
  assert.match(legal,/className="legal-release-notice" role="note"/);
  assert.match(legal,/Документы ещё не утверждены/);
  assert.match(legal,/Hujjatlar hali tasdiqlanmagan/);
  assert.match(legal,/These documents are not finalized/);
});
test("the notice avoids claims of completed legal compliance or payments",()=>{
  assert.match(legal,/Платежи не подключены/);
  assert.match(legal,/The legal operator, contact channel, guardian consent process/);
  assert.match(css,/\.legal-center \.legal-release-notice/);
});
