import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const studio=readFileSync(new URL("../src/CartoonStudio.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/cartoon-studio.css",import.meta.url),"utf8");
test("storyboard pause preserves elapsed time and resumes local speech",()=>{
 assert.ok(studio.includes("clock.elapsed+=Math.max(0,performance.now()-clock.started)"));
 assert.ok(studio.includes("clock.paused=true"));
 assert.ok(studio.includes("window.speechSynthesis.pause()"));
 assert.ok(studio.includes("window.speechSynthesis.resume()"));
 assert.ok(studio.includes("if(run.current!==token||clock.paused)return"));
 assert.ok(studio.includes("onClick={togglePlayback}"));
});
test("export invalidates stale video when settings or story change",()=>{
 assert.ok(studio.includes("[scenes,duration,captions,music,motion,narration,narrationMode,sceneClips,edits]"));
 assert.ok(studio.includes("URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;"));
 assert.ok(studio.includes("setResult(null);setError(false);setProgress(0)"));
 assert.ok(studio.includes("checked={captions} disabled={busy||recording}"));
 assert.ok(studio.includes("JSON.stringify(scenes.map(scene=>[scene.number,scene.text,scene.image]))"));
});
test("narrow player layout preserves 44px controls",()=>{
 assert.ok(css.includes("grid-template-columns:44px minmax(0,1fr) 44px 44px 44px"));
 assert.ok(css.includes("grid-template-columns:repeat(4,minmax(0,1fr))"));
 assert.ok(css.includes("grid-row:1;grid-column:1/-1"));
 assert.ok(css.includes("width:44px;min-width:44px;height:44px"));
});
