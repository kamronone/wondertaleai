import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
const reactions=[
  "/images/interactions/reactions/snow-white-wave.gif",
  "/images/interactions/reactions/duckling-flutter.gif",
  "/images/interactions/reactions/bremen-music.gif"
];

function serviceWorker(fakeFetch) {
  const handlers={};
  const saved=new Map();
  const store={
    match:async request=>saved.get(typeof request==="string"?request:request.url)??null,
    put:async(request,response)=>{saved.set(typeof request==="string"?request:request.url,response);},
    add:async()=>{},
    addAll:async()=>{}
  };
  const caches={
    open:async()=>store,
    keys:async()=>[],
    delete:async()=>true
  };
  const self={
    location:{origin:"https://storybook.example.test"},
    addEventListener:(name,callback)=>{handlers[name]=callback;},
    skipWaiting:async()=>{},
    clients:{claim:async()=>{}}
  };
  vm.runInNewContext(source,{self,caches,fetch:fakeFetch,URL,Response,Promise,console},{filename:"sw.js"});
  const dispatch=async(url,extra={})=>{
    const request={
      url:"https://storybook.example.test"+url,
      method:"GET",mode:"no-cors",
      headers:new Headers(extra.authorization?{"Authorization":"Bearer secret"}:{})
    };
    let pending=null;
    handlers.fetch({request,respondWith:result=>{pending=Promise.resolve(result);}});
    return pending===null?null:await pending;
  };
  return {dispatch,saved};
}

test("original reaction GIFs are cached lazily, not during PWA installation",()=>{
  assert.match(source,/wondertale-public-v19/);
  assert.match(source,/images\\\/interactions\\\/reactions/);
  for(const path of reactions)assert.doesNotMatch(source,new RegExp('"' + path + '"'));
  assert.doesNotMatch(source,/OPTIONAL_ART\s*=\s*\[[^\]]*\/api\//s);
  assert.doesNotMatch(source,/OPTIONAL_ART\s*=\s*\[[^\]]*\/account\//s);
});

test("new public GIF is cached and playable offline after successful fetch",async()=>{
  let online=true;
  const fakeFetch=async()=>{
    if(!online)throw new Error("Offline");
    return {
      ok:true,type:"basic",
      headers:new Headers({"content-type":"image/gif"}),
      clone(){return this;},
      marker:"GIF89a"
    };
  };
  const {dispatch,saved}=serviceWorker(fakeFetch);
  const path=reactions[0];
  assert.equal((await dispatch(path)).marker,"GIF89a");
  assert.ok(saved.has("https://storybook.example.test"+path));
  online=false;
  assert.equal((await dispatch(path)).marker,"GIF89a");
});

test("HTML rewrite must never replace a cached reaction GIF",async()=>{
  let response={
    ok:true,type:"basic",headers:new Headers({"content-type":"image/gif"}),
    marker:"original-gif",clone(){return this;}
  };
  const {dispatch}=serviceWorker(async()=>response);
  const path=reactions[1];
  await dispatch(path);
  response={
    ok:true,type:"basic",headers:new Headers({"content-type":"text/html"}),
    marker:"spa-html",clone(){return this;}
  };
  assert.equal((await dispatch(path)).marker,"original-gif");
});

test("other origins and bearer-authorized requests never enter a public cache",async()=>{
  const {dispatch,saved}=serviceWorker(async()=>{throw new Error("should not fetch")});
  assert.equal(await dispatch(reactions[2],{authorization:true}),null);
  assert.equal(await dispatch("/api/books"),null);
  assert.equal(saved.size,0);
});

test("PWA rejects a GIF with non-image content type",async()=>{
  const {dispatch,saved}=serviceWorker(async()=>({
    ok:true,type:"basic",headers:new Headers({"content-type":"text/html"}),
    marker:"html-not-gif",clone(){return this;}
  }));
  assert.equal((await dispatch(reactions[2])).marker,"html-not-gif");
  assert.equal(saved.size,0);
});
