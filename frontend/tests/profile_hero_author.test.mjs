import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = readFileSync(new URL("../src/ParentAccount.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const legal = readFileSync(new URL("../src/LegalCenter.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/reader-polish.css", import.meta.url), "utf8");
const png = readFileSync(new URL("../public/images/profile-story-hero.png", import.meta.url));

test("profile artwork is a real PNG under static assets", () => {
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.ok(png.length > 1000);
  assert.match(profile, /src="\/images\/profile-story-hero\.png"/);
  assert.match(profile, /decoding="async"/);
});

test("profile has accessible personalized artwork and compact responsive layout",()=>{
  assert.match(profile,/className="parent-account-hero"/);
  assert.match(profile,/className="parent-account-hero-art"/);
  assert.match(profile,/alt=\{\(\{ru:/);
  assert.match(css,/\.parent-account-page \.parent-account-hero\{/);
  assert.match(css,/@media screen and \(max-width:340px\)/);
});

test("author Komron Giyosov is consistently attributed in profile legal texts and footer",()=>{
  assert.match(profile,/Komron Giyosov/);
  assert.match(main,/WonderTale AI · Komron Giyosov/);
  assert.match(legal,/Разработчик проекта: Komron Giyosov/);
  assert.match(legal,/Project developer: Komron Giyosov/);
  assert.match(legal,/Loyiha ishlab chiquvchisi: Komron Giyosov/);
});
