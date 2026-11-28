import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const app=read("main.tsx"),css=read("shared-control-standard.css"),reader=read("reader-controls-compact.css"),profile=read("profile-concept-three.css");
test("shared controls load after route styles and before final pager correction",()=>{
 const shared=app.indexOf('import "./shared-control-standard.css";');
 assert.ok(shared>app.indexOf('import "./private-reader-illustration-status.css";'));
 assert.ok(shared<app.indexOf('import "./reader-pager-no-overlap.css";'));
 for(const route of [".library-page.library-concept-two",".create-page.create-reference-page",".reader-page",".profile-concept-three",".cartoon-studio"])assert.ok(css.includes(route));
 assert.ok(css.includes("--wt-control-touch: 44px"));
 assert.ok(css.includes(":focus-visible"));
 assert.ok(!css.includes(".admin-shell"));
 assert.ok(!css.includes(".mobile-tabbar"));
 assert.ok(!css.includes(".pager"));
});
test("reader audio buttons can wrap without growing a horizontal grid",()=>{
 assert.ok(reader.includes("minmax(min(100%,125px),1fr)"));
 assert.ok(reader.includes("height:auto!important;"));
 assert.ok(reader.includes("max-height:none!important;"));
 assert.ok(!reader.includes("white-space:nowrap!important"));
});
test("profile controls stay accessible and input text does not trigger Safari zoom",()=>{
 assert.ok(profile.includes("width:44px;height:44px;flex-basis:44px"));
 assert.ok(profile.includes("flex-basis:44px;width:44px;height:44px"));
 assert.ok(css.includes("max-height: min(70dvh, 520px)"));
 assert.ok(css.includes("font-size: 16px !important"));
 assert.ok(css.includes('input:not([type="checkbox"])'));
});
test("library search follows existing theme tokens",()=>{
 assert.ok(css.includes('.shell[data-site-theme="forest"] .library-page'));
 assert.ok(css.includes('.shell[data-site-theme="night"] .library-page'));
 assert.ok(css.includes("color: var(--wt-site-ink) !important"));
});

test("icon-only mobile profile button retains a localized accessible name",()=>{
 const header=app.slice(app.indexOf('<header className="topbar">'),app.indexOf('</header>}',app.indexOf('<header className="topbar">')));
 assert.ok(header.includes('className="small-button" aria-label='));
 assert.ok(header.includes('ru:"Профиль",uz:"Profil",en:"Profile"'));
 assert.ok(header.includes('onClick={()=>setTab("account")}'));
});
