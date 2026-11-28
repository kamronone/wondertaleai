import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/reader-mobile-v1.css", import.meta.url), "utf8");
const voice = /\.reader-page \.reader-voice-choice select\s*\{([^}]+)\}/.exec(css);

test("voice selector meets iOS Safari 16px minimum to avoid focus zoom", () => {
  assert.ok(voice, "voice selector styles must exist");
  const fontSize = /font-size:\s*(\d+)px/.exec(voice[1]);
  assert.ok(fontSize, "voice selector must have an explicit font size");
  assert.ok(Number(fontSize[1]) >= 16, "iOS Safari zooms focused form controls below 16px");
});

test("voice selector remains full width and accessible to touch", () => {
  assert.match(voice[1], /width:100%/);
  assert.match(voice[1], /min-width:0/);
  assert.match(voice[1], /min-height:44px/);
});
