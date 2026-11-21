import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
const source=read("../src/private_illustration.ts");
const view=read("../src/PrivateReaderIllustration.tsx");
const app=read("../src/main.tsx");

test("private pages never place bearer tokens into image URLs",()=>{
  assert.match(source,/Authorization:"Bearer "\+token/);
  assert.match(source,/cache:"no-store"/);
  assert.match(source,/URL\.createObjectURL\(file\)/);
  assert.doesNotMatch(source,/src=\{api/);
});
test("current page lookup is owner scoped, validates returned job id and PNG",()=>{
  assert.match(source,/\/api\/illustrations\/books\/"/);
  assert.match(source,/\/api\/illustrations\/media\/"/);
  assert.match(source,/UUID\.test\(raw\.job_id\)/);
  assert.match(source,/image\/png/);
  assert.match(source,/file\.size>3_000_000/);
});
test("reader cancels old page requests and releases object URLs",()=>{
  assert.match(view,/controller\.abort\(\)/);
  assert.match(view,/URL\.revokeObjectURL\(currentUrl\)/);
  assert.match(view,/\[api,session,bookId,pageNumber,key\]/);
  assert.match(view,/image\?\.key===key/);
});
test("only signed-in private active pages load protected images",()=>{
  assert.match(app,/active\.mode==="private-account"&&privateToken&&API/);
  assert.match(app,/<PrivateReaderIllustration api=\{API\} session=\{privateToken\}/);
  assert.match(app,/fallback=\{<StoryIllustration/);
});
