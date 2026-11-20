import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const result = await build({
  entryPoints: [new URL("../src/story_language.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  write: false
});
const { translateSelectedStoryPrompt } = await import(
  "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64")
);

const classics = {
  ru: "Путешествие в сказочный лес",
  uz: "Sehrli o‘rmonga sayohat",
  en: "Journey into a magical forest"
};

test("Built-in story presets translate in both directions", async () => {
  const { storyPresets } = await import(
    "data:text/javascript;base64," + Buffer.from((await build({
      entryPoints: [new URL("../src/story_interactions.ts", import.meta.url).pathname],
      bundle: true, platform: "node", format: "esm", write: false
    })).outputFiles[0].contents).toString("base64")
  );
  for (const from of ["ru", "uz", "en"]) {
    for (const to of ["ru", "uz", "en"]) {
      for (const preset of storyPresets[from]) {
        const expected = storyPresets[to].find(item => item.id === preset.id)?.idea;
        assert.equal(translateSelectedStoryPrompt(preset.idea, from, to), expected);
      }
    }
  }
});

test("Classic templates translate only if unedited", () => {
  assert.equal(translateSelectedStoryPrompt(classics.ru, "ru", "en", classics), classics.en);
  assert.equal(translateSelectedStoryPrompt(classics.uz, "uz", "ru", classics), classics.ru);
  assert.equal(translateSelectedStoryPrompt(classics.en + " and my cat", "en", "ru", classics), classics.en + " and my cat");
});

test("Custom-written prompt never changes when switching languages", () => {
  const custom = "My child meets a gentle dragon near the lake";
  assert.equal(translateSelectedStoryPrompt(custom, "en", "ru"), custom);
  assert.equal(translateSelectedStoryPrompt(custom, "en", "uz"), custom);
});

test("Switching to the same language does not modify the prompt", () => {
  assert.equal(translateSelectedStoryPrompt(classics.ru, "ru", "ru", classics), classics.ru);
});


test("Choosing a custom story preserves a parent's edited classic prompt", async () => {
  const { leaveClassicStoryPrompt } = await import(
    "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64")
  );
  const custom = classics.ru + " и мой дракон";
  assert.equal(leaveClassicStoryPrompt(custom, "ru", classics), custom);
  assert.equal(leaveClassicStoryPrompt(classics.ru, "ru", classics), "");
  assert.equal(leaveClassicStoryPrompt(classics.en, "en", classics), "");
});

test("Choosing custom mode again never wipes an existing original idea", async () => {
  const { leaveClassicStoryPrompt } = await import(
    "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64")
  );
  assert.equal(leaveClassicStoryPrompt("My very own tale", "en"), "My very own tale");
  assert.equal(leaveClassicStoryPrompt("", "ru"), "");
});
