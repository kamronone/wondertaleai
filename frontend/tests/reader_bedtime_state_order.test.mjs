import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("bedtime timer state is declared before the ambience cleanup effect reads it", () => {
  const declaration = "const [bedtimeUntil,setBedtimeUntil]=useState<number|null>(null);";
  const dependency = "[active?.id,tab,readerNightMode,bedtimeUntil]";
  const stateAt = source.indexOf(declaration);
  const effectAt = source.indexOf(dependency);

  assert.notEqual(stateAt, -1, "the bedtime timer state must exist");
  assert.notEqual(effectAt, -1, "the ambience effect must track the bedtime timer");
  assert.ok(stateAt < effectAt, "the state must be initialized before dependency evaluation");
  assert.equal(source.split(declaration).length - 1, 1, "do not create duplicate React state hooks");
});

test("bedtime countdown effect still cancels its timeout", () => {
  assert.match(source, /const remaining=bedtimeUntil-Date\.now\(\)/);
  assert.match(source, /return \(\)=>window\.clearTimeout\(timeout\)/);
});
