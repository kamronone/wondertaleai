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
