import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const panel=readFileSync(new URL("../src/AiJobsPanel.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("completed AI jobs open their exact server-confirmed book ID",()=>{
 assert.match(panel,/onOpenLibrary:\(bookId:string\)=>void/);
 assert.match(panel,/if\(job\.book_id\)onOpenLibrary\(job\.book_id\)/);
 assert.match(app,/const openCompletedAiBook=async\(bookId:string\)=>\{/);
 assert.match(app,/onOpenLibrary=\{\(bookId\)=>\{void openCompletedAiBook\(bookId\);\}\}/);
 assert.match(app,/remote\.find\(entry=>entry\.id===bookId\)/);
 assert.match(app,/openBook\(book\)/);
});

test("read-only fetch uses session-isolation guards and does not repeat paid generation",()=>{
 const body=app.slice(app.indexOf("const openCompletedAiBook=async("),app.indexOf("  useEffect(()=>{\n    speechRun.current++"));
 assert.match(body,/const epoch=sessionEpoch\.current/);
 assert.match(body,/const token=privateToken/);
 assert.match(body,/await loadPrivateBooks\(API,token\)/);
 assert.match(body,/if\(sessionEpoch\.current!==epoch\)return/);
 assert.doesNotMatch(body,/enqueueAiJob|api\/books\/generate|createDemoBook|localStorage/);
 assert.match(body,/if\(!book\)\{/);
 assert.match(body,/setTab\("library"\)/);
 assert.match(body,/setRemoteBooks\(previous=>\[book,\.\.\.previous\.filter/);
});

test("missing or delayed books provide visible retry advice instead of opening a wrong book",()=>{
 assert.match(app,/Сказка готова, но пока не появилась в библиотеке/);
 assert.match(app,/Could not open the completed story/);
 assert.match(panel,/job\.status==="completed"/);
});
