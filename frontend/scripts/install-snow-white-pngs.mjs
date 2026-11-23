// Install reviewed Snow White PNGs without unpacking untrusted ZIP entries.
// npm run install:snow-white:art -- /path/to/wondertale_snow_white_8_png.zip
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync,renameSync,mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const archive=process.argv[2]?resolve(process.argv[2]):"";
if(!archive||!existsSync(archive)){
 console.error("Usage: npm run install:snow-white:art -- /path/to/wondertale_snow_white_8_png.zip");
 process.exit(1);
}
const manifest=JSON.parse(readFileSync(resolve(root,"artwork/snow-white-png-integrity.json"),"utf8"));
if(manifest.classicId!=="snow-white"||manifest.pages?.length!==8)throw Error("Invalid Snow White manifest");
const prefix="images/classics/snow-white/pages/";
const entries=Array.from({length:8},(_,i)=>prefix+"page-"+(i+1)+".png");
const expected=new Set([...entries,"manifest.json"]);
const listed=execFileSync("unzip",["-Z","-1",archive],{encoding:"utf8",maxBuffer:1024*1024}).trim().split(/\r?\n/);
if(listed.length!==expected.size||listed.some(item=>!expected.has(item))||entries.some(item=>!listed.includes(item)))throw Error("ZIP entries differ from the reviewed Snow White pack");
const staging=mkdtempSync(join(tmpdir(),"wondertale-snow-white-"));
try{
 const distinct=new Set();
 for(let page=1;page<=8;page++){
  const archivePath=entries[page-1];
  const bytes=execFileSync("unzip",["-p",archive,archivePath],{maxBuffer:12*1024*1024});
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  if(bytes.length<4096||!bytes.subarray(0,8).equals(signature)||bytes.toString("ascii",12,16)!=="IHDR")throw Error("Invalid PNG: "+archivePath);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  const hash=createHash("sha256").update(bytes).digest("hex");
  if(width!==manifest.width||height!==manifest.height||hash!==manifest.pages[page-1].sha256||distinct.has(hash))throw Error("PNG fails integrity review: "+archivePath);
  distinct.add(hash);
  writeFileSync(join(staging,"page-"+page+".png"),bytes);
 }
 const target=resolve(root,"public/images/classics/snow-white/pages");
 mkdirSync(target,{recursive:true});
 for(let page=1;page<=8;page++)renameSync(join(staging,"page-"+page+".png"),join(target,"page-"+page+".png"));
 console.log("Installed eight verified, distinct Snow White PNG illustrations.");
}catch(error){
 console.error(error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{rmSync(staging,{force:true,recursive:true});}
