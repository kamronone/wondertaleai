import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const film=readFileSync(new URL("../src/ClassicFilm.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/cartoon-studio.css",import.meta.url),"utf8");
test("classic film audio uses one visible native language field",()=>{
 assert.equal((film.match(/<select /g)||[]).length,1);
 assert.ok(film.includes('className="cartoon-audio-field" disabled={busy} value={audioLanguage}'));
 assert.ok(!film.includes("cartoon-audio-value"));
 assert.ok(film.includes("changeAudio(event.target.value as Lang)"));
 const rule=css.split(".cartoon-film-toolbar .cartoon-film-audio select.cartoon-audio-field {")[1].split("}")[0];
 for(const value of ["min-height: 44px","font-size: 16px","appearance: auto","max-width: 100%"])assert.ok(rule.includes(value));
 assert.ok(!rule.includes("opacity: 0"));
});
