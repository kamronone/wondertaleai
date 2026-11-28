// Publish the verified Snow White PNG bundle as one GitHub commit.
// Run only with an explicit short-lived GitHub token restricted to this repository.
// Usage (from frontend/): GITHUB_TOKEN=... node scripts/publish-snow-white-pngs.mjs
// Never writes to main, production or a different repository.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const owner="kamronone",repo="wondertaleai",branch="fix/private-book-access";
const token=process.env.GITHUB_TOKEN;
if(!token)throw new Error("GITHUB_TOKEN is required; do not commit a token");
if(process.env.GITHUB_REPOSITORY&&process.env.GITHUB_REPOSITORY!==owner+"/"+repo)throw new Error("Unexpected repository");
if(process.env.GITHUB_REF_NAME&&process.env.GITHUB_REF_NAME!==branch)throw new Error("Unexpected branch");
const manifest=JSON.parse(readFileSync(resolve(root,"artwork/snow-white-png-integrity.json"),"utf8"));
if(manifest.classicId!=="snow-white"||manifest.pages?.length!==8)throw new Error("Invalid artwork manifest");
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
const files=[];
const hashes=new Set();
for(let page=1;page<=8;page++){
 const bytes=readFileSync(resolve(root,"public/images/classics/snow-white/pages",`page-${page}.png`));
 if(bytes.length<4096||!bytes.subarray(0,8).equals(sig)||bytes.toString("ascii",12,16)!=="IHDR")throw new Error("Invalid PNG on page "+page);
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 const hash=createHash("sha256").update(bytes).digest("hex");
 if(width!==manifest.width||height!==manifest.height||hash!==manifest.pages[page-1]?.sha256||hashes.has(hash))throw new Error("Unreviewed or duplicate artwork on page "+page);
 hashes.add(hash);
 files.push({path:`frontend/public/images/classics/snow-white/pages/page-${page}.png`,bytes});
}
const request=async(method,path,body)=>{
 const response=await fetch("https://api.github.com/repos/"+owner+"/"+repo+path,{
  method,headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!response.ok)throw new Error("GitHub "+method+" "+path+": HTTP "+response.status+" "+(await response.text()).slice(0,400));
 return response.json();
};
const ref=await request("GET","/git/ref/heads/"+branch);
const head=ref.object.sha;
const commit=await request("GET","/git/commits/"+head);
const entries=[];
for(const {path,bytes} of files){
 const blob=await request("POST","/git/blobs",{content:bytes.toString("base64"),encoding:"base64"});
 entries.push({path,mode:"100644",type:"blob",sha:blob.sha});
}
const tree=await request("POST","/git/trees",{base_tree:commit.tree.sha,tree:entries});
const next=await request("POST","/git/commits",{message:"art: install eight verified Snow White story PNG scenes",tree:tree.sha,parents:[head]});
// A non-forced ref update fails rather than overwriting another writer's work.
await request("PATCH","/git/refs/heads/"+branch,{sha:next.sha,force:false});
console.log("Published 8 verified PNGs to "+owner+"/"+repo+" "+branch+" at "+next.sha);
