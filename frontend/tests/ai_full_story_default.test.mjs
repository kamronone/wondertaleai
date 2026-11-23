import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("full-length AI stories default to twenty pages, without preventing shorter formats",()=>{
 assert.match(source,/const \[aiPagesCount,setAiPagesCount\]=useState<8\|12\|20>\(20\)/);
 for(const pages of [8,12,20])assert.ok(source.includes('<option value={'+pages+'}>'));
 assert.match(source,/ru:"страниц · полная сказка"/);
 assert.match(source,/uz:"sahifa · töliq ertak"/);
 assert.match(source,/en:"pages · full tale"/);
 assert.match(source,/pages_count:aiPagesCount/);
 assert.match(source,/generated\.pages\.length!==data\.pages_count/);
});
test("twenty-page option does not auto-submit a generated tale",()=>{
 assert.match(source,/const \[usePersonalAi,setUsePersonalAi\]=useState\(false\)/);
 assert.match(source,/if\(usePersonalAi\)\{/);
 assert.match(source,/onChange=\{e=>setAiPagesCount\(Number\(e\.target\.value\) as 8\|12\|20\)\}/);
 assert.doesNotMatch(source,/useEffect\(\(\)=>\{\s*generateStory\(\)/);
});
