import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-image-lightbox.css",import.meta.url),"utf8");

test("zoom styles load after all book, GIF and mobile layout styles",()=>{
  const frame=app.indexOf('import "./reader-image-fullwidth.css";');
  const gif=app.indexOf('import "./reader-living-art.css";');
  const lightbox=app.indexOf('import "./reader-image-lightbox.css";');
  assert.ok(frame>=0 && gif>frame && lightbox>gif);
});

test("reader PNG or animated GIF opens the real source in a full-screen portal",()=>{
  assert.match(app,/import \{ createPortal \} from "react-dom"/);
  assert.match(app,/className="wt-reader-image-open"/);
  assert.match(app,/setZoomOpen\(true\)/);
  assert.match(app,/zoomOpen&&createPortal\(/);
  assert.match(app,/className="wt-reader-image-lightbox-img"/);
  assert.match(app,/<img src=\{src\} alt=\{alt\} className="wt-reader-image-lightbox-img"/);
  assert.match(app,/document\.body/);
});

test("modal allows keyboard and touch interactions without changing reading page",()=>{
  assert.match(app,/role="dialog" aria-modal="true"/);
  assert.match(app,/event\.key==="Escape"/);
  assert.match(app,/event\.key==="Tab"/);
  assert.match(app,/onTouchStart=\{event=>event\.stopPropagation\(\)\}/);
  assert.match(app,/document\.body\.style\.overflow="hidden"/);
  assert.match(app,/document\.body\.style\.overflow=previousOverflow/);
  assert.match(app,/closeButtonRef\.current\?\.focus\(\)/);
  assert.match(app,/openButtonRef\.current\?\.focus\(\)/);
});

test("safe area and accessible zoom controls do not alter in-page picture dimensions",()=>{
  assert.match(css,/z-index:2147483646/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/touch-action:pan-x pan-y pinch-zoom/);
  assert.match(app,/Math\.min\(3/);
  assert.match(app,/Math\.max\(1/);
  assert.match(css,/object-fit:contain/);
  assert.match(css,/@media print/);
});
