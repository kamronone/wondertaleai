import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const install=readFileSync(new URL("../scripts/install-rapunzel-pngs.mjs",import.meta.url),"utf8");
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
test("single-command installer only writes the eight expected Rapunzel PNGs",()=>{
 assert.equal(pkg.scripts["install:rapunzel:art"],"node scripts/install-rapunzel-pngs.mjs");
 assert.match(install,/Array\.from\(\{length:8\}/);
 assert.match(install,/images\/classics\/rapunzel\/pages\/page-/);
 assert.match(install,/if\(entries\.some\(file=>!allowed\.has\(file\)\)\)/);
 assert.match(install,/bytes\.readUInt32BE\(16\)/);
 assert.match(install,/digests\.has\(digest\)/);
 assert.match(install,/rmSync\(staging,\{recursive:true,force:true\}\)/);
 assert.doesNotMatch(install,/fetch\(|https?:\/\/|process\.env\.GITHUB_TOKEN|eval\(/);
});
test("installer rejects an absent archive without changing images",()=>{
 const result=spawnSync(process.execPath,[new URL("../scripts/install-rapunzel-pngs.mjs",import.meta.url).pathname,"/tmp/wondertale-not-present-rapunzel-images.zip"],{encoding:"utf8"});
 assert.equal(result.status,1);
 assert.match(result.stderr,/Usage: npm run install:rapunzel:art/);
});

test("installer pins every page to its reviewed PNG checksum and dimensions",()=>{
 const manifest=JSON.parse(readFileSync(new URL("../artwork/rapunzel-png-integrity.json",import.meta.url),"utf8"));
 assert.equal(manifest.classicId,"rapunzel");
 assert.equal(manifest.width,960);
 assert.equal(manifest.height,720);
 assert.deepEqual(manifest.pages.map(item=>item.page),[1,2,3,4,5,6,7,8]);
 assert.equal(new Set(manifest.pages.map(item=>item.sha256)).size,8);
 for(const item of manifest.pages)assert.match(item.sha256,/^[a-f0-9]{64}$/);
 assert.match(install,/integrity.pages.find\(entry=>entry.page===page\)\?\.sha256/);
 assert.match(install,/Unexpected or swapped Rapunzel illustration/);
});
