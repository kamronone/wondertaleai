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
  "snow-white:4":{
    id:"snow-white-flowers",
    asset:"/images/interactions/flower-basket.svg",
    name:tr("Корзинка цветов","Gullar savati","Flower basket"),
    instruction:tr("Передай Белоснежке цветы для новых друзей","Oppog‘oyga yangi do‘stlari uchun gullarni uzating","Give Snow White some flowers for her new friends"),
    reply:tr("Спасибо! Эти цветы порадуют моих друзей!","Rahmat! Bu gullar do‘stlarimni xursand qiladi!","Thank you! These flowers will make my friends smile!"),
    start:{x:.83,y:.79},target:{x:.26,y:.66}
  },
  "ugly-duckling:5":{
    id:"duckling-lily",
    asset:"/images/interactions/pond-lily.svg",
    name:tr("Водяная лилия","Suv nilufari","Water lily"),
    instruction:tr("Подари утёнку лилию у пруда","O‘rdakchaga hovuz yonida nilufar sovg‘a qiling","Give the duckling a lily by the pond"),
    reply:tr("Какой красивый цветок! Мне стало веселее!","Qanday chiroyli gul! Kayfiyatim ko‘tarildi!","What a lovely flower! I feel happier now!"),
    start:{x:.83,y:.80},target:{x:.42,y:.65}
  },
  "bremen:4":{
    id:"bremen-bell",
    asset:"/images/interactions/music-bell.svg",
    name:tr("Музыкальный колокольчик","Musiqa qo‘ng‘irog‘i","Music bell"),
    instruction:tr("Передай музыкантам колокольчик","Musiqachilarga qo‘ng‘iroqchani uzating","Give the musicians the little bell"),
    reply:tr("Дзинь-дзинь! Теперь наша песня звучит ещё веселее!","Jiring-jiring! Endi qo‘shig‘imiz yanada quvnoq!","Ding-ding! Our song sounds even merrier now!"),
    start:{x:.86,y:.79},target:{x:.48,y:.61}
  },
  "rapunzel:3":{
    id:"rapunzel-flower",
    asset:"/images/interactions/tower-flower.svg",
    name:tr("Цветок для Рапунцель","Rapunsel uchun gul","Flower for Rapunzel"),
    instruction:tr("Подари Рапунцель цветок у башни","Minora yonida Rapunselga gul sovg‘a qiling","Give Rapunzel a flower by the tower"),
    reply:tr("Спасибо за цветок! Ты сделал мой день светлее!","Gul uchun rahmat! Kunim yanada yorishdi!","Thank you for the flower! You've brightened my day!"),
    start:{x:.85,y:.79},target:{x:.50,y:.45}
  },
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
