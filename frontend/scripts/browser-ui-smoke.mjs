// Optional real-browser smoke, never part of Netlify or automatic CI.
// From frontend, install Playwright in an isolated checkout:
// npm install --no-save --package-lock=false playwright
// npx playwright install chromium webkit
// node scripts/browser-ui-smoke.mjs http://localhost:4173
// Or provide the explicit isolated Netlify Preview origin.
import assert from "node:assert/strict";
const base=new URL(process.argv[2]??"http://localhost:4173");
const local=["localhost","127.0.0.1","[::1]"].includes(base.hostname);
const preview=base.hostname.endsWith("--wondertal.netlify.app")&&base.protocol==="https:";
if(!local&&!preview)throw Error("Use only localhost or an isolated wondertal Netlify Preview");
if(base.username||base.password)throw Error("Do not supply credentials");
const {chromium,webkit}=await import("playwright");
const configs=[
 {engine:webkit,name:"iPhone-sized WebKit",viewport:{width:390,height:844},isMobile:true,hasTouch:true},
 {engine:webkit,name:"small iPhone-sized WebKit",viewport:{width:320,height:568},isMobile:true,hasTouch:true},
 {engine:chromium,name:"Android-sized Chromium",viewport:{width:360,height:800},isMobile:true,hasTouch:true},
 {engine:chromium,name:"desktop Chromium",viewport:{width:1440,height:900},isMobile:false,hasTouch:false}
];
let failures=0;
for(const {engine,name,...options} of configs){
 let browser;
 try{
  browser=await engine.launch();
  const context=await browser.newContext({...options,serviceWorkers:"block"});
  // No credentials, external APIs, paid generation, remote data mutations.
  await context.route("**/*",route=>{
   const req=route.request(),url=new URL(req.url());
   return url.origin===base.origin&&["GET","HEAD"].includes(req.method())&&!url.pathname.startsWith("/api/")?route.continue():route.abort();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const visible=async selector=>{await page.locator(selector).first().waitFor({state:"visible"});};
  const geometry=async label=>{
   const result=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(result.scroll<=result.width+2,label+": horizontal overflow "+JSON.stringify(result));
  };
  const tap=async selector=>{await visible(selector);await page.locator(selector).first().click();};
  await page.goto(base.origin+"/",{waitUntil:"domcontentloaded"});
  await page.locator(".welcome-skip, .shell .hero").first().waitFor({state:"visible"});
  if(await page.locator(".welcome-skip").isVisible())await tap(".welcome-skip");
  await visible(".shell .hero");await geometry("home");
  await tap(".quick-actions > button:first-child");await visible(".library-page");await geometry("library");
  await tap(".header-actions .small-button");await visible(".profile-concept-three");await geometry("profile");
  await tap('[aria-controls="profile-settings-panel"]');await visible("#profile-settings-panel");await geometry("settings");
  await page.goto(base.origin+"/",{waitUntil:"domcontentloaded"});
  await page.locator(".welcome-skip, .shell .hero").first().waitFor({state:"visible"});
  if(await page.locator(".welcome-skip").isVisible())await tap(".welcome-skip");
  await tap(".hero .primary-button");await visible(".create-page");await geometry("create step 1");
  await page.locator(".create-page .form-grid input").fill("QA");
  await tap(".wizard-step-one-next");await visible(".wizard-step-two-v4");await geometry("create step 2");
  await page.goto(base.origin+"/",{waitUntil:"domcontentloaded"});
  await page.locator(".welcome-skip, .shell .hero").first().waitFor({state:"visible"});
  if(await page.locator(".welcome-skip").isVisible())await tap(".welcome-skip");
  await tap(".cartoon-entry");await visible(".cartoon-studio");await geometry("cartoons");
  await page.goto(base.origin+"/admin",{waitUntil:"domcontentloaded"});
  await visible(".admin-shell");await geometry("admin");
  const sections=page.locator(".admin-navigation button");
  assert.equal(await sections.count(),6);
  for(let i=0;i<6;i++){
   await sections.nth(i).click();
   assert.equal(await sections.nth(i).getAttribute("aria-pressed"),"true");
   await geometry("admin section "+i);
  }
  assert.deepEqual(errors,[],"uncaught browser errors");
  console.log("PASS",name);
  await context.close();
 }catch(error){failures++;console.error("FAIL",name,error.message);}
 finally{await browser?.close();}
}
if(failures)process.exitCode=1;
