import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const site=read("../src/site_theme.ts");
const app=read("../src/main.tsx");
const profile=read("../src/ProfileHeader.tsx");
const css=read("../src/site-appearance.css");
test("three appearance themes are localized for RU UZ EN and persist safely",async()=>{
 const compiled=await transform(site,{loader:"ts",format:"esm",target:"es2022"});
 const {SITE_THEMES,siteThemeLabels,nextSiteTheme,SITE_THEME_KEY}=await import("data:text/javascript;base64,"+Buffer.from(compiled.code).toString("base64"));
 assert.deepEqual([...SITE_THEMES],["fairy","forest","night"]);
 assert.equal(nextSiteTheme("fairy"),"forest");
 assert.equal(nextSiteTheme("forest"),"night");
 assert.equal(nextSiteTheme("night"),"fairy");
 assert.equal(SITE_THEME_KEY,"wondertale_site_theme_v1");
 for(const lang of ["ru","uz","en"]){
  assert.ok(siteThemeLabels[lang].heading.length>5);
  for(const name of SITE_THEMES)assert.ok(siteThemeLabels[lang][name].length>3);
 }
 assert.match(site,/try\{localStorage\.setItem\(SITE_THEME_KEY,theme\);\}catch/);
 assert.match(site,/try\{[\s\S]*localStorage\.getItem\(SITE_THEME_KEY\)/);
});
test("site theme is configurable in profile only, with a clean header",()=>{
 assert.match(app,/data-site-theme=\{siteTheme\}/);
 assert.doesNotMatch(app,/className="wt-site-theme-cycle"/);
 assert.doesNotMatch(app,/className="language-control"/);
 assert.match(app,/className="header-actions"><button type="button" className="small-button"/);
 assert.match(app,/onSiteTheme=\{changeSiteTheme\}/);
 assert.match(profile,/SITE_THEMES\.map\(theme=>/);
 assert.match(profile,/aria-pressed=\{siteTheme===theme\}/);
 assert.match(profile,/siteThemeLabels\[lang\]\.heading/);
 assert.doesNotMatch(site,/wondertale_reader_night_mode|wondertale_reader_book_style/);
});
test("night and forest appearance style mobile navigation without recoloring user art",()=>{
 for(const mode of ["forest","night"])assert.ok(css.includes('[data-site-theme="'+mode+'"]'));
 assert.match(css,/\.wt-theme-choice\[aria-pressed="true"\]/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/\.wt-reader-picture\s*\{|filter:invert\(/);
});
