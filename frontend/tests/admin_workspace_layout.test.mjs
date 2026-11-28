import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/BillingDashboard.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/billing-dashboard.css",import.meta.url),"utf8");
test("admin navigation has a normal-flow mobile exit and accessible controls",()=>{
 assert.match(source,/className="admin-sidebar-head"/);
 assert.match(source,/className="admin-mobile-exit" href="\/" aria-label=/);
 assert.match(source,/aria-pressed=\{section===key\}/);
 assert.match(css,/\.admin-mobile-exit\{display:none\}/);
 assert.match(css,/\.admin-exit\{display:none\}\.admin-mobile-exit\{display:grid/);
 assert.doesNotMatch(css,/\.admin-exit\{[^}]*position:absolute/);
});
test("finance summary keeps export and active plans in compact panels",()=>{
 assert.match(source,/className="billing-filters admin-report-heading"/);
 assert.match(source,/className="admin-plan-list"/);
 assert.match(source,/onClick=\{exportCsv\}/);
 assert.match(css,/\.admin-shell \.admin-report-heading \.admin-export\{[^}]*min-height:44px/);
 assert.match(css,/\.admin-shell \.admin-plan-list\{[^}]*min-width:0/);
});
