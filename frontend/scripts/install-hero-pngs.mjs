/* Install the five original WonderTale character PNGs from checked versioned
   Base64. This preserves the real PNG format on every local/CI/Netlify build
   without relying on external image servers or Git LFS. */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const names=["boy","girl","fox","robot","dragon"];
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
for(const name of names){
 const src=resolve(root,"artwork","hero-pngs","create-"+name+".png.b64");
 const encoded=readFileSync(src,"utf8").replace(/\s+/g,"");
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error("Invalid hero PNG base64: "+name);
 const bytes=Buffer.from(encoded,"base64");
 if(bytes.length<5000||bytes.length>300000||!bytes.subarray(0,8).equals(signature)||
    bytes.subarray(12,16).toString("ascii")!=="IHDR"||
    bytes.readUInt32BE(16)!==320||bytes.readUInt32BE(20)!==320||
    bytes.subarray(-8,-4).toString("ascii")!=="IEND")throw Error("Invalid hero PNG: "+name);
 const target=resolve(root,"public","images","create-"+name+".png");
 mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,bytes);
 console.log("Verified hero PNG:",name,bytes.length+" bytes / 320x320");
}
