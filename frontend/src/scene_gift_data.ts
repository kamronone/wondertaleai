import type {Lang} from "./i18n";

export type Point={x:number;y:number};
export type StoryGiftScene={
  id:string;
  asset:string;
  name:Record<Lang,string>;
  instruction:Record<Lang,string>;
  reply:Record<Lang,string>;
  start:Point;
  target:Point;
};

/* These interactions correspond to existing scripted scenes and animated pages.
   Only built-in classic books are eligible, never private photos or AI uploads. */
const tr=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});
const giftScenes:Record<string,StoryGiftScene>={
  "three-pigs:7":{
    id:"three-pigs-wolf-door",
    asset:"/images/interactions/wooden-latch.svg",
    name:tr("Дверной засов","Eshik tambasi","Door bolt"),
    instruction:tr("Помоги поросятам закрыть дверь","Cho‘chqachalarga eshikni yopishda yordam bering","Help the pigs secure the door"),
    reply:tr("Спасибо! Дверь закрыта, и наш крепкий дом нас защитит!","Rahmat! Eshik yopildi, mustahkam uyimiz bizni himoya qiladi!","Thank you! The door is secure and our strong house keeps us safe!"),
    start:{x:.83,y:.80},target:{x:.42,y:.58}
  },
  "cinderella:5":{
    id:"cinderella-clock",
    asset:"/images/interactions/story-clock.svg",
    name:tr("Волшебные часы","Sehrli soat","Fairy-tale clock"),
    instruction:tr("Передай Золушке часы, чтобы она помнила о времени","Zoluškaga soatni uzating, vaqtni eslab qolsin","Give Cinderella the clock so she remembers the time"),
    reply:tr("Спасибо! Я не забуду о времени и успею домой!","Rahmat! Vaqtni unutmayman va uyga ulgura olaman!","Thank you! I'll remember the time and get home safely!"),
    start:{x:.84,y:.78},target:{x:.49,y:.57}
  },
  "red-hood:1":{
    id:"red-hood-path",
    asset:"/images/interactions/forest-map.svg",
    name:tr("Карта лесной тропинки","O‘rmon so‘qmog‘i xaritasi","Forest path map"),
    instruction:tr("Передай Красной Шапочке карту безопасной тропинки","Qizil qalpoqchaga xavfsiz so‘qmoq xaritasini uzating","Give Little Red Riding Hood the safe path map"),
    reply:tr("Спасибо! Я пойду по знакомой тропинке к бабушке!","Rahmat! Buvimnikiga tanish so‘qmoqdan boraman!","Thank you! I'll follow the familiar path to Grandma's house!"),
    start:{x:.83,y:.80},target:{x:.55,y:.55}
  }
};
export function storyGiftForPage(classicId:string|undefined,page:number):StoryGiftScene|null{
  if(!classicId||!Number.isInteger(page))return null;
  return giftScenes[`${classicId}:${page}`]??null;
}
