// Safely install the eight generated Rapunzel images from the review ZIP.
// Usage: npm run install:rapunzel:art -- /path/to/ertakcha_rapunzel_8_png.zip
// Requires the standard "unzip" command; does not download or execute ZIP content.
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync,renameSync,mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const archive=process.argv[2] ? resolve(process.argv[2]) : "";
if(!archive||!existsSync(archive)){
 console.error("Usage: npm run install:rapunzel:art -- /path/to/ertakcha_rapunzel_8_png.zip");
 process.exit(1);
}
const files=Array.from({length:8},(_,i)=>`images/classics/rapunzel/pages/page-${i+1}.png`);
const expected=new Set(files);
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const integrity=JSON.parse(readFileSync(resolve(root,"artwork/rapunzel-png-integrity.json"),"utf8"));
if(integrity.classicId!=="rapunzel"||integrity.pages?.length!==8)throw new Error("Invalid Rapunzel artwork manifest");
const staging=mkdtempSync(join(tmpdir(),"wondertale-rapunzel-"));
try{
 const entries=execFileSync("unzip",["-Z","-1",archive],{encoding:"utf8",maxBuffer:1024*1024}).trim().split(/\r?\n/);
 for(const file of files)if(!entries.includes(file))throw new Error("Missing image "+file);
 // Refuse links or strange non-image entries; never unpack the archive as a directory.
 const allowed=new Set([...expected,"README.txt","manifest.json","preview.html"]);
 if(entries.some(file=>!allowed.has(file)))throw new Error("Archive contains unknown files");
 const digests=new Set();
 const prepared=[];
 for(const file of files){
  const bytes=execFileSync("unzip",["-p",archive,file],{maxBuffer:8*1024*1024});
  if(bytes.length<4096||!bytes.subarray(0,8).equals(signature)||bytes.toString("ascii",12,16)!=="IHDR")throw new Error("Invalid PNG "+file);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<480||height<360||width>6000||height>6000)throw new Error("Invalid dimensions "+file);
  const digest=createHash("sha256").update(bytes).digest("hex");
  const page=Number(/page-(\d+)\.png$/.exec(file)?.[1]);
  if(digest!==integrity.pages.find(entry=>entry.page===page)?.sha256||width!==integrity.width||height!==integrity.height)throw new Error("Unexpected or swapped Rapunzel illustration "+file);
  if(digests.has(digest))throw new Error("Duplicate illustration "+file);
  digests.add(digest);
  const temporary=join(staging,file.split("/").at(-1));
  writeFileSync(temporary,bytes);
  prepared.push({temporary,filename:file.split("/").at(-1)});
 }
 const destination=resolve(root,"public/images/classics/rapunzel/pages");
 mkdirSync(destination,{recursive:true});
 for(const item of prepared)renameSync(item.temporary,join(destination,item.filename));
 console.log("Installed 8 distinct Rapunzel PNGs into "+destination);
 console.log("Next: npm run check:images:release (Preview automatically enables all 8 PNGs)");
}catch(error){
 console.error("Rapunzel artwork installation failed:",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{
 rmSync(staging,{recursive:true,force:true});
}
