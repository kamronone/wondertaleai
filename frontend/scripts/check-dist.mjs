// Verify the exact built frontend files that can be published by Netlify.
import {existsSync,readdirSync,readFileSync,statSync} from "node:fs";
import {resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=resolve(root,"dist");
const failures=[];
const need=(relative)=> {
 const path=resolve(dist,relative);
 if(!path.startsWith(dist+"/")||!existsSync(path)||!statSync(path).isFile()||statSync(path).size===0) {
  failures.push("Missing or empty: "+relative);
  return null;
 }
 return path;
};
const index=need("index.html");
if(index){
 const html=readFileSync(index,"utf8");
 if(!html.includes('<div id="root"')&&!html.includes('id="root"')) failures.push("Built entry has no React root");
 if(!html.includes("/assets/"))failures.push("Built entry does not reference bundled assets");
}
const assets=resolve(dist,"assets");
const bundles=existsSync(assets)?readdirSync(assets):[];
if(!bundles.some(name=>name.endsWith(".js")))failures.push("No compiled JavaScript");
if(!bundles.some(name=>name.endsWith(".css")))failures.push("No compiled CSS");
const gifs=["snow-white-wave","duckling-flutter","bremen-music"];
for(const name of gifs){
 const path=need("images/interactions/reactions/"+name+".gif");
 if(path&&readFileSync(path).toString("ascii",0,6)!=="GIF89a")failures.push("Invalid GIF: "+name);
}
for(let page=1;page<=8;page++){
 const path=need("images/classics/rapunzel/pages/page-"+page+".png");
 if(path&&!readFileSync(path).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  failures.push("Invalid page PNG: "+page);
}
const output={
 source:"frontend/dist",
 javascript:bundles.filter(name=>name.endsWith(".js")).length,
 css:bundles.filter(name=>name.endsWith(".css")).length,
 reactionGifs:gifs.length,
 rapunzelPngPages:8,
 errors:failures,
};
console.log(JSON.stringify(output,null,2));
if(failures.length)process.exitCode=1;
