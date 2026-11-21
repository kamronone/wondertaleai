import {useEffect,useState} from "react";
import {Hand, Sparkles} from "lucide-react";
import type {Lang} from "./i18n";

type Interaction={prompt:Record<Lang,string>;choices:[{label:Record<Lang,string>;answer:Record<Lang,string>},{label:Record<Lang,string>;answer:Record<Lang,string>}]};
type SceneKey=`${string}:${number}`;

const tr=(ru:string,uz:string,en:string):Record<Lang,string>=>({ru,uz,en});
const scenes:Partial<Record<SceneKey,Interaction>>={
  "three-pigs:4":{
    prompt:tr("Поможем поросёнку построить дом?","Cho'chqachaga uy qurishda yordam beramizmi?","Shall we help the pig build his house?"),
    choices:[
      {label:tr("Подать кирпич","G'isht uzatish","Pass a brick"),answer:tr("Поросёнок аккуратно положил кирпич. Стена стала крепче!","Cho'chqacha g'ishtni ehtiyotkorlik bilan qo'ydi. Devor mustahkamlandi!","The pig laid the brick carefully. The wall is stronger!")},
      {label:tr("Подать раствор","Qorishma uzatish","Pass the mortar"),answer:tr("Теперь кирпичи держатся крепко. Отличная помощь!","Endi g'ishtlar mahkam turadi. Ajoyib yordam!","Now the bricks hold together. Wonderful teamwork!")}
    ]
  },
  "three-pigs:7":{
    prompt:tr("Волк дует на кирпичный дом! Что сделаем?","Bo'ri g'isht uyga puflayapti! Nima qilamiz?","The wolf is blowing at the brick house. What shall we do?"),
    choices:[
      {label:tr("Закрыть дверь","Eshikni yopish","Close the door"),answer:tr("Дверь закрыта, а прочный дом защищает друзей.","Eshik yopildi, mustahkam uy do'stlarni himoya qiladi.","The door is closed, and the strong house keeps everyone safe.")},
      {label:tr("Успокоить волка","Bo'rini tinchlantirish","Calm the wolf"),answer:tr("Волк остановился и решил поговорить по-доброму.","Bo'ri to'xtadi va yaxshi gaplashishga qaror qildi.","The wolf stopped and decided to talk kindly.")}
    ]
  },
  "cinderella:5":{
    prompt:tr("Золушка на балу. Чем ей поможем?","Zolushka bazmda. Unga qanday yordam beramiz?","Cinderella is at the ball. How can we help?"),
    choices:[
      {label:tr("Пожелать удачи","Omad tilash","Wish her luck"),answer:tr("Золушка улыбнулась и смело вышла на танец.","Zolushka jilmayib, dadil raqsga tushdi.","Cinderella smiled and stepped onto the dance floor.")},
      {label:tr("Напомнить о часах","Soatni eslatish","Remind her of the clock"),answer:tr("Золушка поблагодарила тебя и запомнила время.","Zolushka rahmat aytib, vaqtni eslab qoldi.","Cinderella thanked you and remembered the time.")}
    ]
  },
  "red-hood:1":{
    prompt:tr("Красная Шапочка отправляется в лес. Что ей сказать?","Qizil qalpoqcha o'rmonga ketmoqda. Unga nima deymiz?","Little Red Riding Hood is going into the forest. What shall we say?"),
    choices:[
      {label:tr("Счастливого пути!","Oq yo'l!","Have a lovely walk!"),answer:tr("Красная Шапочка помахала рукой и улыбнулась.","Qizil qalpoqcha qo'l silkitib jilmaydi.","Little Red Riding Hood waved and smiled.")},
      {label:tr("Иди по тропинке","So'qmoqdan yur","Stay on the path"),answer:tr("Она согласилась идти по знакомой безопасной тропинке.","U tanish va xavfsiz so'qmoqdan yurishga rozi bo'ldi.","She agreed to follow the familiar safe path.")}
    ]
  }
};

/** Optional scene-aware choices. These only change local UI, never alter a child's book or account. */
export function classicInteractionForPage(classicId:string|undefined,page:number):Interaction|null{
  if(!classicId||!Number.isInteger(page)||page<1||page>8)return null;
  return scenes[`${classicId}:${page}`]??null;
}

export function StorySceneInteraction({classicId,page,lang,disabled=false}:{classicId:string|undefined;page:number;lang:Lang;disabled?:boolean}){
  const scene=classicInteractionForPage(classicId,page);
  const [choice,setChoice]=useState<number|null>(null);
  useEffect(()=>{setChoice(null);},[classicId,page]);
  if(!scene||disabled)return null;
  return <section className="wt-scene-play" aria-label={tr("Поиграем с героем","Qahramon bilan o'ynaymiz","Play with the character")[lang]}>
    <div className="wt-scene-play-heading"><Sparkles size={16} aria-hidden="true"/><strong>{scene.prompt[lang]}</strong></div>
    <div className="wt-scene-play-actions">
      {scene.choices.map((item,index)=><button key={index} type="button" aria-pressed={choice===index} onClick={()=>setChoice(index)}><Hand size={14} aria-hidden="true"/>{item.label[lang]}</button>)}
    </div>
    {choice!==null&&<p role="status" aria-live="polite">{scene.choices[choice].answer[lang]}</p>}
  </section>;
}
