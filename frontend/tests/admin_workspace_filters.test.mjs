import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/BillingDashboard.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/billing-dashboard.css",import.meta.url),"utf8");
test("user list supports status and book-count sorting before pagination",()=>{
 assert.match(source,/userStatus==="all"\|\|user.status===userStatus/);
 assert.match(source,/userSort==="books"\?b.books-a.books/);
 assert.match(source,/\[query,plan,userStatus,userSort,section\]/);
 assert.match(source,/visibleUsers.slice\(safePage\*pageSize/);
});
test("clearing filters does not reset demo records or bypass permissions",()=>{
 assert.equal((source.match(/>Очистить фильтры<\/button>/g)||[]).length,2);
 assert.ok(source.includes('onClick={()=>{setQuery("");setPlan("all");setUserStatus("all");setUserSort("id");setUserPage(0);}}'));
 assert.match(source,/disabled=\{!canManageUsers\(role\)\}/);
 assert.match(source,/disabled=\{!canModerate\(role\)\}/);
});
test("filters and actions use responsive admin-only grids",()=>{
 assert.equal((source.match(/className="billing-filters admin-section-filters"/g)||[]).length,2);
 assert.match(css,/\.admin-shell \.admin-section-filters\{display:grid/);
 assert.match(css,/\.admin-shell \.admin-filter-actions\{grid-column:1\/-1/);
 assert.match(css,/@media\(max-width:350px\)\{\.admin-shell \.admin-section-filters\{grid-template-columns:minmax\(0,1fr\)/);
});
