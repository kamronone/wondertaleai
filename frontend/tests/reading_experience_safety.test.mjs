import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Reader themes are opt-in and never change the book pages", () => {
  const source = read("../src/main.tsx");
  const css = read("../src/bedtime-games.css");
  assert.match(source, /readerBookStyle/);
  assert.match(source, /book-style-"\+readerBookStyle/);
  assert.match(source, /wondertale_reader_book_style/);
  assert.match(css, /book-style-simple/);
  assert.match(css, /book-style-storybook/);
});

test("Parent reading suggestions do not claim to restrict child access", () => {
  const source = read("../src/ParentReadingGuide.tsx");
  assert.match(source, /does not restrict access/);
  assert.match(source, /not sent to the server/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /localStorage/);
});

test("Offline messaging and service worker never promise caching private books", () => {
  const app = read("../src/main.tsx");
  const sw = read("../../public/sw.js");
  assert.match(app, /private books are never stored in the PWA cache/);
  assert.match(sw, /const PRIVATE_PATH/);
  assert.match(sw, /request\.headers\.has\("Authorization"\)/);
  assert.match(sw, /PUBLIC_ASSET\.test\(url\.pathname\)/);
  assert.doesNotMatch(sw, /caches\.open\(.*private/);
});

test("The branching story is local-only with four endings", () => {
  const source = read("../src/StoryBranchQuest.tsx");
  assert.match(source, /Record<Trail,Record<Decision,string>>/);
  for (const name of ["forest","stars","help","explore"]) assert.ok(source.includes(name));
  assert.doesNotMatch(source, /fetch\s*\(/);
});
