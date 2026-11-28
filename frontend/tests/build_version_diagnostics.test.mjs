import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const vite=read("../vite.config.ts");
const env=read("../src/vite-env.d.ts");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");

test("Netlify build diagnostics reveal only public commit and branch, no secrets",()=>{
 assert.match(vite,/process\.env\.COMMIT_REF/);
 assert.match(vite,/process\.env\.BRANCH/);
 assert.match(vite,/\^\[0-9a-f\]\{7,40\}\$/i);
 assert.match(vite,/__WONDERTALE_BUILD_SHA__/);
 assert.match(vite,/__WONDERTALE_BUILD_BRANCH__/);
 assert.doesNotMatch(vite,/OPENAI_API_KEY|DATABASE_URL|AUTH_SECRET|NETLIFY_AUTH_TOKEN/);
 assert.match(env,/declare const __WONDERTALE_BUILD_SHA__:string/);
});

test("version label is opt-in; normal readers see no diagnostics",()=>{
 assert.match(app,/new URLSearchParams\(window\.location\.search\)\.get\("wt_version"\)==="1"/);
 assert.match(app,/\{SHOW_BUILD_VERSION&&<aside className="wt-build-debug"/);
 assert.match(app,/Commit: \{__WONDERTALE_BUILD_SHA__\}/);
 assert.match(app,/Branch: \{__WONDERTALE_BUILD_BRANCH__\}/);
 assert.match(css,/\.wt-build-debug\{/);
});
