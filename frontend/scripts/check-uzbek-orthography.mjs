// Regression guard for the reformed Uzbek Latin alphabet in UI-owned copy.
// Run: node scripts/check-uzbek-orthography.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = [
  "src/i18n.ts",
  "src/main.tsx",
  "src/classics.ts",
  "src/demo.ts",
  "src/story_interactions.ts",
  "src/ParentAccount.tsx",
  "src/AccountAction.tsx",
  "src/FamilyProfiles.tsx",
  "src/StoryChildPicker.tsx",
  "src/PricingPlans.tsx",
];
const oldLetters = /(?:[OoGg][\u2018\u2019\u02bb\u02bcʻʼ])(?=[A-Za-z])/u;
const oldDigraphs = /(?:sh|ch)/i;
const problems = [];
for (const path of paths) {
  const source = readFileSync(resolve(root, path), "utf8");
  const matches = [...source.matchAll(/\buz\s*:\s*"((?:\\.|[^"\\])*)"/g)];
  for (const match of matches) {
    if (oldLetters.test(match[1])) problems.push(`${path}: legacy o‘/g‘ in Uzbek UI copy: ${match[1]}`);
  }
}
const i18n = readFileSync(resolve(root, "src/i18n.ts"), "utf8");
const uzStart = i18n.indexOf(" uz:{");
const uzEnd = i18n.indexOf(" en:{", uzStart);
if (uzStart < 0 || uzEnd < 0) {
  problems.push("Could not locate Uzbek localization block");
} else {
  const uzBlock = i18n.slice(uzStart, uzEnd);
  const strings = uzBlock.match(/"[^"]*"/g) || [];
  for (const quoted of strings) {
    const value = quoted.slice(1, -1);
    if (oldLetters.test(value) || oldDigraphs.test(value)) {
      problems.push(`Legacy Uzbek spelling in localization: ${value}`);
    }
  }
}
if (!i18n.includes('label:"Özbekça"')) problems.push("Language label must use Özbekça");
if (!i18n.includes('saved==="en"?saved:"uz"')) {
  problems.push("New visitors must default to Uzbek without overriding saved preferences");
}
const main = readFileSync(resolve(root, "src/main.tsx"), "utf8");
if (main.includes('className="welcome-language"')) problems.push("Onboarding must not contain a language selector");
if (!main.includes('uz:"Boşlaş"')) problems.push("Welcome button must use reformed Uzbek");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Uzbek orthography and onboarding regression checks passed.");
}
