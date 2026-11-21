import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const main=read("../src/main.tsx");
const privateView=read("../src/PrivateReaderIllustration.tsx");
const css=read("../src/reader-image-lightbox.css");
const labels=read("../src/reader_zoom_labels.ts");

test("reader PNG and GIF open in a portal without navigation",()=>{
 assert.match(main,/zoomOpen&&createPortal\(/);
 assert.match(main,/className="wt-reader-image-open"/);
 assert.match(main,/className="wt-reader-image-lightbox-img"/);
 assert.match(main,/src=\{src\} alt=\{alt\} className="wt-reader-image-lightbox-img"/);
 assert.match(main,/onClick=\{\(\)=>\{setZoomScale\(1\);setZoomOpen\(true\);\}\}/);
 assert.match(main,/event\.key==="Escape"/);
 assert.match(main,/event\.key==="Tab"/);
 assert.match(main,/onTouchEnd=\{event=>event\.stopPropagation\(\)\}/);
});

test("private photos reuse short lived authorized blob URLs and revoke them on exit",()=>{
 assert.match(privateView,/image\?\.key===key/);
 assert.match(privateView,/URL\.revokeObjectURL\(currentUrl\)/);
 assert.match(privateView,/createPortal\(/);
 assert.match(privateView,/src=\{image\.blobUrl\}/);
 assert.doesNotMatch(privateView,/src=\{api/);
 assert.match(privateView,/setZoomOpen\(false\)/);
});

test("zoom controls are translated and support iPhone safe areas",()=>{
 for(const name of ["Увеличить изображение","Rasmni kattalashtirish","Enlarge picture"])
  assert.ok(labels.includes(name),name);
 for(const src of [main,privateView]){
  assert.match(src,/readerZoomLabels\(document\.documentElement\.lang\)/);
  assert.match(src,/aria-label=\{zoomCopy\.close\}/);
 }
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/touch-action:pan-x pan-y pinch-zoom/);
 assert.match(css,/z-index:2147483646/);
});
