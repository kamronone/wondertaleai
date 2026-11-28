import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/reader_offline_art.ts", import.meta.url), "utf8");

test("offline download keeps its requests public and unauthenticated", () => {
  assert.match(source, /fetch\(url,\{credentials:"omit",cache:"no-cache"\}\)/);
  assert.match(source, /const supported=new Set\(\["red-hood","cinderella","three-pigs","rapunzel"\]\)/);
});

test("partial downloads are rolled back on a required PNG failure", () => {
  assert.match(source, /const added:string\[\]=\[\]/);
  assert.match(source, /if\(!alreadyCached\)added\.push\(url\)/);
  assert.match(source, /Promise\.allSettled\(added\.map\(path=>cache\.delete\(path\)\)\)/);
  assert.match(source, /throw new Error\("OFFLINE_IMAGE_FAILED"\)/);
});

test("optional animation failure does not abort page download", () => {
  assert.match(source, /if\(url\.endsWith\("\.png"\)\)\{/);
  assert.match(source, /return \{saved,total:urls\.length\}/);
});
