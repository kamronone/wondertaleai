import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const reader=read("../src/classic_page_art.ts");
const verify=read("../scripts/check-classic-page-assets.mjs");
test("Rapunzel PNGs are enabled only with explicit release flag",()=>{
 assert.match(reader,/typeof __RAPUNZEL_PNG_READY__!=="undefined"/);
 assert.match(read("../vite.config.ts"),/rapunzelPngComplete&&process.env.VITE_RAPUNZEL_PNG_READY!=="false"/);
 assert.match(read("../vite.config.ts"),/\.every\(path=>existsSync\(path\)\)/);
 assert.match(reader,/\.\.\.\(rapunzelPngReady\?\["rapunzel"\]:\[\]\)/);
 assert.match(reader,/if\(!bundledPngIds\.has\(classicId\)\)return classicPageArtwork/);
 assert.match(reader,/return generatedPage/);
});
test("saved Rapunzel demo SVG is upgraded but user artwork is protected",()=>{
 assert.match(reader,/oldBundledRapunzel=classicId==="rapunzel"&&imageUrl===rapunzelPageArtwork\(pageIndex\)/);
 assert.match(reader,/!oldBundledRapunzel&&imageUrl\.trim\(\)!==""\)return imageUrl/);
 assert.match(reader,/const oldDemoVector=/);
});
test("strict release validation requires eight real PNG files when flag enabled",()=>{
 assert.match(verify,/rapunzelPresent\|\|process\.env\.VITE_RAPUNZEL_PNG_READY==="true"/);
 assert.match(verify,/\.some\(path=>existsSync\(path\)\)/);
 assert.match(verify,/stories\.length\*8/);
 assert.match(verify,/if\(invalid\.length\|\|duplicated\.length\|\|\(strict&&missing\.length\)\)/);
});
