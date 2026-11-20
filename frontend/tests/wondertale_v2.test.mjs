import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build } from "esbuild";

async function loadTS(file){
  const result=await build({
    entryPoints:[new URL("../src/"+file,import.meta.url).pathname],
    bundle:true,platform:"node",format:"esm",write:false
  });
  return import("data:text/javascript;base64,"+
    Buffer.from(result.outputFiles[0].contents).toString("base64"));
}
const [{discoverBooks},{getReadingAchievements}]=await Promise.all([
  loadTS("library_discovery.ts"),loadTS("reading_achievements.ts")
]);
const [app,css,i18n,worker,uzCheck]=await Promise.all([
  readFile(new URL("../src/main.tsx",import.meta.url),"utf8"),
  readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8"),
  readFile(new URL("../src/i18n.ts",import.meta.url),"utf8"),
  readFile(new URL("../public/sw.js",import.meta.url),"utf8"),
  readFile(new URL("../scripts/check-uzbek-orthography.mjs",import.meta.url),"utf8")
]);

test("Library search is case-insensitive, scoped and leaves source data unchanged",()=>{
  const books=[
    {id:"a",title:"Forest",name:"Amir",theme:"forest",created_at:"2026-11-20",favorite:true,pages:[1,2],lastPage:1,mode:"browser-demo"},
    {id:"b",title:"Moon",name:"Lina",theme:"space",created_at:"2026-11-18",favorite:false,pages:[1,2],lastPage:0,mode:"browser-demo"}
  ];
  assert.deepEqual(discoverBooks(books," amIR ",false,"newest").map(b=>b.id),["a"]);
  assert.deepEqual(discoverBooks(books,"",true,"newest").map(b=>b.id),["a"]);
  assert.equal(books[0].id,"a");
});

test("Six achievements are derived from current books, not a shared user counter",()=>{
  const book={id:"a",pages:[1,2],lastPage:1,favorite:true,theme:"forest",savedOnDevice:true,mode:"browser-demo"};
  const empty=getReadingAchievements([]);
  const filled=getReadingAchievements(Array.from({length:5},(_,i)=>({...book,id:String(i),theme:String(i)})));
  assert.equal(empty.total,6);
  assert.equal(empty.unlocked,0);
  assert.equal(filled.unlocked,6);
});

test("Home, creator, reader and library use compact and accessible controls",()=>{
  assert.match(css,/\.library-page \.library-discovery/);
  assert.match(css,/\.shell button:focus-visible/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(app,/discoverBooks\(books,libraryQuery,favoritesOnly,librarySort\)/);
  assert.match(app,/aria-pressed=\{favoritesOnly\}/);
  assert.match(app,/id="story-prompt-count"/);
  assert.match(app,/aria-describedby="story-prompt-count"/);
  assert.match(app,/readingStats\.unlocked/);
});

test("Welcome screen stays uncluttered while the header retains language selection",()=>{
  assert.doesNotMatch(app,/id="welcome-language-select"/);
  assert.match(app,/className="language-control"/);
  assert.match(app,/onChange=\{e=>switchLang\(e\.target\.value as Lang\)\}/);
  assert.match(uzCheck,/Onboarding must not show the language selector/);
});

test("Onboarding has a single-tap skip path, without changing saved language",()=>{
  assert.match(app,/className="welcome-skip" onClick=\{\(\)=>finishOnboarding\("home"\)\}/);
  assert.match(app,/const finishOnboarding=\(destination:"home"\|"account"\)=>\{/);
  assert.match(app,/localStorage\.setItem\("wondertale-onboarding-v1","seen"\)/);
  assert.doesNotMatch(app,/id="welcome-language-select"/);
  assert.match(app,/className="language-control"/);
  assert.match(css,/\.welcome-screen \.welcome-skip\{/);
  assert.match(css,/\.welcome-screen \.welcome-skip:focus-visible\{/);
});

test("Small iPhones retain readable welcome controls without oversized buttons",()=>{
  assert.match(css,/@media\(max-width:620px\)\{\s*\.welcome-screen \.welcome-content/);
  assert.match(css,/\.welcome-screen \.welcome-primary,\s*\.welcome-screen \.welcome-secondary\{[\s\S]*?min-height:44px;max-width:360px/);
  assert.match(css,/@media\(max-height:660px\)\{/);
});

test("Honest illustrations copy does not promise unavailable photo-based generation",()=>{
  assert.doesNotMatch(i18n,/В AI-режиме иллюстрации создаются по фотографии малыша/);
  assert.doesNotMatch(i18n,/In AI mode, pictures are inspired by your child's photo/);
  assert.match(i18n,/Персональные AI-иллюстрации пока недоступны/);
});

test("PWA preloads only bundled public artwork and never API paths",()=>{
  assert.match(worker,/wondertale-public-v8/);
  assert.match(worker,/\/images\/features\/real-book\.png/);
  assert.match(worker,/const PRIVATE_PATH =/);
  assert.match(worker,/request\.headers\.has\("Authorization"\)/);
});


test("Library filters are reset on successful parent switch and logout",()=>{
  assert.match(app,/clearChildDraft\(\);\s*\/\/ Search and favorites[\s\S]*?setLibraryQuery\(""\);setLibrarySort\("newest"\);setFavoritesOnly\(false\);\s*setPrivateToken\(token\)/);
  assert.match(app,/setLibraryQuery\(""\);setLibrarySort\("newest"\);setFavoritesOnly\(false\);\s*setPrivateToken\(null\)/);
});

test("Reader cover thumbnails expose the book title and completion state",()=>{
  assert.match(app,/const finished=book\.pages\.length>1/);
  assert.match(app,/alt=\{book\.title\+" · "\+labels\[lang\]\.cover\}/);
  assert.match(app,/aria-label=\{book\.title\+" · "\+book\.name/);
});


test("Home offers one-tap reading continuation only for unfinished multi-page books",()=>{
  assert.match(app,/const continueBook=books\.find\(book=>book\.pages\.length>1/);
  assert.match(app,/\(book\.lastPage\?\?0\)<book\.pages\.length-1/);
  assert.match(app,/className="continue-story-card" onClick=\{\(\)=>openBook\(continueBook\)\}/);
  assert.match(css,/\.continue-story-card/);
});


test("Onboarding arrows do not intercept focused controls",()=>{
  assert.match(app,/target\.closest\("button, select, input, textarea, \[role='button'\]"\)\)return;/);
  assert.match(app,/event\.key==="ArrowRight"\)\{event\.preventDefault\(\);setOnboardingStep/);
  assert.match(app,/event\.key==="ArrowLeft"\)\{event\.preventDefault\(\);setOnboardingStep/);
  assert.match(app,/aria-label=\{\(\{ru:"Экраны знакомства"/);
});


test("Onboarding ignores pinch zoom, simultaneous releases and cancelled touch sequences",()=>{
  assert.match(app,/if\(event\.touches\.length!==1\)\{welcomeTouchStart\.current=null;return;\}/);
  assert.match(app,/if\(event\.touches\.length!==1\)welcomeTouchStart\.current=null;/);
  assert.match(app,/event\.touches\.length!==0\|\|event\.changedTouches\.length!==1/);
  assert.match(app,/item\.identifier===start\.identifier/);
  assert.match(app,/onTouchMove=\{onWelcomeTouchMove\}/);
  assert.match(app,/onTouchCancel=\{onWelcomeTouchCancel\}/);
});

test("Onboarding slides can receive keyboard focus without hijacking controls",()=>{
  assert.match(app,/className="welcome-screen"[^>]*tabIndex=\{0\}/);
  assert.match(app,/target\.closest\("button, select, input, textarea, \[role='button'\]"\)/);
});


test("Expired parent sessions persist offline edits before clearing account data",()=>{
  const expirationHandlers=[...app.matchAll(/if\(error instanceof Error&&error\.message==="Private account authorization expired"\)\{([\s\S]*?)\n\s*setSyncMessage\(/g)];
  assert.ok(expirationHandlers.length>=2,"Transfer and library-refresh handlers must both be covered");
  for(const [,body] of expirationHandlers){
    const persist=body.indexOf("persistPending();");
    const clear=body.indexOf("pendingProgress.current.clear();pendingFavorites.current.clear();");
    assert.ok(persist>=0&&clear>persist,"Persist pending changes before clearing them");
    assert.match(body,/offlineOwner\.current=null/);
    assert.match(body,/setPrivateToken\(null\)/);
    assert.match(body,/setActive\(null\)/);
    assert.ok(body.includes('setLibraryQuery("");setLibrarySort("newest");setFavoritesOnly(false);'));
  }
});
