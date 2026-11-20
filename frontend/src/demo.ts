// Browser-only preview fallback. Photos never leave the browser in this mode.
import type { Lang } from "./i18n";
import { classics, type ClassicId } from "./classics";
export type DemoBook = {id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:{number:number;text:string;image_url:string}[];mode:string;language?:Lang;classicId?:ClassicId;savedOnDevice?:boolean;favorite?:boolean;lastPage?:number;originalEnding?:string;endingChoice?:"friendship"|"discovery"};
const sessionKey="wondertale-preview-books-v1";
const deviceKey="wondertale-opt-in-books-v1";
export const isValidLocalBook=(value:unknown):value is DemoBook=>{
 if(!value||typeof value!=="object")return false;
 const book=value as Partial<DemoBook>;
 return typeof book.id==="string"&&/^local-[A-Za-z0-9_-]{1,120}$/.test(book.id)&&
   typeof book.created_at==="string"&&!Number.isNaN(Date.parse(book.created_at))&&
   typeof book.name==="string"&&book.name.trim().length>0&&book.name.length<=120&&
   typeof book.title==="string"&&book.title.trim().length>0&&book.title.length<=260&&
   typeof book.age==="number"&&Number.isInteger(book.age)&&book.age>=2&&book.age<=14&&
   typeof book.theme==="string"&&typeof book.style==="string"&&
   typeof book.prompt==="string"&&book.prompt.length<=1200&&
   Array.isArray(book.pages)&&book.pages.length>=1&&book.pages.length<=30&&
   book.pages.every((p,index)=>p&&typeof p.text==="string"&&p.text.trim().length>0&&p.text.length<=2200&&
     typeof p.image_url==="string"&&p.image_url.length<=40000&&
     Number.isInteger(p.number)&&p.number===index+1);
};
const readBooks=(getStore:()=>Storage,key:string,persistent:boolean):DemoBook[]=>{
 try{
   // Safari may throw SecurityError even when accessing the storage getter.
   const parsed:unknown=JSON.parse(getStore().getItem(key)||"[]");
   if(!Array.isArray(parsed))return [];
   return parsed.filter(isValidLocalBook).slice(0,20).map((book:DemoBook)=>{
     // The actual storage area, not untrusted JSON, determines persistence.
     const safe:DemoBook={...book,savedOnDevice:persistent,favorite:book.favorite===true};
     safe.lastPage=Number.isInteger(book.lastPage)&&Number(book.lastPage)>=0
       ?Math.min(Number(book.lastPage),book.pages.length-1):0;
     if(typeof book.originalEnding!=="string"||book.originalEnding.length>2200)delete safe.originalEnding;
     if(book.endingChoice!=="friendship"&&book.endingChoice!=="discovery")delete safe.endingChoice;
     if(book.language!=="ru"&&book.language!=="uz"&&book.language!=="en")delete safe.language;
     return safe;
   });
 }catch{return []}
};
export const getDemoBooks=():DemoBook[]=>{
 const session=readBooks(()=>sessionStorage,sessionKey,false);
 const saved=readBooks(()=>localStorage,deviceKey,true);
 const found=new Set<string>();
 return [...saved,...session].filter(book=>{if(found.has(book.id))return false;found.add(book.id);return true;}).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,40);
};
export const saveDemoBooks=(books:DemoBook[])=>{
 const chosen=books.filter(b=>b.savedOnDevice);
 const ephemeral=books.filter(b=>!b.savedOnDevice);
 // Never silently evict an older book when the local library fills up.
 // Explicit deletion is the only way to free a saved-book slot.
 if(chosen.length>20||ephemeral.length>20){
   throw new Error("LOCAL_LIBRARY_FULL");
 }
 // Names and stories stay in this browser; photos are never saved or uploaded in demo.
 // A browser storage exception can occur halfway through the two writes.
 // Keep the previous values and report failure instead of silently losing books.
 let oldDevice:string|null;
 let oldSession:string|null;
 try{
   oldDevice=localStorage.getItem(deviceKey);
   oldSession=sessionStorage.getItem(sessionKey);
 }catch{
   throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
 }
 try{
   if(chosen.length)localStorage.setItem(deviceKey,JSON.stringify(chosen));
   else localStorage.removeItem(deviceKey);
   if(ephemeral.length)sessionStorage.setItem(sessionKey,JSON.stringify(ephemeral));
   else sessionStorage.removeItem(sessionKey);
 }catch{
   // Browser storage has no cross-storage transaction. Roll back what we can.
   try{
     if(oldDevice===null)localStorage.removeItem(deviceKey);
     else localStorage.setItem(deviceKey,oldDevice);
   }catch{/* Restore may also fail if storage is unavailable. */}
   try{
     if(oldSession===null)sessionStorage.removeItem(sessionKey);
     else sessionStorage.setItem(sessionKey,oldSession);
   }catch{/* Never claim the write succeeded after a storage failure. */}
   throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
 }
};
export const isDemoBook=(book:DemoBook)=>book.id.startsWith("local-");
const illustration=(index:number):string=>{
  // Original deterministic vector scenes for the local demo. No images are
  // downloaded, no child photos are used and no story text is embedded in SVG.
  const themes=[
    {sky:"#314575",horizon:"#a78ac2",hill:"#355c77",ground:"#538681",accent:"#ffe6a3"},
    {sky:"#514078",horizon:"#d296ac",hill:"#635f9a",ground:"#8192a7",accent:"#ffe6b1"},
    {sky:"#1f5e79",horizon:"#8ec2bc",hill:"#397e87",ground:"#75a990",accent:"#ffedc1"},
    {sky:"#4c4079",horizon:"#dbaab3",hill:"#765d88",ground:"#917b9b",accent:"#fff1bf"}
  ] as const;
  const scene=index%8;
  const theme=themes[Math.floor(index/2)%themes.length];
  const stars=Array.from({length:15},(_,i)=>{
    const x=45+(i*131+index*43)%670;
    const y=54+(i*79+index*27)%330;
    return '<circle cx="'+x+'" cy="'+y+'" r="'+(i%3+2)+'" fill="#fff6de" opacity=".85"/>';
  }).join("");
  const tree=(x:number,y:number,scale:number)=>'<g transform="translate('+x+' '+y+') scale('+scale+')"><path d="M-9 0 V-155 H9 V0" fill="#674e69"/><path d="M0 -280 C-145 -250 -135 -150 -90 -130 Q0 -85 90 -130 C135 -150 145 -250 0 -280Z" fill="#36776e"/><path d="M-82 -178 Q0 -265 82 -178" fill="none" stroke="#92bc9a" stroke-width="12" opacity=".45"/></g>';
  const forest=tree(122,810,.87)+tree(645,830,1.05)+tree(420,870,.53);
  const castle='<g transform="translate(170 425)"><path d="M0 300 V70 L88 70 V0 L155 0 V85 L256 85 V18 H320 V300Z" fill="#d4bfd7" stroke="#735f91" stroke-width="9"/><path d="M-20 70 L43 -15 108 70 M140 0 L188 -70 236 0 M245 18 L288 -54 336 18" fill="#856ba5" stroke="#74598d" stroke-width="8"/><path d="M134 300 V180 Q160 145 189 180 V300" fill="#66537c"/><path d="M50 135 H89 V182 H50 M230 140 H269 V187 H230" fill="#ffe5aa"/></g>';
  const bridge='<g><path d="M100 810 Q385 520 680 810 L680 864 Q385 616 100 864Z" fill="#c9a9a7" stroke="#845b7d" stroke-width="8"/><path d="M130 818 Q385 554 648 818" fill="none" stroke="#f3d8ae" stroke-width="14"/></g>';
  const fox='<g transform="translate(272 654)"><path d="M180 135 Q290 22 338 98 Q281 187 200 168" fill="#b9706b"/><ellipse cx="130" cy="170" rx="94" ry="126" fill="#e5a978"/><path d="M35 67 L60 -24 126 43 186 -24 213 67" fill="#e6a575"/><path d="M53 67 Q124 186 195 67 L177 147 Q130 196 73 151Z" fill="#fff1d7"/><circle cx="95" cy="93" r="8" fill="#44384e"/><circle cx="163" cy="93" r="8" fill="#44384e"/><circle cx="130" cy="123" r="9" fill="#4a384a"/></g>';
  const dragon='<g transform="translate(170 550)"><path d="M65 200 Q-5 20 120 30 Q270 -40 392 140 L475 110 Q465 228 343 213 Q220 300 65 200Z" fill="#80b1a0" stroke="#427b85" stroke-width="10"/><path d="M135 54 L180 -35 212 67 265 -22 282 100" fill="#c4d7ae"/><circle cx="330" cy="115" r="12" fill="#433c57"/><path d="M355 160 Q390 182 432 147" fill="none" stroke="#476777" stroke-width="9"/></g>';
  const boat='<g transform="translate(175 625)"><path d="M30 180 H390 Q365 284 190 275 Q55 272 30 180Z" fill="#956f8b"/><path d="M190 178 V-110 M193 -92 Q380 12 208 102Z" fill="#fbe8c1" stroke="#c4a5a8" stroke-width="8"/><path d="M90 310 Q160 280 220 305 T390 303" fill="none" stroke="#fff3cc" stroke-width="13" opacity=".7"/></g>';
  const lanterns=Array.from({length:5},(_,i)=>'<g transform="translate('+(105+i*136)+' '+(480+(i%2)*100)+')"><path d="M0 -85 V-10" stroke="#f9eac8" stroke-width="4"/><rect x="-23" y="-11" width="46" height="63" rx="13" fill="#ffe4a0" stroke="#ce9c98" stroke-width="6"/></g>').join("");
  const object=[forest,castle,fox,dragon,bridge,boat,lanterns,castle+fox][scene];
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024" role="img" aria-label="Fairy-tale illustration">'+
    '<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+theme.sky+'"/><stop offset="1" stop-color="'+theme.horizon+'"/></linearGradient></defs>'+
    '<rect width="768" height="1024" fill="url(#sky)"/>'+stars+
    '<circle cx="'+(scene%2?565:190)+'" cy="205" r="76" fill="'+theme.accent+'" opacity=".93"/>'+
    '<path d="M0 625 Q180 525 390 620 T768 570 V1024 H0Z" fill="'+theme.hill+'"/>'+
    '<path d="M0 765 Q200 660 425 774 T768 718 V1024 H0Z" fill="'+theme.ground+'"/>'+
    object+'<path d="M0 943 Q230 884 460 946 T768 928 V1024 H0Z" fill="#253f63" opacity=".24"/>'+
    '</svg>';
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
};
const demoStories:Record<Lang,(name:string,theme:string,prompt:string)=>{title:string;pages:string[]}>={
 ru:(name,theme,prompt)=>({title:name+" и волшебная звезда",pages:[
 "Однажды "+name+" увидел за окном маленькую звезду, которой нужна была помощь.",
 "Она рассказала о прекрасном мире «"+theme+"», где исчезли все цвета радуги.",
 name+" отправился в путь с весёлым лисёнком. Их ждала удивительная тропинка.",
 "Друзья встретили доброго дракона, который подсказал дорогу к волшебному дереву.",
 "Герой вспомнил свою мечту: "+prompt.trim().replace(/[.!?]+$/,"")+".",
 "Вместе они нашли маленький ключ, спрятанный среди светящихся цветов.",
 name+" повернул ключ, и мир снова наполнился красками, песнями и улыбками.",
 "Вернувшись домой, герой понял: смелость и доброта превращают обычный день в сказку."
 ]}),
 uz:(name,theme,prompt)=>({title:name+" va sehrli yulduz",pages:[
 "Bir kuni "+name+" deraza yonida yordamga muhtoj kiçkina yulduzni körib qoldi.",
 "Yulduz «"+theme+"» olamidagi kamalakning barça ranglari yöqolganini aytib berdi.",
 name+" quvnoq tulkiça bilan yölga çiqdi. Ularni ajoyib sarguzaşt kutardi.",
 "Döstlar sehrli daraxtga boradigan yölni körsatgan mehribon ajdarni uçratişdi.",
 "Qahramon öz orzusini esladi: "+prompt.trim().replace(/[.!?]+$/,"")+".",
 "Birgalikda ular nur soçib turgan gullar orasidan kiçkina kalitni topişdi.",
 name+" kalitni burdi va olam yana ranglar, qöşiqlar hamda tabassumlarga töldi.",
 "Uyga qaytgan qahramon jasorat va mehr oddiy kunni ham ertakka aylantirişini tuşundi."
 ]}),
 en:(name,theme,prompt)=>({title:name+" and the Magic Star",pages:[
 "One day, "+name+" spotted a little star outside the window. It needed help.",
 "The star explained that every rainbow color had vanished from the world of "+theme+".",
 name+" set off with a cheerful fox. An extraordinary path stretched before them.",
 "The friends met a kind dragon who showed them the way to an enchanted tree.",
 "Our hero remembered a special dream: "+prompt.trim().replace(/[.!?]+$/,"")+".",
 "Together, they discovered a tiny key among glowing flowers.",
 name+" turned the key, and the world filled with colors, songs, and smiles again.",
 "Back at home, the hero knew that courage and kindness can make any day magical."
 ]})
};
export const createDemoBook=(name:string,age:number,theme:string,style:string,prompt:string,language:Lang="ru",classicId?:ClassicId,saveOnDevice=false):DemoBook=>{
 const classic=classics.find(x=>x.id===classicId);
 const story=classic?makeClassicStory(classic.id,name,language):demoStories[language](name,theme,prompt);
 const art=classic?"/images/classics/"+classic.id+(["red-hood","cinderella","three-pigs","snow-white","ugly-duckling","bremen"].includes(classic.id)?".svg":".webp"):null;
 const book:DemoBook={id:"local-"+crypto.randomUUID(),created_at:new Date().toISOString(),name,age,theme,style,prompt,title:story.title,language,classicId,savedOnDevice:saveOnDevice,mode:"browser-demo",pages:story.pages.map((text,index)=>({number:index+1,text,image_url:art||illustration(index)}))};
 saveDemoBooks([book,...getDemoBooks()]);
 return book;
};

type Story={title:string;pages:string[]};
const classicBeats:Record<ClassicId,Record<Lang,[string,string,string,string]>>={
 "red-hood":{
 ru:["встретил Красную Шапочку на лесной тропинке","понёс вместе с ней пирожки бабушке","помог не поверить хитрым словам волка","встретил бабушку и устроил семейное чаепитие"],
 uz:["örmon yölida Qizil qalpoqçani uçratdi","u bilan buvisiga şirinlik olib bordi","ayyor börining gaplariga aldanmadi","buvijon bilan quvonçli çoy içdi"],
 en:["met Little Red Riding Hood on a forest path","helped carry treats to Grandma","noticed the wolf's misleading directions","enjoyed a happy tea party with Grandma"]},
 "cinderella":{
 ru:["познакомился с доброй Золушкой","помог украсить её платье звёздочками","увидел великолепный дворец и танцевальный зал","нашёл потерянную туфельку и вернул её подруге"],
 uz:["mehribon Zoluşka bilan tanişdi","uning köylagini yulduzçalar bilan bezadi","ajoyib saroy va raqs zalini kördi","yöqolgan tufliçani topib döstiga qaytardi"],
 en:["met kind Cinderella","helped decorate her dress with stars","visited the beautiful palace ballroom","found the lost slipper and returned it to a friend"]},
 "three-pigs":{
 ru:["подружился с тремя поросятами","вместе с ними собирал кирпичи и строил уютный дом","придумал умный способ защитить домик от сильного ветра","пригласил волка поговорить по-доброму"],
 uz:["uçta çöçqaça bilan döstlaşdi","ular bilan ğişt yiğib qulay uy qurdi","uyni kuçli şamoldan asraş usulini topdi","börini döstona suhbatga taklif qildi"],
 en:["befriended three little pigs","collected bricks and built a cozy house together","found a clever way to make it strong against wind","invited the wolf to talk peacefully"]},
 "snow-white":{
 ru:["встретил Белоснежку в лесу","помог семерым друзьям навести порядок в домике","собрал корзинку вкусных лесных ягод","устроил праздник дружбы с Белоснежкой"],
 uz:["örmonda Oppoğoyni uçratdi","yetti döstga uyni yiğiştirişda yordam berdi","örmon mevalaridan savat töldirdi","Oppoğoy bilan döstlik bayramini uyuştirdi"],
 en:["met Snow White in the forest","helped seven friends tidy their cozy cottage","collected a basket of delicious berries","celebrated friendship with Snow White"]},
 "ugly-duckling":{
 ru:["увидел грустного утёнка у пруда","помог ему познакомиться с другими птицами","напомнил ему, что каждый по-своему прекрасен","увидел, как утёнок вырос в прекрасного лебедя"],
 uz:["köl yonida xafa ördakçani kördi","unga boşqa quşlar bilan döstlaşişda yordam berdi","har kim öziga xos gözal ekanini eslatdi","ördakça çiroyli oqquşga aylanganini kördi"],
 en:["met a sad duckling by a pond","helped it make friends with other birds","reminded it that everyone is beautiful in their own way","watched the duckling grow into a graceful swan"]},
 "bremen":{
 ru:["встретил осла, собаку, кота и петуха","помог друзьям придумать весёлую песню","собрал музыкальные инструменты для концерта","выступил с друзьями перед благодарными слушателями"],
 uz:["eşak, it, muşuk va xörozni uçratdi","döstlarga quvnoq qöşiq öylab topişda yordam berdi","konsert uçun musiqa asboblarini tayyorladi","döstlari bilan tomoşabinlar oldida kuyladi"],
 en:["met a donkey, dog, cat, and rooster","helped the friends compose a joyful song","gathered musical instruments for a concert","performed with friends for a delighted audience"]}
};
// Longer original prose for the interactive preview; still a DEMO, not a complete literary edition.
const sceneDetail:Record<Lang,string[]>={
 ru:[
 "На обложке сияли золотые звёзды, а в воздухе пахло свежими цветами. Казалось, что чудо вот-вот произойдёт.",
 "Вокруг шелестели деревья, и кто-то приветливо махнул рукой. Герой огляделся и понял, что ему здесь рады.",
 "Вместо спешки друзья остановились, познакомились и договорились помогать друг другу. Теперь они были настоящей командой.",
 "Даже маленькое доброе дело оказалось важным. Каждый помог так, как умел, и путь стал намного легче.",
 "Сначала задача казалась сложной, но никто не потерял надежду. Они прислушались друг к другу и нашли новую идею.",
 "Друзья вместе улыбнулись: у каждой загадки есть решение, если действовать честно и спокойно. От этого приключение стало ещё интереснее.",
 "На празднике звучали смех и добрые слова. Все поняли, что самое ценное в этой истории — дружба.",
 "Перед сном герой вспомнил самые яркие моменты путешествия. Волшебная история навсегда осталась в его сердце."
 ],
 uz:[
 "Kitob muqovasida oltin yulduzlar porlardi, havodan gullarning xuşböy isi kelardi. Göyo möjiza boşlanayotgandek edi.",
 "Atrofdagi daraxtlar ohista şivirlardi, kimdir esa quvonib qöl silkitdi. Qahramon bu olamda uni kutişganini sezdi.",
 "Döstlar şoşilmadi, bir-biri bilan tanişib, hamkorlik qilişga kelişib olişdi. Ular endi haqiqiy jamoa edi.",
 "Hatto kiçkina yaxşilik ham muhim bölib çiqdi. Har kim qölidan kelgança yordam berdi.",
 "Avvaliga vazifa qiyin tuyuldi, ammo heç kim umidini yöqotmadi. Ular bir-birini tinglab, yangi fikr topişdi.",
 "Döstlar birgalikda kulişdi: halollik va sabr bilan har qanday jumboq yeçilişi mumkin. Sarguzaşt yanada qiziqarli böldi.",
 "Bayramda kulgu va samimiy sözlar yangradi. Hamma bu hikoyaning eng katta boyligi döstlik ekanini tuşundi.",
 "Uyqu oldidan qahramon sarguzaştning eng gözal damlarini esladi. Sehrli ertak uning qalbida abadiy qoldi."
 ],
 en:[
 "Golden stars shimmered on the book cover, and the air smelled of flowers. Something wonderful was about to begin.",
 "The trees rustled softly, and a friendly stranger waved hello. Our hero could already tell this world was welcoming.",
 "Instead of rushing, the friends introduced themselves and promised to help one another. They had become a wonderful team.",
 "Even a small act of kindness made a difference. Everyone offered what they could, and the journey felt easier.",
 "The task seemed difficult at first, but no one lost hope. They listened to one another and came up with a new idea.",
 "The friends smiled together: every puzzle can be solved with honesty and patience. The adventure grew more exciting.",
 "Warm laughter and kind words filled the celebration. Everyone knew friendship was the most precious treasure of all.",
 "Before bed, our hero remembered the brightest moments of the journey. The magical story stayed in their heart forever."
 ]
};
const enrich=(story:Story,lang:Lang):Story=>({...story,pages:story.pages.map((text,i)=>text+" "+sceneDetail[lang][i])});
function makeClassicStory(id:ClassicId,name:string,language:Lang):Story{
 const classic=classics.find(c=>c.id===id);
 if(!classic)throw Error("Unknown classic");
 const beats=classicBeats[id]?.[language] ?? (
   language==="ru"
    ? ["попал в историю «"+classic.title.ru+"»","оказался в приключении: "+classic.summary.ru.toLowerCase(),"помог сказочным друзьям решить загадку","вместе с друзьями отпраздновал счастливое завершение"]
    : language==="uz"
    ? ["«"+classic.title.uz+"» ertagiga tushib qoldi","sarguzashtni boshladi: "+classic.summary.uz.toLowerCase(),"ertakdagi do‘stlariga jumboqni yechishda yordam berdi","do‘stlari bilan quvonchli yakunni nishonladi"]
    : ["entered the story of "+classic.title.en,"began an adventure: "+classic.summary.en.toLowerCase(),"helped the fairy tale friends solve a puzzle","celebrated the happy ending with new friends"]
 );
 const title=classic.title[language];
 if(language==="ru") return enrich({title:name+" и сказка «"+title+"»",pages:[
 "Однажды "+name+" открыл волшебную книгу. На её страницах сияла знакомая сказка «"+title+"».",
 "Книга тихонько зашептала, и "+name+" оказался прямо внутри этой истории.",
 name+" "+beats[0]+".",
 "Впереди ждало важное дело: "+name+" "+beats[1]+".",
 "На пути возникла небольшая трудность, но друзья решили не сдаваться.",
 name+" "+beats[2]+". Доброта и смекалка помогли всем.",
 "В конце приключения "+name+" "+beats[3]+".",
 "Волшебная книга закрылась. "+name+" понял, что помогать друзьям можно в любой сказке."
 ]} , "ru");
 if(language==="uz") return enrich({title:name+" va «"+title+"» ertagi",pages:[
 "Bir kuni "+name+" sehrli kitobni ochdi. Uning sahifalarida «"+title+"» ertagi porlab turardi.",
 "Kitob ohista shivirlagach, "+name+" ertak olamiga tushib qoldi.",
 name+" "+beats[0]+".",
 "Oldinda muhim vazifa bor edi: "+name+" "+beats[1]+".",
 "Yo‘lda kichkina qiyinchilik tug‘ildi, ammo do‘stlar taslim bo‘lishmadi.",
 name+" "+beats[2]+". Mehr va aql yordam berdi.",
 "Sarguzasht oxirida "+name+" "+beats[3]+".",
 "Sehrli kitob yopildi. "+name+" do‘stlarga yordam berish eng katta mo‘jiza ekanini tushundi."
 ]} , "uz");
 return enrich({title:name+" in "+title,pages:[
 "One day, "+name+" opened a magical book. Its pages glowed with the story of "+title+".",
 "The book whispered softly, and "+name+" stepped inside the fairy tale.",
 name+" "+beats[0]+".",
 "A special task awaited: "+name+" "+beats[1]+".",
 "A little challenge appeared, but the friends did not give up.",
 name+" "+beats[2]+". Kindness and clever thinking helped everyone.",
 "At the end of the adventure, "+name+" "+beats[3]+".",
 "The magical book closed, and "+name+" learned that helping friends is a wonderful kind of magic."
 ]} , "en");
}


/** Creates a new local template sequel to the current demo story (no network requests). */
export const createDemoSequel=(previous:DemoBook):DemoBook=>{
 const lang:Lang=previous.language||"ru";
 const hero=previous.name;
 const lines:Record<Lang,{suffix:string;pages:string[]}>={
   ru:{suffix:" — новое приключение",pages:[
    "На следующее утро "+hero+" проснулся с ощущением, что волшебная история ещё не закончилась. У окна тихо звенел серебряный колокольчик.",
    "На подоконнике лежало письмо от старых друзей. Они приглашали "+hero+" в долину, где каждую ночь загораются необычные фонарики.",
    "Герой собрал маленькую сумку и отправился по знакомой тропинке. На развилке его встретил говорящий лисёнок и предложил идти вместе.",
    "В долине друзья обнаружили мост из разноцветных камней. Каждый камень загорался только после доброго слова.",
    hero+" вспомнил прошлое приключение и предложил всем по очереди рассказать, за что они благодарны друг другу. Мост засветился ярче луны.",
    "На другом берегу стоял сад со звёздными деревьями. Один росток нуждался в заботе и немного воды, поэтому друзья принялись за дело.",
    "В благодарность сад подарил каждому сияющее семечко. Друзья договорились посадить их дома и заботиться о маленьких чудесах.",
    "Вернувшись домой, "+hero+" улыбнулся: волшебство живёт не только в сказочных замках, но и в простых добрых поступках. А значит, впереди ещё много историй."
   ]},
   uz:{suffix:" — yangi sarguzaşt",pages:[
    "Ertasi kuni "+hero+" uyğonib, sehrli hikoya hali tugamaganini sezdi. Deraza yonida kumuş qönğiroqça ohista jaranglardi.",
    "Deraza tokçasida eski döstlardan maktub bor edi. Ular "+hero+"ni har keça ajib çiroqlar yonadigan vodiyga taklif qilişgan edi.",
    "Qahramon kiçik sumkasini olib, taniş yöldan ketdi. Yöl ayrilişida gapiradigan tulkiça uni kutib turardi.",
    "Vodiyda döstlar rangli toşlardan qurilgan köprikni topişdi. Har bir toş faqat yaxşi söz eşitganda yorişardi.",
    hero+" oldingi sarguzaştni eslab, döstlardan bir-birlariga minnatdorlik bildirişni söradi. Köprik oy nuridan ham yorqin porladi.",
    "Narigi qirğoqda yulduzli daraxtlar ösadigan bog‘ bor edi. Bir niholga ğamxörlik va ozgina suv kerak edi.",
    "Bog‘ minnatdorlik belgisi sifatida hammaga nurli urug‘ sovğa qildi. Döstlar ularni uyda ekişga kelişişdi.",
    "Uyiga qaytgan "+hero+" jilmaydi: möjiza faqat qasrlarda emas, oddiy yaxşiliklarda ham yaşaydi. Demak, oldinda yana köp ertaklar bor."
   ]},
   en:{suffix:" — a New Adventure",pages:[
    "The next morning, "+hero+" woke up feeling that the magical story was not quite finished. A silver bell chimed softly by the window.",
    "A letter from old friends lay on the windowsill. They invited "+hero+" to a valley where unusual lanterns lit up every night.",
    "The hero packed a small bag and walked along the familiar path. A talking fox greeted them at the crossroads and offered to come along.",
    "In the valley, the friends found a bridge made of colorful stones. Each stone lit up whenever someone spoke a kind word.",
    hero+" remembered their last adventure and suggested sharing things they appreciated about each other. The bridge glowed brighter than moonlight.",
    "On the other side lay a garden of starry trees. One little seedling needed some water and care, so the friends got to work.",
    "To thank them, the garden gave each friend a glowing seed. They promised to plant the seeds at home and care for small wonders.",
    "Back at home, "+hero+" smiled. Magic did not live only in fairy-tale castles; it lived in everyday acts of kindness, too. Many adventures still awaited."
   ]}
 };
 const story=lines[lang];
 const art=previous.classicId?previous.pages[0]?.image_url:null;
 const sequel:DemoBook={
    id:"local-"+crypto.randomUUID(),
    created_at:new Date().toISOString(),
    name:previous.name,age:previous.age,theme:previous.theme,style:previous.style,
    prompt:previous.prompt,title:previous.title+story.suffix,language:lang,
    classicId:previous.classicId,mode:"browser-demo",savedOnDevice:Boolean(previous.savedOnDevice),
    pages:story.pages.map((text,index)=>({number:index+1,text,image_url:art||illustration(index+1)}))
 };
 saveDemoBooks([sequel,...getDemoBooks()]);
 return sequel;
};
