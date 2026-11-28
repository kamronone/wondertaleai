import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
const catalog = read("classics.ts");
const full = ["classic_full_plots_a.ts", "classic_full_plots_b.ts", "classic_full_plots_c.ts"];
const extensions = ["classic_story_extra_d.ts", "classic_story_extra_e.ts"];
const languages = ["ru", "uz", "en"];

function storyIds(source) {
  return [...source.matchAll(/^"([a-z]+(?:-[a-z]+)*)":\{/gm)].map((match) => match[1]);
}
function catalogIds(source) {
  return [...source.matchAll(/(?:\bid:|"id":)\s*"([^"]+)"/g)].map((match) => match[1]);
}
function checkEightChapters(source, id, label) {
  const begin = source.indexOf(`"${id}":{`);
  assert.notEqual(begin, -1, `${label}: missing ${id}`);
  const rest = source.slice(begin);
  for (const language of languages) {
    const pattern = new RegExp(`(?:^|\\n)${language}:\\[([\\s\\S]*?)\\n\\]`, "m");
    const match = rest.match(pattern);
    assert.ok(match, `${label}/${id}: missing ${language}`);
    const chapters = match[1].split("\n").filter((line) => /^\s*"/.test(line));
    assert.equal(chapters.length, 8, `${label}/${id}/${language} must have eight chapters`);
    for (const [index, chapter] of chapters.entries()) {
      assert.ok(chapter.trim().length > 25, `${id}/${language}: chapter ${index + 1} is empty or very short`);
    }
  }
}

test("all catalog classics have a complete eight-page story in every language", () => {
  const ids = catalogIds(catalog);
  assert.equal(new Set(ids).size, ids.length, "duplicate classic IDs");
  const sources = [...full, ...extensions].map((name) => ({name, content: read(name)}));
  const owners = new Map();
  for (const source of sources) {
    for (const id of storyIds(source.content)) {
      assert.ok(ids.includes(id), `${source.name}: unknown classic ${id}`);
      assert.ok(!owners.has(id), `${id} has multiple story sources`);
      owners.set(id, source);
      checkEightChapters(source.content, id, source.name);
    }
  }
  assert.deepEqual([...owners.keys()].sort(), [...ids].sort(), "every classic needs eight story-specific chapters");
});

test("classic reading never silently replaces saved child books", () => {
  const source = read("demo.ts");
  assert.match(source, /const complete=fullClassicChapters\(id,name,language\)/);
  assert.match(source, /extendIllustratedClassic\(id,language,story\.pages\)/);
  assert.match(source, /if\(!canRefreshClassicDemoStory\(book\)\)return book/);
  assert.match(source, /Legacy copies must only be updated after explicit user confirmation/);
});
