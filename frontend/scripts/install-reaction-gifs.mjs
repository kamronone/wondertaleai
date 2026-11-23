/* Materialize reviewed, bundled GIF animations from versioned Base64 text.
 * No remote downloads, shell commands or child/private content.
 * Runs before dev, tests and build so Netlify and GitHub CI see identical assets.
 */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const assets=["snow-white-wave","duckling-flutter","bremen-music"];
const W=80,H=80;
function checkedGif(data,name){
 if(data.length<1000||data.length>200000||data.toString("ascii",0,6)!=="GIF89a"||
    data.readUInt16LE(6)!==W||data.readUInt16LE(8)!==H||
    data[data.length-1]!==0x3b)throw Error("Invalid GIF header or dimensions: "+name);
 let at=13,frames=0;
 const packed=data[10];
 if(packed&128)at+=3*(1<<((packed&7)+1));
 const block=()=>{
  while(true){
   if(at>=data.length)throw Error("Truncated GIF "+name);
   const size=data[at++];
   if(!size)break;
   at+=size;
   if(at>data.length)throw Error("Truncated GIF data "+name);
  }
 };
 while(at<data.length){
  const marker=data[at++];
  if(marker===0x3b)break;
  if(marker===0x21){
   const extension=data[at++];
   if(extension===0xf9){
    if(data[at++]!==4)throw Error("Bad frame control "+name);
    at+=4;
    if(data[at++]!==0)throw Error("Bad frame control terminator "+name);
   }else{
    const len=data[at++];at+=len;
    block();
   }
  }else if(marker===0x2c){
   at+=8;
   const flags=data[at++];
   if(flags&128)at+=3*(1<<((flags&7)+1));
   if(data[at++]!==2)throw Error("Unexpected GIF color depth "+name);
   block();frames++;
  }else throw Error("Invalid GIF block "+name);
  if(at>data.length)throw Error("Truncated GIF "+name);
 }
 if(frames!==8||at!==data.length)throw Error("Unexpected GIF frame count "+name+" "+frames);
}
for(const asset of assets){
 const source=resolve(root,"artwork","reaction-gifs",asset+".gif.b64");
 const encoded=readFileSync(source,"utf8").trim();
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error("Invalid Base64 asset "+asset);
 const bytes=Buffer.from(encoded,"base64");
 checkedGif(bytes,asset);
 const dest=resolve(root,"public","images","interactions","reactions",asset+".gif");
 mkdirSync(dirname(dest),{recursive:true});
 writeFileSync(dest,bytes);
 console.log("Verified original GIF:",asset,bytes.length+" bytes / 8 frames");
}

// Also materialize the five hero portraits before dev, test and Vite build.
await import("./install-hero-pngs.mjs");
