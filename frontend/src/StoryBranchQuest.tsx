import React, { useState } from "react";
import type { Lang } from "./i18n";

type Trail = "forest" | "stars";
type Decision = "help" | "explore";
type StoryCopy = {
  heading:string; note:string; begin:string; forest:string; stars:string;
  forestScene:string; starsScene:string; help:string; explore:string;
  restart:string; back:string; endingTitle:string;
  results:Record<Trail,Record<Decision,string>>;
};
const copy:Record<Lang,StoryCopy>={
  ru:{
    heading:"Выбери своё приключение",note:"Бонусная история: исходная сказка не изменится.",
    begin:"Куда отправится герой после финала?",forest:"В волшебный лес",stars:"К звёздному озеру",
    forestScene:"За зелёными воротами леса мерцал фонарик. Рядом слышался тихий зов о помощи.",
    starsScene:"На берегу звёздного озера сияла лодка, а в небе появлялась загадочная карта.",
    help:"Помочь новому другу",explore:"Разгадать тайну",restart:"Начать заново",back:"Назад",
    endingTitle:"Твоё продолжение",
    results:{
      forest:{help:"Герой помог маленькому хранителю леса вернуть потерянный свет. Деревья засияли, и все устроили добрый праздник.",
        explore:"Герой проследил за огоньками и нашёл библиотеку под корнями старого дуба. В ней хранилась карта следующего приключения."},
      stars:{help:"Герой заметил заблудившуюся звезду и помог ей вернуться домой. В благодарность озеро подарило ему тёплое серебряное сияние.",
        explore:"Герой отправился по карте на лодке и открыл остров поющих созвездий. Каждая звезда рассказала ему новую сказку."}
    }
  },
  uz:{
    heading:"Sarguzashtni ozing tanla",note:"Qoshimcha hikoya: asl ertak ozgarmaydi.",
    begin:"Ertakdan keyin qahramon qayerga boradi?",forest:"Sehrli ormonga",stars:"Yulduzli kolga",
    forestScene:"Yashil darvozalar ortida chiroq miltillardi. Yaqindan yordam soragan ovoz eshitildi.",
    starsScene:"Yulduzli kol boyida qayiq yaltirardi, osmonda esa sirli xarita paydo boldi.",
    help:"Yangi dostga yordam berish",explore:"Sirni ochish",restart:"Qaytadan boshlash",back:"Orqaga",
    endingTitle:"Sening davomiy hikoyang",
    results:{
      forest:{help:"Qahramon kichik ormon qorovuliga yoqolgan nurni topishga yordam berdi. Daraxtlar porladi va hamma bayram qildi.",
        explore:"Qahramon chiroqlar ortidan borib, eski eman ostidagi kutubxonani topdi. Unda yangi sarguzasht xaritasi bor edi."},
      stars:{help:"Qahramon adashgan yulduzga uyiga qaytishda yordam berdi. Kol unga kumush nur sovga qildi.",
        explore:"Qahramon qayiqda xarita boylab suzib, kuylaydigan yulduzlar orolini kashf etdi. Har bir yulduz yangi ertak aytdi."}
    }
  },
  en:{
    heading:"Choose your adventure",note:"Bonus story: your original book will not change.",
    begin:"Where should the hero go after the ending?",forest:"The enchanted forest",stars:"The starlit lake",
    forestScene:"Behind the green forest gates a lantern glimmered. Someone nearby called softly for help.",
    starsScene:"A bright boat waited by the starlit lake while a mysterious map appeared overhead.",
    help:"Help a new friend",explore:"Solve the mystery",restart:"Start again",back:"Go back",
    endingTitle:"Your new ending",
    results:{
      forest:{help:"The hero helped a tiny forest keeper restore a lost light. The trees began to glow, and everyone celebrated kindness.",
        explore:"Following the lanterns, the hero found a library beneath an ancient oak. Inside lay a map to another adventure."},
      stars:{help:"The hero helped a lost star find its home. The lake thanked them with a gentle silver glow.",
        explore:"Following the map by boat, the hero discovered an island of singing constellations. Every star shared a story."}
    }
  }
};

/** A local, optional branching epilogue. Never writes to the book or backend. */
export function StoryBranchQuest({lang}:{lang:Lang}){
  const [trail,setTrail]=useState<Trail|null>(null);
  const [decision,setDecision]=useState<Decision|null>(null);
  const t=copy[lang];
  return <section className="story-branch-quest" aria-label={t.heading}>
    <h3>{t.heading}</h3><p className="story-branch-note">{t.note}</p>
    {!trail&&<>
      <p>{t.begin}</p>
      <div className="story-branch-choices">
        <button type="button" onClick={()=>setTrail("forest")}>{t.forest}</button>
        <button type="button" onClick={()=>setTrail("stars")}>{t.stars}</button>
      </div>
    </>}
    {trail&&!decision&&<>
      <p>{trail==="forest"?t.forestScene:t.starsScene}</p>
      <div className="story-branch-choices">
        <button type="button" onClick={()=>setDecision("help")}>{t.help}</button>
        <button type="button" onClick={()=>setDecision("explore")}>{t.explore}</button>
      </div>
      <button className="story-branch-back" type="button" onClick={()=>setTrail(null)}>{t.back}</button>
    </>}
    {trail&&decision&&<div role="status" aria-live="polite">
      <strong>{t.endingTitle}</strong>
      <p>{t.results[trail][decision]}</p>
      <button className="story-branch-back" type="button" onClick={()=>{setTrail(null);setDecision(null);}}>{t.restart}</button>
    </div>}
  </section>;
}
