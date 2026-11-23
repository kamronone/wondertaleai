// Validate shipped classic story PNG assets before release.
// npm run check:images          -> report what is bundled
// npm run check:images:release  -> fail when any expected page is missing
import {existsSync,readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const strict=process.argv.includes("--strict");
const rapunzelPresent=Array.from({length:8},(_,i)=>resolve(root,`public/images/classics/rapunzel/pages/page-${i+1}.png`)).some(path=>existsSync(path));
const snowWhitePresent=Array.from({length:8},(_,i)=>resolve(root,`public/images/classics/snow-white/pages/page-${i+1}.png`)).some(path=>existsSync(path));
const stories=["red-hood","cinderella","three-pigs",...(rapunzelPresent||process.env.VITE_RAPUNZEL_PNG_READY==="true"?["rapunzel"]:[]),...(snowWhitePresent?["snow-white"]:[])];
const missing=[];
const invalid=[];
const duplicated=[];
const valid=[];
const hashes=new Map();
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const rapunzelManifest=JSON.parse(readFileSync(resolve(root,"artwork/rapunzel-png-integrity.json"),"utf8"));
const snowWhiteManifest=JSON.parse(readFileSync(resolve(root,"artwork/snow-white-png-integrity.json"),"utf8"));
if(snowWhiteManifest.classicId!=="snow-white"||snowWhiteManifest.pages?.length!==8)throw new Error("Invalid Snow White art manifest");
if(rapunzelManifest.classicId!=="rapunzel"||rapunzelManifest.pages?.length!==8)throw new Error("Invalid Rapunzel art manifest");

for(const story of stories) {
 for(let page=1;page<=8;page++){
  const rel=`public/images/classics/${story}/pages/page-${page}.png`;
  const full=resolve(root,rel);
  if(!existsSync(full)){missing.push(rel);continue;}
  const bytes=readFileSync(full);
  if(bytes.length<4096 || !bytes.subarray(0,8).equals(signature) ||
      bytes.toString("ascii",12,16)!=="IHDR") {
    invalid.push(rel+": not a valid story PNG");continue;
  }
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<480||height<360||width>6000||height>6000){
    invalid.push(rel+": unsupported dimensions "+width+"x"+height);continue;
  }
  const hash=createHash("sha256").update(bytes).digest("hex");
  if(story==="rapunzel"){
   const expected=rapunzelManifest.pages.find(entry=>entry.page===page);
   if(!expected||hash!==expected.sha256||width!==rapunzelManifest.width||height!==rapunzelManifest.height){
    invalid.push(rel+": does not match reviewed Rapunzel artwork");continue;
   }
  }
  if(story==="snow-white"){
   const expected=snowWhiteManifest.pages.find(entry=>entry.page===page);
   if(!expected||hash!==expected.sha256||width!==snowWhiteManifest.width||height!==snowWhiteManifest.height){
    invalid.push(rel+": does not match reviewed Snow White artwork");continue;
   }
  }
  const previous=hashes.get(hash);
  if(previous)duplicated.push(rel+" duplicates "+previous);
  hashes.set(hash,rel);
  valid.push(rel);
 }
}
console.log(`Classic page artwork: ${valid.length}/${stories.length*8} PNGs present.`);
if(missing.length)console.log("Missing PNGs (reader uses bundled SVG fallback):\n"+missing.join("\n"));
if(invalid.length)console.error("Invalid PNGs:\n"+invalid.join("\n"));
if(duplicated.length)console.error("Duplicate page artwork:\n"+duplicated.join("\n"));
if(invalid.length||duplicated.length||(strict&&missing.length)){
 console.error("Classic artwork release verification failed.");
 process.exitCode=1;
}
