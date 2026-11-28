import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const header=readFileSync(new URL("../src/ProfileHeader.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/profile-concept-three.css",import.meta.url),"utf8");

test("profile uses reference topbar and retains original header elsewhere",()=>{
  assert.match(app,/\{tab==="account"\?<ProfileHeader lang=\{lang\}/);
  assert.match(app,/<header className="topbar">/);
  assert.match(app,/onLanguage=\{switchLang\}/);
  assert.match(app,/onPrivacy=\{\(\)=>openLegal\("privacy"\)\}/);
});

test("profile header keeps brand and tools without redundant back button",()=>{
  assert.doesNotMatch(header,/className="profile-mockup-back"/);
  assert.doesNotMatch(header,/<ArrowLeft/);
  const profileHeader=app.match(/<ProfileHeader\b[^\n]*\/>/)?.[0]||"";
  assert.ok(profileHeader);
  assert.doesNotMatch(profileHeader,/onBack=/);
  assert.match(header,/className="profile-mockup-brand"/);
  assert.match(header,/className="profile-mockup-tools"/);
});

test("notification and settings icons expose meaningful panels",()=>{
  assert.match(header,/aria-controls="profile-notification-panel"/);
  assert.match(header,/aria-controls="profile-settings-panel"/);
  assert.match(header,/aria-expanded=\{open==="notifications"\}/);
  assert.match(header,/aria-expanded=\{open==="settings"\}/);
  assert.match(header,/Notification\.requestPermission\(\)/);
  assert.match(header,/permission==="default"/);
  assert.match(header,/onLanguage\(event\.target\.value as Lang\)/);
  assert.match(header,/onPrivacy\(\)/);
});

test("notification UI does not pretend that permission enables push",()=>{
  assert.match(header,/does not activate server push notifications/);
  assert.match(header,/No new notifications/);
  assert.doesNotMatch(header,/setTimeout\(/);
});

test("profile hero, tools and dialogs adapt to narrow phones",()=>{
  assert.match(styles,/\.profile-mockup-topbar\s*\{/);
  assert.match(styles,/\.profile-mockup-popover\s*\{/);
  assert.match(styles,/\.profile-concept-three \.parent-account-hero-art\s*\{[^}]*outline:1px solid/s);
  assert.match(styles,/@media\(max-width:620px\)/);
  assert.match(styles,/@media\(max-width:340px\)/);
});
