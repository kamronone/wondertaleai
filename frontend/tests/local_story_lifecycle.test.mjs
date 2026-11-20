import assert from "node:assert/strict";
import {test} from "node:test";
import {build} from "esbuild";

const bundled=await build({
 entryPoints:[new URL("../src/demo.ts",import.meta.url).pathname],
 bundle:true,platform:"node",format:"esm",write:false,target:"es2022"
});
const {
 createDemoBook,getDemoBooks,saveDemoBooks,getLocalLibraryHealth
}=await import("data:text/javascript;base64,"+
 Buffer.from(bundled.outputFiles[0].contents).toString("base64"));

function storage(){
 const items=new Map();
 return {
  getItem:key=>items.get(key)??null,
  setItem:(key,value)=>{items.set(key,String(value));},
  removeItem:key=>{items.delete(key);}
 };
}
function withBrowserStores(fn){
 const originalLocal=globalThis.localStorage;
 const originalSession=globalThis.sessionStorage;
 const device=storage(),session=storage();
 globalThis.localStorage=device;globalThis.sessionStorage=session;
 try{return fn({device,session});}
 finally{globalThis.localStorage=originalLocal;globalThis.sessionStorage=originalSession;}
}
function create(saved){
 return createDemoBook("Amir",7,"forest","gentle",
  "A secret garden full of friendly animals","en",undefined,saved);
}

test("Create, persist, read and reopen a saved story after Safari/PWA session restart",()=>withBrowserStores(({session,device})=>{
 const original=create(true);
 assert.ok(original.id.startsWith("local-"));
 assert.ok(original.pages.length>1);
 assert.ok(original.pages.every((page,i)=>page.number===i+1&&page.text.length>0));
 assert.equal(getLocalLibraryHealth(),"ok");
 const target=Math.min(3,original.pages.length-1);
 saveDemoBooks(getDemoBooks().map(book=>
  book.id===original.id?{...book,lastPage:target,favorite:true}:book
 ));
 // Closing Safari/PWA destroys the ephemeral store, but keeps opted-in books.
 session.removeItem("wondertale-preview-books-v1");
 const reopened=getDemoBooks();
 assert.equal(reopened.length,1);
 assert.equal(reopened[0].id,original.id);
 assert.equal(reopened[0].lastPage,target);
 assert.equal(reopened[0].favorite,true);
 assert.equal(reopened[0].savedOnDevice,true);
 assert.deepEqual(reopened[0].pages,original.pages);
 assert.ok(device.getItem("wondertale-opt-in-books-v1"));
}));

test("Preview-only books do not falsely promise persistence after a session restart",()=>withBrowserStores(({session})=>{
 const preview=create(false);
 assert.equal(getDemoBooks().find(b=>b.id===preview.id)?.savedOnDevice,false);
 session.removeItem("wondertale-preview-books-v1");
 assert.equal(getDemoBooks().length,0);
}));

test("A newly generated story does not overwrite existing saved books",()=>withBrowserStores(()=>{
 const first=create(true);
 const second=create(true);
 const books=getDemoBooks();
 assert.equal(books.length,2);
 assert.deepEqual(new Set(books.map(b=>b.id)),new Set([first.id,second.id]));
 assert.ok(books.every(b=>b.savedOnDevice));
}));

test("A failed subsequent write leaves the original saved story intact",()=>withBrowserStores(({device})=>{
 const saved=create(true);
 const previous=device.getItem("wondertale-opt-in-books-v1");
 assert.throws(()=>saveDemoBooks([...getDemoBooks(),{...saved}]),/LOCAL_LIBRARY_SAVE_FAILED/);
 assert.equal(device.getItem("wondertale-opt-in-books-v1"),previous);
 assert.equal(getDemoBooks().length,1);
}));

test("A quota error while writing session books restores both storage areas",()=>withBrowserStores(({device,session})=>{
 const saved=create(true);
 const transient=create(false);
 const oldDevice=device.getItem("wondertale-opt-in-books-v1");
 const oldSession=session.getItem("wondertale-preview-books-v1");
 const original=session.setItem;
 session.setItem=()=>{throw new Error("QuotaExceededError");};
 try{
  assert.throws(()=>saveDemoBooks(getDemoBooks().map(book=>
   book.id===saved.id?{...book,lastPage:2}:
   book.id===transient.id?{...book,favorite:true}:book
  )),/LOCAL_LIBRARY_SAVE_FAILED/);
 }finally{session.setItem=original;}
 assert.equal(device.getItem("wondertale-opt-in-books-v1"),oldDevice);
 assert.equal(session.getItem("wondertale-preview-books-v1"),oldSession);
 assert.deepEqual(new Set(getDemoBooks().map(b=>b.id)),new Set([saved.id,transient.id]));
 assert.equal(getDemoBooks().find(book=>book.id===saved.id)?.lastPage,0);
}));

test("A quota error on the persistent store cannot erase temporary books",()=>withBrowserStores(({device,session})=>{
 const saved=create(true);
 const transient=create(false);
 const oldDevice=device.getItem("wondertale-opt-in-books-v1");
 const oldSession=session.getItem("wondertale-preview-books-v1");
 const original=device.setItem;
 device.setItem=()=>{throw new Error("QuotaExceededError");};
 try{
  assert.throws(()=>saveDemoBooks(getDemoBooks().map(book=>
   book.id===transient.id?{...book,lastPage:3}:
   book.id===saved.id?{...book,favorite:true}:book
  )),/LOCAL_LIBRARY_SAVE_FAILED/);
 }finally{device.setItem=original;}
 assert.equal(device.getItem("wondertale-opt-in-books-v1"),oldDevice);
 assert.equal(session.getItem("wondertale-preview-books-v1"),oldSession);
 assert.deepEqual(new Set(getDemoBooks().map(b=>b.id)),new Set([saved.id,transient.id]));
}));

test("Updating saved reading progress never writes an unchanged session library",()=>withBrowserStores(({device,session})=>{
 const saved=create(true);
 const transient=create(false);
 let redundantSessionWrites=0;
 const original=session.setItem;
 session.setItem=()=>{redundantSessionWrites++;throw Error("Session store is full");};
 try{
  saveDemoBooks(getDemoBooks().map(book=>
   book.id===saved.id?{...book,lastPage:2}:book
  ));
 }finally{session.setItem=original;}
 assert.equal(redundantSessionWrites,0);
 assert.equal(getDemoBooks().find(book=>book.id===saved.id)?.lastPage,2);
 assert.ok(getDemoBooks().some(book=>book.id===transient.id));
 assert.ok(device.getItem("wondertale-opt-in-books-v1"));
}));

test("Unchanged persistent books are not rewritten when ephemeral progress changes",()=>withBrowserStores(({device})=>{
 const saved=create(true);
 const transient=create(false);
 let redundantDeviceWrites=0;
 const original=device.setItem;
 device.setItem=()=>{redundantDeviceWrites++;throw Error("Persistent store is full");};
 try{
  saveDemoBooks(getDemoBooks().map(book=>
   book.id===transient.id?{...book,lastPage:2}:book
  ));
 }finally{device.setItem=original;}
 assert.equal(redundantDeviceWrites,0);
 assert.equal(getDemoBooks().find(book=>book.id===transient.id)?.lastPage,2);
 assert.ok(getDemoBooks().some(book=>book.id===saved.id));
}));
