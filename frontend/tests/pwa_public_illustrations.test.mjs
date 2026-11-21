import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const match = source.match(/const PUBLIC_ASSET = (\/\^[^\n]+\/);/);
assert.ok(match, "Public cache asset allowlist must exist");
const allowed = Function("return " + match[1])();

test("creator and library illustration assets may be cached after first use", () => {
  for (const path of [
    "/images/create-boy.png", "/images/create-girl.png", "/images/create-fox.png",
    "/images/create-dragon.png", "/images/create-robot.png",
    "/images/create-hero-story.png", "/images/create-read-story-banner.png",
    "/images/library-magic-castle.png", "/images/library-story-castle-premium.png",
    "/images/profile-castle.png", "/images/profile-story-hero.png"
  ]) {
    assert.ok(allowed.test(path), "Expected a public asset: " + path);
  }
});

test("generated and personal images stay outside the offline public cache", () => {
  for (const path of [
    "/api/books/123", "/media/child-photo.png", "/images/private/child.png",
    "/images/create-private-photo.png", "/account/profile.jpg",
    "/images/create-boy.png/private", "/images/profile-castle.png/child"
  ]) {
    assert.equal(allowed.test(path), false, "Must not cache " + path);
  }
});

test("service worker public cache version advances for this allowlist", () => {
  assert.match(source, /const CACHE = "wondertale-public-v10"/);
});
