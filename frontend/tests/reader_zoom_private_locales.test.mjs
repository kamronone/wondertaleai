import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=read("../src/main.tsx");
const privateView=read("../src/PrivateReaderIllustration.tsx");
const css=read("../src/reader-image-fullwidth.css");

test("reader PNG and GIF remain inline without any tap-to-zoom button or overlay",()=>{
 assert.match(app,/function StoryIllustration\(/);
 assert.match(app,/return <img src=\{src\}/);
 assert.match(app,/wt-character-gif/);
 assert.doesNotMatch(app,/createPortal|zoomOpen|setZoomScale|wt-reader-image-open|reader-image-lightbox\.css/);
 assert.doesNotMatch(privateView,/createPortal|zoomOpen|wt-reader-image-open|zoomScale/);
});

test("inline illustrations stay inside a consistent mobile frame",()=>{
 assert.match(css,/height:clamp\(230px,38svh,345px\)!important/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(css,/max-height:100%!important/);
 assert.match(app,/wt-reader-picture/);
});

test("protected photos keep their private blob lifecycle",()=>{
 assert.match(privateView,/image\?\.key===key/);
 assert.match(privateView,/URL\.revokeObjectURL\(currentUrl\)/);
 assert.match(privateView,/controller\.abort\(\)/);
 assert.match(privateView,/src=\{image\.blobUrl\}/);
 assert.doesNotMatch(privateView,/src=\{api/);
});
