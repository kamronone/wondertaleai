/** Build eight standalone PNG assets from bundled offline story scenes.
 * Run after npm ci. No AI calls, private files, network requests, or tokens.
 * The Python script below converts the generated SVGs with CairoSVG.
 */
import {build} from "esbuild";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(root,".generated-red-hood-svg");
await mkdir(out,{recursive:true});
const built=await build({
  entryPoints:[path.join(root,"src/red_hood_page_art.ts")],
  bundle:true,platform:"node",format:"esm",target:"es2022",write:false,logLevel:"error"
});
const js=built.outputFiles[0].text;
const {redHoodPageArtwork}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
for(let i=0;i<8;i++){
  const url=redHoodPageArtwork(i);
  const prefix="data:image/svg+xml;charset=utf-8,";
  if(!url.startsWith(prefix))throw new Error("Invalid scene asset "+i);
  await writeFile(path.join(out,`page-${i+1}.svg`),decodeURIComponent(url.slice(prefix.length)),"utf8");
}
console.log("Prepared eight scene drawings for PNG conversion.");
