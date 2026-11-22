import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import { defineConfig } from 'vite';

// Publish only non-sensitive build metadata. Never expose API secrets or tokens.
const ref=(process.env.COMMIT_REF || process.env.GITHUB_SHA || "").trim();
const sha=/^[0-9a-f]{7,40}$/i.test(ref)?ref.slice(0,10):"local";
const source=(process.env.BRANCH || "").trim();
const artworkRoot=dirname(fileURLToPath(import.meta.url));
const rapunzelPngComplete=Array.from({length:8},(_,i)=>
  resolve(artworkRoot,"public","images","classics","rapunzel","pages",`page-${i+1}.png`)
).every(path=>existsSync(path));
const branch=/^[A-Za-z0-9._/-]{1,100}$/.test(source)?source:"local";

export default defineConfig({
  server:{port:5173,host:true},
  define:{
    __WONDERTALE_BUILD_SHA__:JSON.stringify(sha),
    __WONDERTALE_BUILD_BRANCH__:JSON.stringify(branch),
    __RAPUNZEL_PNG_READY__:JSON.stringify(rapunzelPngComplete&&process.env.VITE_RAPUNZEL_PNG_READY!=="false")
  }
});
