import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const step=app.slice(app.indexOf('{createStep===2&&'),app.indexOf('{createStep===3&&'));

test("ready-made fairy tales hide custom world and suggested-ideas controls",()=>{
 const start=step.indexOf('{!activeClassic&&<>');
 const end=step.indexOf('</>}',start);
 assert.ok(start>=0 && end>start,"world and ideas must be guarded by selected classic");
 const block=step.slice(start,end);
 assert.match(block,/className="wizard-step-two-worlds"/);
 assert.match(block,/className="story-preset-label wizard-step-two-section-label"/);
 assert.match(block,/className="story-preset-actions"/);
 assert.doesNotMatch(step.slice(end),/className="wizard-step-two-worlds"/);
});

test("selecting custom plot restores custom fields; classic selection keeps its prompt",()=>{
 assert.match(step,/onClick=\{\(\)=>\{setPrompt\(previous=>leaveClassicStoryPrompt\(previous,storyLang,activeClassic\?\.prompt\)\);setClassicId\(null\);\}\}/);
 assert.match(step,/setClassicId\(item.id\);setThemeIndex\(item.themeIndex\);setPrompt\(item.prompt\[storyLang\]\)/);
 assert.match(step,/className="wizard-step-two-prompt"/);
 assert.match(step,/onChange=\{e=>\{const next=e.target.value;if\(shouldDetachClassicOnEdit/);
 assert.match(step,/setCreateStep\(3\)/);
});
