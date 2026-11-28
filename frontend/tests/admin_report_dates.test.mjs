import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
const source=readFileSync(new URL("../src/admin_report_dates.ts",import.meta.url),"utf8");
const {code}=transformSync(source,{loader:"ts",format:"esm"});
const {utcPeriod,utcReportRange}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const dashboard=readFileSync(new URL("../src/BillingDashboard.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/billing-dashboard.css",import.meta.url),"utf8");
test("UTC presets use inclusive calendar days including year transitions",()=>{
 const now=Date.parse("2026-11-27T23:59:59Z");
 assert.deepEqual(utcPeriod(30,now),{start:"2026-10-29",end:"2026-11-27"});
 for(const days of [7,30,90]){
  const {start,end}=utcPeriod(days,now);
  const {from,to}=utcReportRange(start,end);
  assert.equal((+to-+from)/86400000,days);
 }
 assert.deepEqual(utcPeriod(7,Date.parse("2027-01-03T00:00:00Z")),{start:"2026-12-28",end:"2027-01-03"});
});
test("range validation rejects empty, impossible, reversed and oversized dates",()=>{
 for(const [a,b] of [["","2026-11-27"],["2026-02-30","2026-03-02"],["2026-11-28","2026-11-27"],["2025-01-01","2026-01-02"]])assert.equal(utcReportRange(a,b),null);
 const leap=utcReportRange("2024-02-29","2024-02-29");
 assert.equal(leap.to.toISOString(),"2024-03-01T00:00:00.000Z");
 const full=utcReportRange("2024-01-01","2024-12-31");
 assert.equal((+full.to-+full.from)/86400000,366);
});
test("admin dates have one visible native control each and responsive layout",()=>{
 const filter=dashboard.slice(dashboard.indexOf('className="billing-filters admin-date-panel"'),dashboard.indexOf('{!validRange&&'));
 assert.equal((filter.match(/type="date"/g)||[]).length,2);
 assert.doesNotMatch(filter,/aria-hidden|opacity:0|showPicker|style=\{/);
 assert.match(filter,/\[7,30,90\]/);
 assert.match(css,/repeat\(auto-fit,minmax\(min\(100%,150px\),1fr\)\)/);
 assert.match(css,/min-height:44px/);
 assert.match(dashboard,/if\(!range\)\{setState\("error"\);return;\}/);
});
