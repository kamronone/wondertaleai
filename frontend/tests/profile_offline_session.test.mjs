import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const parent=readFileSync(new URL("../src/ParentAccount.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/profile-concept-three.css",import.meta.url),"utf8");

test("signed-in parent sees an explicit connection status and retry without losing logout",()=>{
 assert.match(parent,/session\?<div className="parent-account-card"/);
 assert.match(parent,/apiReady!==true&&<div className="parent-account-connection-state" role="status"/);
 assert.match(parent,/apiReady===false&&<button type="button" className="parent-account-secondary" onClick=\{\(\)=>setReadinessAttempt\(n=>n\+1\)\}/);
 assert.match(parent,/onClick=\{onLogout\}/);
 assert.match(css,/\.parent-account-connection-state\s*\{/);
});

test("sync is disabled until account API is ready, but local books remain unchanged",()=>{
 assert.match(parent,/onClick=\{\(\)=>void onSync\(\)\} disabled=\{syncBusy\|\|apiReady!==true\}/);
 assert.match(parent,/Сохранённые книги не удалены/);
 assert.match(parent,/Saqlangan kitoblar öçirilmadi/);
 assert.doesNotMatch(parent,/localStorage\.clear\(/);
});

test("iPhone profile inputs remain at least 16px without zoom",()=>{
 assert.match(css,/input\[type="email"\]/);
 assert.match(css,/input\[type="password"\]/);
 assert.match(css,/font-size:16px!important/);
});
