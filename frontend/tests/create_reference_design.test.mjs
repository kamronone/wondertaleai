import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-reference.css",import.meta.url),"utf8");
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);

test("creation wizard implements the approved reference without replacing its three steps",()=>{
  assert.match(app,/className="create-page create-reference-page"/);
  assert.match(app,/import "\.\/create-reference\.css"/);
  assert.match(app,/createStep===1/);
  assert.match(app,/createStep===2/);
  assert.match(app,/createStep===3/);
  assert.match(app,/className="create-reference-hero"/);
  assert.doesNotMatch(app,/className="create-reference-reading-link"/);
  assert.doesNotMatch(app,/className="create-v4-worlds"/);
  assert.match(app,/className="wizard-step-two-worlds"/);
});

test("all seven reference artworks are real PNGs",()=>{
  for(const name of ["hero-story","read-story-banner","boy","girl","fox","robot","dragon"]){
    const image=readFileSync(new URL("../public/images/create-"+name+".png",import.meta.url));
    assert.ok(image.subarray(0,8).equals(pngSignature),name);
    assert.ok(image.length>1000,name);
  }
});

test("five hero cards have genuine selection state and influence generated story context",()=>{
  assert.match(app,/setHeroKind\(kind\)/);
  assert.match(app,/aria-pressed=\{heroKind===kind\}/);
  assert.match(app,/heroKind,setHeroKind/);
  assert.match(app,/setHeroKind\("boy"\)/);
  assert.match(app,/const storyIdeaWithHero=/);
  assert.match(app,/idea:storyIdeaWithHero/);
  assert.match(app,/createDemoBook\(heroes,Number\(age\),theme,style,storyIdeaWithHero/);
  assert.match(app,/heroKindLabel/);
});

test("essential controls remain visible and supplementary personal info is collapsed",()=>{
  assert.match(app,/value=\{name\} onChange=\{e=>\{setName/);
  assert.match(app,/value=\{age\} onChange=\{e=>setAge/);
  assert.match(app,/<details className="create-reference-extras">/);
  assert.match(app,/className="create-photo-unavailable"/);
  assert.match(app,/Загрузка фото отключена/);
  assert.doesNotMatch(app,/type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(app,/className="wizard-step-actions"/);
});

test("approved layout has mobile gallery without oversized buttons",()=>{
  assert.match(css,/\.create-hero-options\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/s);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/\.create-reference-reading-link\{/);
  assert.match(css,/\.wizard-step-actions \.primary-button\{/);
});
