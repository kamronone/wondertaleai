import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/shared-rounded-pages.css",import.meta.url),"utf8");

test("shared rounded page surface is imported after wizard and existing layout styles",()=>{
 assert.match(app,/import "\.\/shared-rounded-pages\.css";/);
 assert.ok(app.indexOf('import "./shared-rounded-pages.css";')>app.indexOf('import "./create-step-one-button.css";'));
 assert.match(app,/className="shell"/);
 assert.match(app,/<main>/);
});

test("other pages inherit one rounded main panel, while create keeps its prior treatment",()=>{
 assert.match(css,/main:not\(:has\(> \.create-page\.create-reference-page\)\)/);
 assert.match(css,/border-radius:32px 32px 0 0/);
 assert.match(css,/border-radius:29px 29px 0 0/);
 assert.match(css,/border-radius:24px 24px 0 0/);
 assert.match(css,/\.library-page\.library-concept-two/);
 assert.match(css,/\.profile-concept-three/);
 assert.match(css,/\.reader-page/);
});

test("rounded page surface does not clip scroll or rewrite fixed tabbar",()=>{
 assert.doesNotMatch(css,/overflow:hidden/);
 assert.doesNotMatch(css,/position:fixed/);
 assert.doesNotMatch(css,/\.mobile-tabbar\s*\{/);
 assert.match(css,/Leave the existing safe-area/);
});
