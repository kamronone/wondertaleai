import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_paragraphs.ts",import.meta.url),"utf8");
const rendered=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {readerParagraphs}=await import("data:text/javascript;base64,"+Buffer.from(rendered.code).toString("base64"));

test("long uninterrupted text is divided at sentence boundaries without losing one character",()=>{
 const text="The hero crossed the bridge and found a lantern beside a tree. ".repeat(16);
 const paragraphs=readerParagraphs(text);
 assert.ok(paragraphs.length>=3);
 assert.equal(paragraphs.map(p=>p.text).join(""),text);
 assert.equal(paragraphs[0].start,0);
 assert.equal(paragraphs.at(-1).end,text.length);
 for(let i=1;i<paragraphs.length;i++){
  assert.equal(paragraphs[i-1].end,paragraphs[i].start);
  assert.ok(paragraphs[i-1].text.endsWith(" "));
 }
});

test("an author's original newlines and distinct paragraphs are preserved",()=>{
 const text="The first part of the story.\n\nThe second part is a different event.\n\nThe final scene ends at home.";
 const p=readerParagraphs(text);
 assert.equal(p.length,3);
 assert.equal(p.map(x=>x.text).join(""),text);
 assert.ok(p[0].text.endsWith("\n\n"));
 assert.ok(p[1].text.endsWith("\n\n"));
});

test("short illustrated pages and unpunctuated dialogue are not artificially broken",()=>{
 for(const text of ["A short tale.","A long dialogue without sentence punctuation ".repeat(30),"Привет!",""]){
  const p=readerParagraphs(text);
  assert.equal(p.map(x=>x.text).join(""),text);
  assert.ok(p.length<=1);
 }
});

test("Uzbek, Russian and emoji story text retain exact UTF-16 speech offsets",()=>{
 const text="Bola yo‘lga chiqdi. Sehrli bog‘ 🌸 juda chiroyli edi. ".repeat(14);
 const paragraphs=readerParagraphs(text);
 assert.equal(paragraphs.map(x=>x.text).join(""),text);
 const phrase="Sehrli bog‘ 🌸";
 const start=text.lastIndexOf(phrase);
 const selected=paragraphs.find(p=>p.start<=start&&p.end>=start+phrase.length);
 assert.ok(selected);
 assert.equal(selected.text.slice(start-selected.start,start-selected.start+phrase.length),phrase);
});

test("reader preserves the original text for speech and existing position persistence",()=>{
 const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/reader-longform-paragraphs.css",import.meta.url),"utf8");
 assert.match(app,/new SpeechSynthesisUtterance\(active\.pages\[page\]\.text\)/);
 assert.match(app,/readerParagraphs\(text\)\.map\(paragraph=>/);
 assert.match(app,/spokenTextParts\(paragraph\.text,localRange\)/);
 assert.match(app,/className="wt-reader-paragraph"/);
 assert.match(app,/resumeReaderPage\(book\.lastPage,book\.pages\.length\)/);
 assert.match(app,/pendingProgress\.current\.set\(bookId,page\)/);
 assert.match(app,/import "\.\/reader-longform-paragraphs\.css"/);
 assert.match(css,/white-space:pre-wrap/);
 assert.match(css,/max-width:68ch/);
 assert.doesNotMatch(css,/position:fixed/);
});
