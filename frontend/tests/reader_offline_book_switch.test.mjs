import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("offline art status follows the currently displayed book",()=>{
  assert.match(main,/const offlineArtBookRef=useRef\(active\?\.id\)/);
  assert.match(main,/offlineArtBookRef\.current=active\?\.id/);
  assert.match(main,/const bookId=active\?\.id/);
  assert.match(main,/if\(offlineArtBookRef\.current===bookId\)setOfflineArtReady\(ready\)/);
  assert.match(main,/if\(offlineArtBookRef\.current===bookId\)setOfflineArtError\(true\)/);
});
test("downloading a book still clears its loading state",()=>{
  assert.match(main,/finally\{setOfflineArtBusy\(false\);\}/);
});
