import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sceneAudio=read("../src/SceneReplyAudio.tsx");
const brick=read("../src/BrickPassInteraction.tsx");
const gift=read("../src/StoryGiftInteraction.tsx");
const reader=read("../src/main.tsx");
const css=read("../src/scene-reply-audio.css");

test("reply audio is optional and appears only when the child has delivered an item",()=>{
 assert.match(brick,/\{delivered&&<SceneReplyAudio text=\{success\} lang=\{lang\}/);
 assert.match(gift,/\{delivered&&<SceneReplyAudio text=\{scene\.reply\[lang\]\} lang=\{lang\}/);
 assert.match(brick,/className="wt-brick-speech" role="status" aria-live="polite"/);
 assert.match(gift,/className="wt-gift-speech" role="status" aria-live="polite"/);
 assert.doesNotMatch(sceneAudio,/useEffect\([^)]*\.speak\(/s);
});

test("reply audio is selected only in the story language and starts with a tap",()=>{
 assert.match(sceneAudio,/preferredStoryVoice\(engine\.getVoices\(\),lang,null\)/);
 assert.match(sceneAudio,/if\(!voice\)\{setUnavailable\(true\);return;\}/);
 assert.match(sceneAudio,/new SpeechSynthesisUtterance\(text\)/);
 assert.match(sceneAudio,/spoken\.lang=STORY_SPEECH_LOCALE\[lang\]/);
 assert.match(sceneAudio,/onClick=\{event=>\{event\.stopPropagation\(\);toggle\(\);\}\}/);
 assert.match(sceneAudio,/onBeforeSpeak\(\)/);
 assert.match(reader,/onBeforeReply=\{stopSpeech\}/);
});

test("replies do not auto navigate, expire, or require a paid provider",()=>{
 assert.doesNotMatch(sceneAudio,/setPage\(|onNextPage|setTimeout\(|fetch\(|localStorage|Authorization|privateToken/);
 assert.match(sceneAudio,/speechSynthesis\.cancel\(\)/);
 assert.match(sceneAudio,/current\.current=null/);
 assert.match(sceneAudio,/onTouchStart=\{event=>event\.stopPropagation\(\)\}/);
});

test("replay control is compact, accessible and remains inside the art overlay",()=>{
 assert.match(sceneAudio,/aria-pressed=\{playing\}/);
 assert.match(sceneAudio,/role="status"/);
 assert.match(sceneAudio,/ru:"Озвучить ответ"/);
 assert.match(sceneAudio,/uz:"Javobni tinglaş"/);
 assert.match(sceneAudio,/en:"Hear the reply"/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/max-width:calc\(100% - 20px\)/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(reader,/import "\.\/scene-reply-audio\.css"/);
});
