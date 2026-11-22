import { defineConfig } from 'vite';

// Publish only non-sensitive build metadata. Never expose API secrets or tokens.
const ref=(process.env.COMMIT_REF || process.env.GITHUB_SHA || "").trim();
const sha=/^[0-9a-f]{7,40}$/i.test(ref)?ref.slice(0,10):"local";
const source=(process.env.BRANCH || "").trim();
const branch=/^[A-Za-z0-9._/-]{1,100}$/.test(source)?source:"local";

export default defineConfig({
  server:{port:5173,host:true},
  define:{
    __WONDERTALE_BUILD_SHA__:JSON.stringify(sha),
    __WONDERTALE_BUILD_BRANCH__:JSON.stringify(branch),
    __RAPUNZEL_PNG_READY__:JSON.stringify(process.env.VITE_RAPUNZEL_PNG_READY==="true")
  }
});
