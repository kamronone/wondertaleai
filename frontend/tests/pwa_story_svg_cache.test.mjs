import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sw=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
const props=["/images/story-brick.svg","/images/interactions/wooden-latch.svg","/images/interactions/story-clock.svg","/images/interactions/forest-map.svg"];

test("PWA caches four public SVG scene props on demand",()=>{
 assert.match(sw,/const CACHE = "wondertale-public-v16"/);
 for(const path of props){
   assert.ok(sw.includes(path.split("/").pop().replace(".svg","")),path);
   assert.match(readFileSync(new URL("../public"+path,import.meta.url),"utf8"),/<svg/);
 }
 assert.match(sw,/images\\\/interactions\\\/\(\?:wooden-latch\|story-clock\|forest-map\)/);
});
test("service worker keeps private content out of caches",()=>{
 assert.match(sw,/if \(request\.method !== "GET" \|\| request\.headers\.has\("Authorization"\)\) return/);
 assert.match(sw,/PRIVATE_PATH\.test\(url\.pathname\)/);
 assert.doesNotMatch(sw,/OPTIONAL_ART\s*=\s*\[[^\]]*api\/|OPTIONAL_ART\s*=\s*\[[^\]]*account\//s);
 assert.match(sw,/cache\.addAll\(CORE\)/);
});
