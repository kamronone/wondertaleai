// Browser-only preview fallback. Photos never leave the browser in this mode.
import type { Lang } from "./i18n";
import { classics, type ClassicId } from "./classics";
import { fitSequelTitle } from "./sequel_title";
import {classicReaderImage} from "./classic_page_art";
import {fullClassicChapters} from "./classic_full_plots";
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
const hasDuplicateLocalIds=(ids:readonly string[]):boolean=>new Set(ids).size!==ids.length;
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
export const getLocalLibraryHealth=():"ok"|"corrupt"|"unavailable"=>{
 try{
   const allIds:string[]=[];
   for(const [storage,key] of [[localStorage,deviceKey],[sessionStorage,sessionKey]] as const){
     const raw=storage.getItem(key);
     if(raw===null)continue;
     let parsed:unknown;
     try{parsed=JSON.parse(raw);}catch{return "corrupt";}
     if(!Array.isArray(parsed)||parsed.length>20||parsed.some(book=>!isValidLocalBook(book)))return "corrupt";
     allIds.push(...parsed.map((book:DemoBook)=>book.id));
   }
   if(hasDuplicateLocalIds(allIds))return "corrupt";
   return "ok";
 }catch{
   // SecurityError can occur when private browsing disables browser storage.
   return "unavailable";
 }
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
 // Duplicate ids across either storage cause silent deduplication in getDemoBooks.
 // Reject such writes before touching either store.
 if(books.some(book=>!isValidLocalBook(book))||
    hasDuplicateLocalIds(books.map(book=>book.id))){
   throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
 }
 // Names and stories stay in this browser; photos are never saved or uploaded in demo.
 // A browser storage exception can occur halfway through the two writes.
 // Keep the previous values and report failure instead of silently losing books.
 let oldDevice:string|null;
 let oldSession:string|null;
 try{
   oldDevice=localStorage.getItem(deviceKey);
   oldSession=sessionStorage.getItem(sessionKey);
   // A damaged JSON record must never be silently replaced by an incomplete
   // getDemoBooks() result. Leave both stores untouched for recovery.
   const existingIds:string[]=[];
   for(const previous of [oldDevice,oldSession]){
     if(previous===null)continue;
     let decoded:unknown;
     try{decoded=JSON.parse(previous);}
     catch{throw new Error("LOCAL_LIBRARY_SAVE_FAILED");}
     // Reading filters invalid entries and caps each storage at 20 books.
     // Reject writes rather than silently discarding books omitted on read.
     if(!Array.isArray(decoded)||decoded.length>20||
        decoded.some(entry=>!isValidLocalBook(entry)))throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
     existingIds.push(...decoded.map((book:DemoBook)=>book.id));
   }
   if(hasDuplicateLocalIds(existingIds))throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
 }catch{
   throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
 }
 let deviceWriteAttempted=false;
 let sessionWriteAttempted=false;
 try{
   // A page turn often changes only one storage area. Avoid rewriting the
   // other one: Safari can reject even redundant writes when storage is full.
   const nextDevice=chosen.length?JSON.stringify(chosen):null;
   const nextSession=ephemeral.length?JSON.stringify(ephemeral):null;
   // Loaded books gain safe default metadata and may be sorted differently.
   // Compare normalized records by ID so old Safari saves do not cause a
   // redundant write merely because those defaults were absent in JSON.
   const comparable=(items:DemoBook[])=>JSON.stringify(
     [...items].sort((a,b)=>a.id.localeCompare(b.id))
   );
   const deviceUnchanged=oldDevice===null?nextDevice===null:
     comparable(readBooks(()=>localStorage,deviceKey,true))===comparable(chosen);
   const sessionUnchanged=oldSession===null?nextSession===null:
     comparable(readBooks(()=>sessionStorage,sessionKey,false))===comparable(ephemeral);
   if(!deviceUnchanged){
     // Mark before calling storage: a browser may partially change data and
     // then throw (including browser extensions or wrapped storage APIs).
     deviceWriteAttempted=true;
     if(nextDevice===null)localStorage.removeItem(deviceKey);
     else localStorage.setItem(deviceKey,nextDevice);
     // Some embedded/private browser storage implementations can silently
     // reject writes. Never tell the reader a book was saved without readback.
     if(localStorage.getItem(deviceKey)!==nextDevice)throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
   }
   if(!sessionUnchanged){
     sessionWriteAttempted=true;
     if(nextSession===null)sessionStorage.removeItem(sessionKey);
     else sessionStorage.setItem(sessionKey,nextSession);
     if(sessionStorage.getItem(sessionKey)!==nextSession)throw new Error("LOCAL_LIBRARY_SAVE_FAILED");
   }
 }catch{
   // Roll back only stores that were touched. An unchanged Safari storage
   // area may itself be full and must not receive a redundant restore write.
   if(deviceWriteAttempted){
     try{
       if(oldDevice===null)localStorage.removeItem(deviceKey);
       else localStorage.setItem(deviceKey,oldDevice);
     }catch{/* Restore may also fail if storage is unavailable. */}
   }
   if(sessionWriteAttempted){
     try{
       if(oldSession===null)sessionStorage.removeItem(sessionKey);
       else sessionStorage.setItem(sessionKey,oldSession);
     }catch{/* Never claim the write succeeded after a storage failure. */}
   }
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
 const book:DemoBook={id:"local-"+crypto.randomUUID(),created_at:new Date().toISOString(),name,age,theme,style,prompt,title:story.title,language,classicId,savedOnDevice:saveOnDevice,mode:"browser-demo",pages:story.pages.map((text,index)=>({number:index+1,text,image_url:classicId?classicReaderImage(classicId,art||"",index,text):illustration(index)}))};
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
const redHoodStory=(name:string,language:Lang):Story=>{
 const pages:Record<Lang,string[]>={
  ru:[
   "Мама Красной Шапочки собрала корзинку с пирожками и вареньем для бабушки. "+name+" помог завязать красную ленту на ручке корзины и пообещал не сходить с тропинки.",
   "Красная Шапочка и "+name+" отправились через солнечный лес. По обе стороны дорожки распускались цветы, а над ручьём кружили бабочки. Друзья шли вместе и любовались природой.",
   "На развилке появился хитрый волк. Он вежливо спросил, куда направляются друзья, но "+name+" заметил его подозрительную улыбку. Красная Шапочка решила быть осторожнее.",
   "Волк первым добрался до бабушкиного домика и спрятался под одеялом, надев её чепчик и круглые очки. Он надеялся обмануть гостей, но совсем не походил на настоящую бабушку.",
   "Красная Шапочка вошла в спальню и удивилась большим ушам и глазам «бабушки». "+name+" вспомнил их встречу на тропинке и тихонько предложил позвать на помощь.",
   "Добрый лесник услышал голоса возле домика и пришёл на помощь. Волк понял, что его хитрость раскрыта, и убежал в лес. Никто не пострадал.",
   "Настоящая бабушка крепко обняла Красную Шапочку и поблагодарила "+name+" за внимательность. Лесник улыбнулся, а корзинка с угощением наконец оказалась на столе.",
   "Вечером друзья пили чай, слушали бабушкины истории и радовались счастливому дню. "+name+" запомнил важное правило: в дороге нужно быть внимательным и просить помощи, если что-то кажется странным."
  ],
  uz:[
   "Qizil qalpoqchaning onasi buvisiga non va murabbo solingan savat tayyorladi. "+name+" savatga qizil tasma bog‘lashga yordam berdi va yo‘ldan chetga chiqmaslikka so‘z berdi.",
   "Qizil qalpoqcha va "+name+" quyoshli o‘rmon bo‘ylab yo‘lga tushdi. So‘qmoq chetida gullar ochilgan, soy ustida kapalaklar uchardi. Do‘stlar birga sayr qilishdi.",
   "Yo‘l ayrilishida ayyor bo‘ri paydo bo‘ldi. U muloyim gapirsa-da, "+name+" uning shubhali tabassumini payqadi. Qizil qalpoqcha ehtiyotkor bo‘lishga qaror qildi.",
   "Bo‘ri buvisining uyiga oldin yetib borib, ko‘rpaga burkandi. U buvining qalpog‘i va ko‘zoynagini taqib, mehmonlarni aldamoqchi bo‘ldi.",
   "Qizil qalpoqcha xonaga kirib, «buvijon»ning katta quloqlari va ko‘zlariga hayron qoldi. "+name+" o‘rmonda uchratgan bo‘rini eslab, yordam chaqirishni maslahat berdi.",
   "Mehribon o‘rmonchi uydan eshitilgan ovozlarni payqab, yordamga keldi. Bo‘rining hiylasi fosh bo‘ldi va u o‘rmonga qochdi. Hech kim zarar ko‘rmadi.",
   "Haqiqiy buvijon Qizil qalpoqchani quchoqlab, "+name+"ga hushyorligi uchun rahmat aytdi. O‘rmonchi kulib qo‘ydi, sovg‘alar esa dasturxonga qo‘yildi.",
   "Kechqurun do‘stlar birga choy ichib, buvijonning hikoyalarini tinglashdi. "+name+" muhim saboq oldi: yo‘lda ehtiyotkor bo‘lish va kerak bo‘lsa, yordam so‘rash lozim."
  ],
  en:[
   "Little Red Riding Hood's mother packed bread and jam for Grandma. "+name+" helped tie a ribbon onto the basket and promised to stay on the path.",
   "Little Red Riding Hood and "+name+" walked along a sunny forest trail. Flowers bloomed on both sides, and butterflies danced above a stream as the friends explored together.",
   "A sly wolf appeared beside the path and asked where they were going. "+name+" noticed his suspicious smile, so Little Red Riding Hood decided to be extra careful.",
   "The wolf reached Grandma's cottage first. Wearing her nightcap and spectacles, he hid beneath the quilt and hoped to fool the visitors.",
   "Little Red Riding Hood entered the bedroom and wondered why 'Grandma' had such large ears and eyes. "+name+" remembered the wolf and suggested calling for help.",
   "A kind woodsman heard the voices and came to help. The wolf's trick was discovered, and he ran away into the forest. Everyone was safe.",
   "Grandma hugged Little Red Riding Hood and thanked "+name+" for paying attention. The woodsman smiled while the treats were placed on the table.",
   "That evening, everyone enjoyed tea and Grandma's stories. "+name+" remembered to stay alert while traveling and to ask for help whenever something feels wrong."
  ]
 };
 const title={ru:name+" и «Красная Шапочка»",uz:name+" va «Qizil qalpoqcha» ertagi",en:name+" and Little Red Riding Hood"}[language];
 return {title,pages:pages[language]};
};
function threePigsStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `Три весёлых поросёнка решили построить собственные домики. ${name} встретил их на цветочной полянке и предложил помочь. Первый поросёнок выбрал солому, второй принёс доски, а третий приготовил крепкие кирпичи.`,
   `Первый поросёнок быстро собрал соломенную крышу и стены. Домик получился лёгким и уютным, но ${name} заметил, что сильный ветер может унести солому. Поросёнок обещал подумать, как сделать его прочнее.`,
   `Второй поросёнок соорудил деревянный домик из досок. ${name} помог ему закрепить дверь и окно. Домик выглядел красиво, однако доски ещё немного шатались, когда ветер качал деревья.`,
   `Третий поросёнок терпеливо укладывал кирпич за кирпичом. ${name} подавал раствор и помогал проверять стены. К вечеру у них получился прочный красный дом с тёплым очагом и крепкой дверью.`,
   `У опушки появился волк. Он очень громко дунул на соломенный домик, и солома разлетелась по поляне. Первый поросёнок не пострадал и поспешил к брату. ${name} побежал рядом, помогая ему не заблудиться.`,
   `Волк добрался до деревянного домика и снова дунул изо всех сил. Доски не выдержали, но поросята успели выйти и вместе с ${name} побежали к кирпичному дому, где их уже ждал третий брат.`,
   `Все спрятались в крепком кирпичном доме. Волк дул и дул, но стены даже не дрогнули. ${name} предложил спокойно поговорить с гостем через окно. Волк понял, что пугать соседей было плохой идеей, и извинился.`,
   `На следующий день друзья вместе починили домики и устроили чаепитие в саду. Поросята поблагодарили ${name} за помощь. Они поняли, что терпение, надёжная работа и дружба делают любой дом по-настоящему уютным.`
  ],
  uz:[
   `Uchta quvnoq cho'chqacha o'zlariga uy qurishga qaror qildi. ${name} ularni gullarga to'la yaylovda uchratib, yordam berishni taklif qildi. Birinchisi somon, ikkinchisi taxta, uchinchisi esa mustahkam g'isht tanladi.`,
   `Birinchi cho'chqacha tezda somondan kichik uy qurdi. Uychasi chiroyli edi, ammo ${name} kuchli shamol somonni uchirib ketishi mumkinligini payqadi. Cho'chqacha uyini yanada mustahkamlashga va'da berdi.`,
   `Ikkinchi cho'chqacha taxtalardan uy yasadi. ${name} unga eshik va derazalarni o'rnatishda yordam berdi. Uy bejirim chiqdi, biroq shamol esganda ayrim taxtalar qimirlardi.`,
   `Uchinchi cho'chqacha g'ishtlarni birma-bir terdi. ${name} unga qorishma uzatdi va devorlarning tekisligini tekshirdi. Kechgacha mustahkam tomli, issiq o'choqli qizil g'isht uy tayyor bo'ldi.`,
   `O'rmon chetida bo'ri paydo bo'ldi. U somon uychaga qattiq pufladi va somonlar havoga uchdi. Birinchi cho'chqacha sog'-salomat qochib chiqdi. ${name} unga ikkinchi ukasining uyiga yetib olishga yordam berdi.`,
   `Bo'ri taxta uyga ham kuchli pufladi. Taxtalar qulab tushdi, lekin do'stlar vaqtida tashqariga chiqishdi. ${name} va ikki cho'chqacha uchinchi akaning g'isht uyiga shoshilishdi.`,
   `Hamma g'isht uyda xavfsiz edi. Bo'ri qancha puflamasin, devorlar qimirlamadi. ${name} unga derazadan xotirjam gapirishni taklif qildi. Bo'ri boshqalarni qo'rqitgani uchun uzr so'radi.`,
   `Ertasi kuni do'stlar uylarni birga ta'mirlab, bog'da choy ichishdi. Cho'chqachalar ${name}ga rahmat aytishdi. Hamma sabr, puxta mehnat va do'stlikning qadrini bildi.`
  ],
  en:[
   `Three cheerful little pigs decided to build houses of their own. ${name} met them in a flower-filled meadow and offered to help. The first pig chose straw, the second collected wood, and the third brought sturdy bricks.`,
   `The first pig built a straw house in no time. It looked cozy, but ${name} noticed that a strong breeze could carry away the roof. The pig promised to make it safer later.`,
   `The second pig made a little wooden cottage. ${name} helped fit the door and windows. It was lovely, though some boards still rattled when the wind shook the trees.`,
   `The third pig patiently laid one brick after another. ${name} helped carry mortar and check the walls. By evening they had built a strong red house with a warm hearth and a sturdy door.`,
   `A wolf appeared at the edge of the forest. He blew hard at the straw cottage, scattering the straw across the meadow. The first pig escaped unharmed, and ${name} helped him hurry to his brother's house.`,
   `The wolf blew again at the wooden cottage. The boards came loose, but the friends got outside safely. With ${name} leading the way, both pigs ran to their brother's brick house.`,
   `Everyone was safe inside the brick house. The wolf huffed and puffed, but the walls would not budge. ${name} suggested talking calmly through the window. The wolf realized he had frightened his neighbors and apologized.`,
   `The next morning everyone repaired the cottages and shared tea in the garden. The pigs thanked ${name} for helping. They learned that patience, careful work, and friendship make a house a home.`
  ]
 };
 const title=({ru:`Три поросёнка и ${name}`,uz:`${name} va Uch cho'chqacha`,en:`${name} and the Three Little Pigs`} as const)[language];
 return {title,pages:pages[language]};
}

function cinderellaStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `Золушка жила в уютном домике, но каждый день ей приходилось много работать. Однажды ${name} заглянул к ней в гости и помог подмести пол. Три маленьких мышонка весело носили ленточки и тряпочки.`,
   `Мачеха и сёстры собирались на королевский бал. Золушка тоже мечтала увидеть дворец. ${name} помог ей закончить домашние дела, а мышата сложили чистое бельё в корзинку.`,
   `Когда стемнело, в саду появилась добрая фея. Она взмахнула волшебной палочкой, и большая тыква засверкала золотыми искрами. ${name} с удивлением наблюдал, как начинается чудо.`,
   `Тыква превратилась в карету, а простое платье Золушки стало сияющим голубым нарядом. Фея подарила ей хрустальные туфельки и напомнила, что волшебство закончится ровно в полночь.`,
   `Золушка приехала во дворец. В зале играла музыка, сверкали люстры, а гости танцевали. Принц пригласил Золушку на танец. ${name} радовался вместе с ними этому прекрасному вечеру.`,
   `Во время праздника Золушка и принц вышли на балкон. Они разговаривали о доброте, мечтах и дружбе. ${name} услышал, как часы начали отбивать полночь, и поспешил предупредить Золушку.`,
   `Золушка побежала вниз по широкой дворцовой лестнице. Одна хрустальная туфелька соскользнула со ступеньки, но останавливаться было некогда. ${name} помог ей найти дорогу к карете.`,
   `На следующий день принц нашёл Золушку по хрустальной туфельке. Все радостно улыбались. ${name} был счастлив, что искренность и доброе сердце помогли друзьям найти друг друга.`
  ],
  uz:[
   `Zolushka kichik uyda yashardi va har kuni ko'p ish qilardi. Bir kuni ${name} uning yoniga kelib, polni supurishga yordam berdi. Uchta kichik sichqoncha esa tasma va matolarni tashirdi.`,
   `O'gay ona va opalar qirollik bazmiga tayyorlanishdi. Zolushka ham saroyni ko'rishni orzu qilardi. ${name} unga uy ishlarini tugatishda yordam berdi, sichqonchalar kiyimlarni yig'ishtirishdi.`,
   `Kech tushganda bog'da mehribon pari paydo bo'ldi. U sehrli tayoqchasini silkitdi va katta qovoq oltin uchqunlar bilan porladi. ${name} bu mo'jizani hayrat bilan kuzatdi.`,
   `Qovoq aravaga, oddiy ko'ylak esa yarqiragan havorang libosga aylandi. Pari Zolushkaga billur tuflichalar berdi va sehr yarim tunda tugashini eslatdi.`,
   `Zolushka saroyga yetib keldi. Zalda musiqa yangrar, qandillar porlar, mehmonlar raqs tushardi. Shahzoda Zolushkani raqsga taklif qildi. ${name} ular bilan birga quvondi.`,
   `Bazm davomida Zolushka va shahzoda ayvonda suhbatlashishdi. Ular mehr, orzular va do'stlik haqida gapirishdi. ${name} soat yarim tunni urayotganini eshitib, Zolushkani ogohlantirdi.`,
   `Zolushka saroy zinapoyasidan shoshilib tushdi. Uning bir billur tuflichasi zinada qolib ketdi. ${name} unga aravaga boradigan yo'lni topishda yordam berdi.`,
   `Ertasi kuni shahzoda billur tuflicha yordamida Zolushkani topdi. Hamma xursand bo'ldi. ${name} yaxshilik va samimiyat do'stlarni birlashtirganidan quvondi.`
  ],
  en:[
   `Cinderella lived in a cozy cottage, but she had many chores each day. One morning ${name} visited and helped sweep the floor. Three little mice carried ribbons and cloths to make the work more cheerful.`,
   `Her stepmother and stepsisters prepared for the royal ball. Cinderella dreamed of seeing the palace too. ${name} helped her finish the chores while the mice folded the clean linen.`,
   `At dusk a kind fairy godmother appeared in the garden. She waved her wand and a big pumpkin began to sparkle. ${name} watched in amazement as the magic began.`,
   `The pumpkin became a carriage, and Cinderella's simple dress turned into a shimmering blue gown. The fairy gave her glass slippers and reminded her that the magic would end at midnight.`,
   `Cinderella arrived at the palace. Music filled the ballroom, chandeliers sparkled, and guests danced. The prince invited Cinderella to dance, and ${name} was delighted to see her so happy.`,
   `Later Cinderella and the prince talked on a balcony about kindness and dreams. ${name} heard the clock begin to strike midnight and hurried to warn Cinderella.`,
   `Cinderella rushed down the grand staircase. One glass slipper slipped off onto a step, but she had to keep going. ${name} helped her find the way to the carriage.`,
   `The next day the prince found Cinderella with the help of the glass slipper. Everyone smiled. ${name} was glad that kindness and honesty had brought the friends together.`
  ]
 };
 const title=({ru:`Золушка и ${name}`,uz:`${name} va Zolushka`,en:`${name} and Cinderella`} as const)[language];
 return {title,pages:pages[language]};
}
function snowWhiteStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `В красивом королевстве жила добрая Белоснежка. ${name} познакомился с ней в дворцовом саду. Они вместе ухаживали за цветами и угощали птиц зёрнышками.`,
   `Королева часто смотрела в волшебное зеркало и беспокоилась о своей красоте. Белоснежка и ${name} решили не спорить о внешности, а отправиться на прогулку и делать добрые дела.`,
   `Друзья вошли в зелёный лес. Птицы показали им удобную тропинку, и вскоре среди деревьев показался небольшой уютный домик с семью окнами.`,
   `В домике жили семь дружелюбных маленьких мастеров. ${name} помог им познакомиться с Белоснежкой. Новые друзья предложили гостям отдохнуть после долгой дороги.`,
   `Белоснежка и ${name} вместе с семью друзьями прибрали дом и приготовили вкусный ужин. Вечером все слушали истории и делились мечтами.`,
   `Однажды у лесной тропинки появилась незнакомка с красивым красным яблоком. ${name} вспомнил, что подарки незнакомцев нужно принимать осторожно, и попросил Белоснежку сначала посоветоваться с друзьями.`,
   `Друзья вернулись домой и обнаружили, что Белоснежка устала и уснула после долгого дня. Все заботливо укрыли её и позвали доброго лекаря. Скоро она проснулась и улыбнулась.`,
   `На следующий день у лесного домика устроили праздник дружбы. Белоснежка поблагодарила ${name} и семерых друзей за заботу. Теперь они знали: доброта и взаимная помощь важнее любого волшебного зеркала.`
  ],
  uz:[
   `Go'zal qirollikda mehribon Oppog'oy yashardi. ${name} u bilan saroy bog'ida tanishdi. Ular birga gullarni parvarishlab, qushlarga don berishdi.`,
   `Qirolicha sehrli oynaga tez-tez qarab, o'z go'zalligi haqida tashvishlanardi. Oppog'oy va ${name} esa yaxshilik qilish va sayrga chiqishni afzal ko'rishdi.`,
   `Do'stlar yashil o'rmonga kirishdi. Qushlar ularga so'qmoqni ko'rsatdi. Ko'p o'tmay daraxtlar orasida yettita derazali kichik, shinam uy ko'rindi.`,
   `Uyda yetti nafar do'stona hunarmand yashardi. ${name} ularni Oppog'oy bilan tanishtirdi. Yangi do'stlar mehmonlarga dam olishni taklif qilishdi.`,
   `Oppog'oy, ${name} va yetti do'st uyni yig'ishtirib, mazali kechki ovqat tayyorlashdi. Kechqurun hamma hikoyalar aytib, orzularini bo'lishdi.`,
   `Bir kuni o'rmon yo'lida qizil olmali notanish ayol paydo bo'ldi. ${name} notanishlardan sovg'a olishda ehtiyot bo'lish kerakligini eslab, Oppog'oyga avval do'stlaridan maslahat so'rashni aytdi.`,
   `Do'stlar uyga qaytishganida Oppog'oy uzoq kundan keyin uxlab qolgan edi. Ular uni mehr bilan yopib, shifokorni chaqirishdi. Tez orada Oppog'oy uyg'onib, tabassum qildi.`,
   `Ertasi kuni o'rmon uyida do'stlik bayrami bo'ldi. Oppog'oy ${name}ga va yetti do'stiga g'amxo'rligi uchun rahmat aytdi. Ular mehr va yordam sehrli oynadan ham muhimligini tushunishdi.`
  ],
  en:[
   `Kind Snow White lived in a beautiful kingdom. ${name} met her in the palace garden, where they cared for flowers and offered seeds to friendly birds.`,
   `The queen often asked her magic mirror about beauty. Snow White and ${name} decided that caring for others mattered much more, and set out for a walk beyond the palace.`,
   `The friends entered a green forest. Birds guided them along a path until they found a charming cottage with seven little windows among the trees.`,
   `Seven friendly little craftspeople lived in the cottage. ${name} introduced them to Snow White, and the new friends invited the visitors to rest after their long journey.`,
   `Snow White, ${name}, and the seven friends tidied the cottage and cooked a delicious dinner. That evening they shared stories and talked about their dreams.`,
   `One day a stranger appeared on the forest path holding a shiny red apple. ${name} remembered to be careful with gifts from strangers and suggested asking their friends for advice first.`,
   `Back at the cottage, Snow White fell asleep after a long day. Her friends tucked her in and called a kind doctor to check on her. Soon she woke up smiling.`,
   `The next day everyone held a friendship celebration outside the cottage. Snow White thanked ${name} and the seven friends for their kindness. They knew that helping others mattered more than any magic mirror.`
  ]
 };
 const title=({ru:`${name} и Белоснежка`,uz:`${name} va Oppog'oy`,en:`${name} and Snow White`} as const)[language];
 return {title,pages:pages[language]};
}
function uglyDucklingStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `В тёплом гнезде возле пруда вылупился необычный серый утёнок. ${name} заметил, что он немного отличается от жёлтых братьев, и ласково пожелал ему доброго утра.`,
   `Утята отправились плавать по пруду. Серому малышу сначала было трудно, но ${name} поддерживал его с берега, а мама-утка показала безопасную дорожку между камышами.`,
   `Некоторые птицы не понимали, почему утёнок выглядит иначе. Он загрустил и пошёл по лесной тропинке. ${name} напомнил ему, что каждый заслуживает доброты.`,
   `Наступила холодная зима. ${name} нашёл для утёнка защищённое место у тёплого сарая и приносил корм. Друзья мечтали о весне и новых встречах.`,
   `Весной снег растаял, а над озером появились прекрасные белые лебеди. Серый утёнок с удивлением наблюдал за ними. ${name} предложил подойти ближе и поздороваться.`,
   `Утёнок посмотрел на своё отражение в чистой воде и увидел, что вырос в красивого белого лебедя! ${name} радостно улыбнулся: всё это время его друг менялся и рос.`,
   `Лебеди приветливо приняли нового друга и пригласили его плавать вместе. ${name} наблюдал с берега, как они дружно скользят по воде и машут крыльями.`,
   `В солнечный день молодой лебедь расправил большие белые крылья. Он поблагодарил ${name} за поддержку и понял, что настоящая красота начинается с доброты и принятия себя.`
  ],
  uz:[
   `Ko'l yonidagi issiq uyada noodatiy kulrang o'rdakcha tuxumdan chiqdi. ${name} uning sariq jo'jalardan biroz farq qilishini payqab, mehr bilan salom berdi.`,
   `O'rdakchalar ko'lda suzishga chiqishdi. Kulrang kichkintoy avval qiynaldi, ammo ${name} uni qirg'oqdan qo'llab-quvvatladi, ona o'rdak esa qamishlar orasidan xavfsiz yo'lni ko'rsatdi.`,
   `Ba'zi qushlar o'rdakchaning nega boshqacha ko'rinishini tushunishmadi. U xafa bo'lib, o'rmon so'qmog'i bo'ylab ketdi. ${name} har kim mehrga loyiq ekanini eslatdi.`,
   `Sovuq qish keldi. ${name} o'rdakchaga iliq ombor yonida pana joy topdi va unga yem olib keldi. Do'stlar bahorni intizorlik bilan kutishdi.`,
   `Bahorda qor eridi, ko'lda chiroyli oqqushlar paydo bo'ldi. Kulrang o'rdakcha ularni hayrat bilan kuzatdi. ${name} ularga yaqinlashib, salom berishni taklif qildi.`,
   `O'rdakcha tiniq suvdagi aksiga qarab, o'zi ham go'zal oqqushga aylanganini ko'rdi! ${name} quvonib jilmaydi: do'sti shu vaqt davomida o'sib, o'zgargan edi.`,
   `Oqqushlar yangi do'stlarini iliq kutib olib, birga suzishga taklif qilishdi. ${name} ularning suvda qanot qoqib, ahil suzishini qirg'oqdan kuzatdi.`,
   `Quyoshli kunda yosh oqqush katta oq qanotlarini yoydi. U ${name}ga yordami uchun rahmat aytdi va haqiqiy go'zallik mehr hamda o'zini qabul qilishdan boshlanishini tushundi.`
  ],
  en:[
   `A very unusual gray duckling hatched in a warm nest beside the pond. ${name} noticed that the little one looked different from the yellow ducklings and gave him a kind welcome.`,
   `The ducklings went swimming. The gray duckling was nervous at first, but ${name} encouraged him from the bank while Mother Duck showed the safest way through the reeds.`,
   `Some birds did not understand why the duckling looked different. He felt sad and wandered down a forest path. ${name} reminded him that everyone deserves kindness.`,
   `Winter came, bringing snow and cold winds. ${name} found a sheltered spot near a warm barn and brought food for the duckling. Together they hoped for spring.`,
   `In spring the snow melted, and graceful white swans appeared on the lake. The duckling watched them with wonder. ${name} suggested swimming closer to say hello.`,
   `When the duckling looked at his reflection, he discovered he had grown into a beautiful white swan! ${name} smiled with delight at how much his friend had changed.`,
   `The swans welcomed their new friend and invited him to swim with them. ${name} watched from the shore as they glided happily across the water.`,
   `On a sunny day the young swan spread his magnificent wings. He thanked ${name} for always being there and learned that true beauty begins with kindness and accepting yourself.`
  ]
 };
 const title=({ru:`${name} и Гадкий утёнок`,uz:`${name} va Xunuk o'rdakcha`,en:`${name} and the Ugly Duckling`} as const)[language];
 return {title,pages:pages[language]};
}
function bremenStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `Старый ослик мечтал стать музыкантом в Бремене. Однажды ${name} услышал его песню и предложил идти вместе. Впереди лежала широкая дорога между зелёными лугами.`,
   `На дороге они встретили доброго пса, которому тоже хотелось найти новых друзей. Пёс с радостью присоединился к ним и стал отбивать ритм хвостом.`,
   `Вскоре за кустом показался кот. Он ловко прыгнул на бревно и замурлыкал весёлую мелодию. ${name} пригласил его в маленький оркестр, и путешественников стало четверо.`,
   `Под вечер друзья встретили петуха с громким звонким голосом. Теперь ослик, пёс, кот и петух могли исполнить целую песню. ${name} помог придумать мелодию, и все дружно отправились дальше.`,
   `В лесу стемнело. Вдалеке друзья увидели дом с освещёнными окнами. Они решили вежливо спросить, можно ли переночевать, но сначала осторожно посмотрели, кто находится внутри.`,
   `Друзья исполнили свою громкую песню у окна. Незнакомцы в доме испугались неожиданного концерта и поспешно ушли. ${name} заглянул внутрь и убедился, что теперь там безопасно.`,
   `Музыканты устроились в уютном доме, согрелись у камина и потренировали новую песню. ${name} помог расставить маленькие инструменты, а петух дирижировал с подоконника.`,
   `Утром друзья выступили перед лесными соседями. Все хлопали в ладоши и подпевали. Ослик понял, что музыка и настоящая дружба уже подарили ему счастье, даже без большого концертного зала.`
  ],
  uz:[
   `Qari eshak Bremen shahrida musiqachi bo'lishni orzu qilardi. Bir kuni ${name} uning qo'shig'ini eshitib, birga yo'lga chiqishni taklif qildi. Ular yashil o'tloqlar orasidan yurishdi.`,
   `Yo'lda ular yangi do'st izlayotgan mehribon itni uchratishdi. It mamnun bo'lib ularga qo'shildi va dumini likillatib, kuyga ritm berdi.`,
   `Ko'p o'tmay butalar orasidan mushuk chiqdi. U yog'och ustiga sakrab, quvnoq kuy xirgoyi qildi. ${name} uni kichik orkestrga taklif qildi.`,
   `Kechga yaqin do'stlar ovozi jarangdor xo'rozni uchratishdi. Endi eshak, it, mushuk va xo'roz birga qo'shiq kuylay olardi. ${name} ularga yangi kuy topishda yordam berdi.`,
   `O'rmonda qorong'i tushdi. Uzoqda derazalari yoritilgan uy ko'rindi. Do'stlar tunashga ruxsat so'rashni o'ylashdi, ammo avval uyda kim borligini bilishga qaror qilishdi.`,
   `Do'stlar deraza yonida baland ovozda qo'shiq aytishdi. Uydagi notanishlar kutilmagan konsertdan cho'chib chiqib ketishdi. ${name} ichkariga qarab, joy xavfsiz ekanini tekshirdi.`,
   `Musiqachilar shinam uyga joylashib, kamin yonida isinishdi. ${name} asboblarni tartibga soldi, xo'roz esa deraza yonida turib qo'shiqni boshqardi.`,
   `Ertalab do'stlar o'rmondagi qo'shnilarga konsert berishdi. Hamma xursand bo'lib, ularga qo'shilib kuyladi. Eshak katta sahnasiz ham musiqa va do'stlik baxt keltirishini tushundi.`
  ],
  en:[
   `An old donkey dreamed of becoming a musician in Bremen. One day ${name} heard him singing and suggested traveling together. A broad road stretched through green meadows ahead.`,
   `On the road they met a friendly dog looking for new companions. He gladly joined them and wagged his tail in time with the donkey's song.`,
   `Soon a cat appeared from behind the bushes. He leaped onto a log and purred a cheerful melody. ${name} invited him to join their little band.`,
   `At sunset they met a rooster with a wonderfully loud voice. Now the donkey, dog, cat and rooster could sing a whole song together. ${name} helped them invent a new tune.`,
   `As the forest grew dark, the friends saw a house with glowing windows. They hoped to ask for shelter, but first they carefully looked to see who was inside.`,
   `The friends performed their loudest song outside the window. The strangers in the house were startled by the unexpected concert and ran away. ${name} checked that it was safe before they entered.`,
   `The musicians settled into the cozy house, warmed themselves by the fireplace and practiced a new song. ${name} arranged their instruments while the rooster conducted from the windowsill.`,
   `In the morning they performed for their forest neighbors. Everyone clapped and sang along. The donkey realized that music and friendship had already brought him joy, even without a grand concert hall.`
  ]
 };
 const title=({ru:`${name} и Бременские музыканты`,uz:`${name} va Bremen musiqachilari`,en:`${name} and the Bremen Town Musicians`} as const)[language];
 return {title,pages:pages[language]};
}
function hanselGretelStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `Однажды брат и сестра, Гензель и Гретель, отправились по лесной тропинке. ${name} пошёл вместе с ними. Друзья взяли корзинку с едой и договорились не расходиться далеко друг от друга.`,
   `Гензель оставлял на дорожке светлые камешки, чтобы найти дорогу домой. ${name} помогал запоминать развилки, а Гретель прислушивалась к пению птиц. Вместе они не боялись приключений.`,
   `За деревьями показался удивительный пряничный домик. Его крыша была покрыта сладкой глазурью, а окна украшали леденцы. Гретель удивилась, но ${name} напомнил, что в чужой дом нельзя входить без разрешения.`,
   `Хозяйка домика вышла навстречу и предложила гостям угощения. Друзья вежливо поблагодарили её, но решили сначала узнать, где находятся и как вернуться домой.`,
   `Гензель и Гретель заметили, что хозяйка не хочет отпускать их из домика. ${name} предложил действовать спокойно: друзья нашли открытое окно, собрались вместе и осторожно вышли в сад.`,
   `На улице светило солнце. Друзья увидели знакомую тропинку за пряничным забором. Они быстро ушли от странного домика и больше не стали разговаривать с его недоброй хозяйкой.`,
   `Гензель вспомнил о камешках, оставленных на тропинке. ${name} помог найти последний поворот, а Гретель заметила знакомый старый дуб. Впереди уже виднелась родная деревня.`,
   `Дома их встретили с объятиями. Гензель и Гретель поблагодарили ${name} за дружбу и внимательность. В тот вечер они узнали: вместе легче найти дорогу и справиться с любой неожиданностью.`
  ],
  uz:[
   `Bir kuni aka-singil Genzel va Gretel o'rmon so'qmog'iga chiqishdi. ${name} ham ularga qo'shildi. Do'stlar oziq-ovqat solingan savatni olib, bir-biridan uzoqlashmaslikka kelishishdi.`,
   `Genzel uyga qaytish yo'lini topish uchun so'qmoqqa oq toshchalar tashlab bordi. ${name} burilishlarni eslab qoldi, Gretel esa qushlarning ovoziga quloq soldi.`,
   `Daraxtlar orasidan ajoyib shirinlik uyi ko'rindi. Tomi shirin sir bilan qoplangan, derazalari esa konfetlar bilan bezatilgan edi. ${name} begonaning uyiga ruxsatsiz kirmaslikni eslatdi.`,
   `Uyning egasi tashqariga chiqib, mehmonlarni shirinlikka taklif qildi. Do'stlar muloyim rahmat aytishdi, ammo avval uyga qaytish yo'lini so'rashga qaror qilishdi.`,
   `Genzel va Gretel uy egasi ularni qo'yib yuborgisi kelmayotganini sezishdi. ${name} xotirjam harakat qilishni taklif qildi. Ular birga ochiq derazani topib, bog'ga chiqishdi.`,
   `Tashqarida quyosh porlardi. Do'stlar shirinlik devori ortida tanish so'qmoqni ko'rishdi. Ular g'alati uydan uzoqlashib, o'rmon yo'liga qaytishdi.`,
   `Genzel so'qmoqqa tashlagan toshchalarni esladi. ${name} oxirgi burilishni topdi, Gretel esa tanish katta eman daraxtini ko'rdi. Oldinda qishloq ko'rina boshladi.`,
   `Uyda ularni quvonch bilan kutib olishdi. Genzel va Gretel ${name}ga do'stligi va e'tibori uchun rahmat aytishdi. Ular hamjihatlik bilan qiyinchiliklarni yengish mumkinligini bilishdi.`
  ],
  en:[
   `One day Hansel and Gretel set off along a forest path. ${name} joined them, carrying a basket of snacks. They promised to stay together and watch out for one another.`,
   `Hansel dropped pale pebbles along the path so they could find their way home. ${name} remembered the crossroads while Gretel listened to the birds and watched for familiar trees.`,
   `Behind the trees stood an amazing gingerbread cottage. Its roof was covered in icing and its windows glittered with candy. ${name} reminded the friends to ask permission before approaching a stranger's home.`,
   `The cottage's owner stepped outside and offered the visitors sweets. The children thanked her politely, but first asked for directions back to their village.`,
   `Hansel and Gretel realized the owner did not want them to leave. ${name} suggested staying calm. Together they found an open window, gathered their things, and slipped safely into the garden.`,
   `The sun was shining beyond the candy fence. The friends spotted a familiar path, hurried away from the strange cottage, and decided not to follow the unfriendly owner again.`,
   `Hansel remembered the pebbles along their route. ${name} found the last turning while Gretel recognized an old oak tree. Their home village was just ahead.`,
   `At home their family welcomed them with warm hugs. Hansel and Gretel thanked ${name} for being such a good friend. Together they had learned how kindness and careful thinking can help everyone find their way.`
  ]
 };
 const title=({ru:`${name}, Гензель и Гретель`,uz:`${name}, Genzel va Gretel`,en:`${name}, Hansel and Gretel`} as const)[language];
 return {title,pages:pages[language]};
}
function rapunzelStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `Высоко над лесом стояла башня с маленьким окошком. В ней жила Рапунцель, девушка с удивительно длинными золотыми волосами. ${name} услышал её красивое пение издалека.`,
   `Рапунцель любила рассматривать звёзды и плести цветочные венки. Она мечтала увидеть мир за стенами башни. ${name} заметил у основания башни тропинку и решил помочь ей найти безопасный путь наружу.`,
   `Однажды по лесу проезжал добрый юноша. Услышав пение Рапунцель, он остановился возле башни. ${name} рассказал ему, что девушка хочет увидеть лес и познакомиться с новыми друзьями.`,
   `Рапунцель спустила из окна свои длинные золотые косы, чтобы поговорить с гостями. Но ${name} предложил сначала найти надёжную лестницу: безопасность важнее спешки.`,
   `Друзья принесли крепкую лестницу и осторожно закрепили её у башни. Рапунцель впервые увидела цветы под самыми окнами и поняла, что скоро сможет выйти на прогулку.`,
   `На рассвете Рапунцель спустилась из башни. ${name} и юноша встретили её на лесной полянке. Все вместе они пошли по тропинке, где пели птицы и расцветали первые весенние цветы.`,
   `Друзья добрались до маленького дома у леса. Там они отдохнули, выпили чаю и договорились помогать друг другу. Рапунцель радовалась своему первому свободному дню.`,
   `Рапунцель больше не была одинока. Она гуляла по саду, училась новому и пела любимые песни вместе с друзьями. ${name} понял: дружба помогает найти путь к самым светлым мечтам.`
  ],
  uz:[
   `O'rmon ustida kichik derazali baland minora turardi. Unda nihoyatda uzun oltin sochli Rapunsel yashardi. ${name} uzoqdan uning chiroyli qo'shig'ini eshitdi.`,
   `Rapunsel yulduzlarni tomosha qilishni va gullardan gulchambar yasashni yaxshi ko'rardi. U minoradan tashqaridagi olamni ko'rishni orzu qilardi. ${name} unga xavfsiz chiqish yo'lini topishga qaror qildi.`,
   `Bir kuni mehribon yigit o'rmondan o'tayotib Rapunselning qo'shig'ini eshitdi. ${name} unga qizning o'rmonni ko'rish va do'stlar orttirish orzusi haqida aytdi.`,
   `Rapunsel mehmonlar bilan gaplashish uchun uzun oltin sochlarini derazadan tushirdi. Ammo ${name} avval mustahkam narvon topishni taklif qildi, chunki xavfsizlik hammasidan muhim.`,
   `Do'stlar mustahkam narvon olib kelib, minoraga ehtiyotkorlik bilan o'rnatishdi. Rapunsel pastdagi gullarga qarab, tez orada sayrga chiqa olishidan quvondi.`,
   `Tong otganda Rapunsel minoradan tushdi. ${name} va yigit uni o'rmon maydonida kutib olishdi. Ular qushlar sayragan va bahor gullari ochilgan yo'ldan yurishdi.`,
   `Do'stlar o'rmon yonidagi kichik uyga yetib borishdi. Ular dam olib, choy ichishdi va bir-biriga yordam berishga kelishishdi. Rapunsel ilk erkin kunidan xursand edi.`,
   `Rapunsel endi yolg'iz emasdi. U bog'da sayr qilar, yangi narsalarni o'rganar va do'stlari bilan qo'shiq aytardi. ${name} do'stlik eng yorqin orzularga yo'l ochishini tushundi.`
  ],
  en:[
   `High above the forest stood a tower with a tiny window. A girl named Rapunzel lived there, with wonderfully long golden hair. One day ${name} heard her beautiful singing from afar.`,
   `Rapunzel loved watching the stars and weaving flower crowns. She dreamed of seeing the world outside the tower. ${name} found a path near its base and decided to help her explore safely.`,
   `A kind young traveler passed through the forest and stopped to listen to Rapunzel's song. ${name} told him that she wished to see the trees and make new friends.`,
   `Rapunzel lowered her long golden braids from the window to greet the visitors. But ${name} suggested finding a sturdy ladder first, because being careful mattered more than hurrying.`,
   `The friends brought a strong ladder and secured it carefully against the tower. Rapunzel could see the flowers just below her window and smiled at the thought of her first walk outside.`,
   `At sunrise Rapunzel climbed down the ladder. ${name} and the traveler welcomed her to a sunny clearing. Together they followed a path filled with birdsong and spring flowers.`,
   `The friends reached a little cottage by the forest, where they rested, drank tea and promised to help each other. Rapunzel felt joyful on her first day exploring the world.`,
   `Rapunzel was no longer alone. She wandered through gardens, learned new things and sang with her friends. ${name} learned that friendship helps make even the brightest dreams come true.`
  ]
 };
 const title=({ru:`${name} и Рапунцель`,uz:`${name} va Rapunsel`,en:`${name} and Rapunzel`} as const)[language];
 return {title,pages:pages[language]};
}
function sleepingBeautyStory(name:string,language:Lang):Story {
 const pages:Record<Lang,string[]>={
  ru:[
   `В далёком королевстве родилась принцесса Аврора. В замке устроили большой праздник. ${name} принёс букет цветов, а добрые феи пожелали малышке счастья, здоровья и смелости.`,
   `Аврора росла любознательной и доброй. Она любила гулять в королевском саду и слушать пение птиц. ${name} помогал ей ухаживать за цветами, а феи рассказывали удивительные истории.`,
   `Однажды Аврора нашла в старой башне незнакомую прялку. Она осторожно приблизилась к ней, но случайно коснулась веретена. Волшебное заклятие погрузило принцессу в глубокий сон.`,
   `Добрые феи узнали о случившемся и решили защитить королевство. Они укрыли Аврору тёплым одеялом, а весь замок погрузили в мирный сон, пока не наступит время пробуждения.`,
   `Прошли годы. Вокруг дворца выросли густые розовые кусты. ${name} услышал легенду о спящей принцессе и отправился искать дорогу к замку вместе со смелым принцем.`,
   `Принц и ${name} нашли тропинку через заросли роз. Они помогли друг другу пройти мимо ветвей и добрались до дворцовых ворот. Когда подошло время, двери открылись перед ними.`,
   `В тихой комнате принц и ${name} увидели Аврору. Добрые феи сняли волшебное заклятие, и принцесса открыла глаза. Вместе с ней проснулись жители замка, а комнаты вновь наполнились светом.`,
   `Во дворце устроили радостный праздник. Аврора, принц и ${name} танцевали среди цветов и смеха. Все поняли, что терпение, смелость и забота о друзьях помогают преодолеть долгие испытания.`
  ],
  uz:[
   `Uzoq qirollikda Avrora ismli malika tug'ildi. Saroyda katta bayram bo'ldi. ${name} bir dasta gul olib keldi, mehribon parilar esa chaqaloqqa baxt, sog'lik va jasorat tilashdi.`,
   `Avrora mehribon va qiziquvchan bo'lib ulg'aydi. U qirollik bog'ida sayr qilishni va qushlarning sayrashini tinglashni yaxshi ko'rardi. ${name} unga gullarni parvarish qilishda yordam berdi.`,
   `Bir kuni Avrora eski minoradan notanish charxni topdi. U yaqinlashib, tasodifan charxning o'tkir qismiga tegdi. Sehrli afsun malikani chuqur uyquga ketkazdi.`,
   `Mehribon parilar nima bo'lganini bilib, qirollikni himoya qilishdi. Ular Avrorani issiq ko'rpa bilan yopib, uyg'onish vaqti kelguncha butun saroyni sokin uyquga cho'mdirishdi.`,
   `Yillar o'tdi. Saroy atrofida qalin atirgul butalari o'sdi. ${name} uxlayotgan malika haqidagi afsonani eshitib, jasur shahzoda bilan birga saroyga yo'l izlashga tushdi.`,
   `Shahzoda va ${name} atirgullar orasidagi so'qmoqni topishdi. Ular bir-biriga yordam berib, saroy darvozalariga yetishdi. Kerakli vaqt kelganda, darvozalar ochildi.`,
   `Sokin xonada shahzoda va ${name} Avrorani ko'rishdi. Mehribon parilar afsunni bekor qilishdi va malika ko'zlarini ochdi. U bilan birga saroy ahli ham uyg'ondi.`,
   `Saroyda quvonchli bayram uyushtirildi. Avrora, shahzoda va ${name} gullar orasida raqsga tushishdi. Hamma sabr, jasorat va do'stlarga g'amxo'rlik qiyinchiliklarni yengishga yordam berishini tushundi.`
  ],
  en:[
   `In a faraway kingdom a princess named Aurora was born. The palace held a wonderful celebration. ${name} brought a bouquet of flowers, and the kind fairies wished the baby happiness, health, and courage.`,
   `Aurora grew into a curious and kind young princess. She loved walks in the royal garden and the songs of birds. ${name} helped tend her flowers, while the fairies shared marvelous stories.`,
   `One day Aurora found an unfamiliar spinning wheel in an old tower. She approached it carefully but accidentally touched its spindle. A magic spell sent the princess into a deep sleep.`,
   `The kind fairies learned what had happened and protected the kingdom. They tucked Aurora under a warm blanket and placed the whole castle in a peaceful sleep until the time came to wake again.`,
   `Years passed, and thick rose bushes grew around the palace. ${name} heard the legend of the sleeping princess and set out with a brave prince to find the castle.`,
   `The prince and ${name} found a path through the roses. They helped each other past the branches and reached the palace gates. When the time was right, the doors opened to welcome them.`,
   `In a quiet room the prince and ${name} discovered Aurora. The kind fairies lifted the spell, and the princess opened her eyes. The people of the castle awoke as sunlight returned to every room.`,
   `A joyful celebration filled the palace. Aurora, the prince, and ${name} danced among flowers and laughter. Everyone learned that patience, courage, and caring for friends can overcome a long and difficult trial.`
  ]
 };
 const title=({ru:`${name} и Спящая красавица`,uz:`${name} va Uyqudagi go'zal`,en:`${name} and Sleeping Beauty`} as const)[language];
 return {title,pages:pages[language]};
}
function pussBootsStory(name:string,language:Lang):Story{
 const pages:Record<Lang,string[]>={
 ru:[
 `Младшему сыну мельника достался в наследство умный рыжий кот. ${name} встретил кота возле мельницы. Кот попросил пару крепких сапог и маленькую сумку, обещая придумать необыкновенное приключение.`,
 `Получив сапоги и шляпу, кот важно прошёлся по двору. ${name} помог ему собрать сумку, а молодой мельник удивился, каким уверенным стал его пушистый друг.`,
 `Кот отправился по полям и собрал корзину спелых ягод для королевского стола. ${name} помог аккуратно донести подарки до ворот, и стражники впустили их во дворец.`,
 `Король с удовольствием принял гостинцы и расспросил кота о его хозяине. Кот назвал молодого мельника маркизом Карабасом. ${name} заметил, как легко слова могут запутать людей, и напомнил другу говорить правду.`,
 `Однажды королевская карета проезжала мимо реки. Мельник помог путникам выбраться на сухую дорожку, а ${name} познакомил его с королём и принцессой. Все поблагодарили юношу за доброту.`,
 `Вдали виднелся большой старый замок. Кот решил разведать дорогу к нему. ${name} пошёл рядом и помог понять, кто живёт в замке и можно ли попросить там гостеприимства.`,
 `Владельцу замка понравились находчивость кота и вежливость его друзей. Он пригласил гостей в сад. Молодой мельник рассказал королю о своей настоящей жизни, а кот больше не стал придумывать ему титулы.`,
 `В конце дня все встретились у замка на дружеском празднике. Мельник благодарил ${name} и кота за поддержку, а кот гордо шагал в своих новых сапогах. Друзья поняли, что ум лучше всего служит доброте и честности.`
 ],
 uz:[
 `Tegirmonchining kenja o'g'liga aqlli malla mushuk meros bo'lib qoldi. ${name} uni tegirmon yonida uchratdi. Mushuk mustahkam etik va kichik xalta so'rab, ajoyib sarguzashtni va'da qildi.`,
 `Etik va shlyapa olgan mushuk hovlida mag'rur yurdi. ${name} uning xaltasini tayyorlashga yordam berdi. Yosh tegirmonchi do'stining qanchalik dadil bo'lib qolganiga hayron bo'ldi.`,
 `Mushuk dalaga borib, qirollik dasturxoni uchun pishgan mevalar yig'di. ${name} sovg'alarni darvozagacha olib borishga yordam berdi va soqchilar ularni saroyga kiritishdi.`,
 `Qirol sovg'alarni mamnuniyat bilan qabul qilib, mushukning xo'jayini haqida so'radi. Mushuk tegirmonchini Karabas markizi deb tanishtirdi. ${name} do'stiga doimo rost gapirish muhimligini eslatdi.`,
 `Bir kuni qirollik aravasi daryo yonidan o'tdi. Tegirmonchi yo'lovchilarga quruq so'qmoqni ko'rsatdi. ${name} uni qirol va malikaga tanishtirdi. Hamma yigitga yaxshiligi uchun rahmat aytdi.`,
 `Uzoqda katta eski qasr ko'rindi. Mushuk uning oldiga borib, yo'lni bilmoqchi bo'ldi. ${name} hamroh bo'lib, qasrda kim yashashini va mehmon bo'lish mumkinligini so'rashga yordam berdi.`,
 `Qasr egasiga mushukning topqirligi va do'stlarining odobi yoqdi. U mehmonlarni bog'ga taklif qildi. Tegirmonchi qirolga o'zining haqiqiy hayoti haqida aytdi, mushuk esa endi unvon o'ylab topmadi.`,
 `Kun oxirida do'stlar qasr oldida bayram qilishdi. Tegirmonchi ${name} va mushukka yordamlari uchun rahmat aytdi. Mushuk esa yangi etiklarida mag'rur yurdi. Hamma aql halollik va mehr bilan ishlatilsa, foydali ekanini tushundi.`
 ],
 en:[
 `A clever ginger cat was all the youngest miller's son inherited. ${name} met the cat beside the old mill. The cat asked for a sturdy pair of boots and a little bag, promising an extraordinary adventure.`,
 `With boots and a jaunty hat, the cat marched proudly across the yard. ${name} helped pack his bag, and the young miller wondered how his furry friend had become so confident.`,
 `The cat wandered through the fields and gathered a basket of ripe berries for the royal table. ${name} helped carry the gifts to the palace gates, where the guards welcomed them inside.`,
 `The king gladly accepted the presents and asked about the cat's master. The cat called the young miller the Marquis of Carabas. ${name} realized that such stories could confuse people and reminded the cat to be truthful.`,
 `One day the royal carriage passed a river. The miller helped its travelers find a dry path. ${name} introduced him to the king and princess, who thanked the kind young man.`,
 `An enormous old castle appeared in the distance. The cat set off to explore the road. ${name} came along to discover who lived there and whether they might ask for hospitality.`,
 `The castle's owner admired the cat's cleverness and the visitors' good manners. He welcomed them into his garden. The miller honestly told the king about his life, and the cat stopped inventing grand titles.`,
 `Everyone gathered near the castle for a friendly celebration. The miller thanked ${name} and the cat for their support, while the cat proudly strode about in his boots. They learned that cleverness works best alongside honesty and kindness.`
 ]};
 const title=({ru:`${name} и Кот в сапогах`,uz:`${name} va Etik kiygan mushuk`,en:`${name} and Puss in Boots`} as const)[language];
 return {title,pages:pages[language]};
}
function makeClassicStory(id:ClassicId,name:string,language:Lang):Story{
 const complete=fullClassicChapters(id,name,language);
 if(complete){
  const classic=classics.find(item=>item.id===id);
  if(!classic)throw Error("Unknown classic");
  const title=language==="ru"?`${name} и сказка «${classic.title.ru}»`:language==="uz"?`${name} va «${classic.title.uz}» ertagi`:`${name} and ${classic.title.en}`;
  return {title,pages:complete};
 }
 if(id==="puss-boots")return pussBootsStory(name,language);
 if(id==="sleeping-beauty")return sleepingBeautyStory(name,language);
 if(id==="rapunzel")return rapunzelStory(name,language);
 if(id==="hansel-gretel")return hanselGretelStory(name,language);
 if(id==="bremen")return bremenStory(name,language);
 if(id==="ugly-duckling")return uglyDucklingStory(name,language);
 if(id==="snow-white")return snowWhiteStory(name,language);
 if(id==="cinderella")return cinderellaStory(name,language);
 if(id==="three-pigs")return threePigsStory(name,language);
 if(id==="red-hood")return redHoodStory(name,language);
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


/** Legacy copies must only be updated after explicit user confirmation. */
export function canRefreshClassicDemoStory(book:DemoBook):boolean {
 if(!["cinderella","three-pigs","snow-white","ugly-duckling","bremen","hansel-gretel","rapunzel","sleeping-beauty","puss-boots"].includes(book.classicId||""))return false;
 if(book.pages.length!==8)return false;
 const start=book.pages[0]?.text||"";
 return start.startsWith("Однажды "+book.name+" открыл волшебную книгу.")||
   start.startsWith("Bir kuni "+book.name+" sehrli kitobni ochdi.")||
   start.startsWith("One day, "+book.name+" opened a magical book.");
}
export function refreshClassicDemoStory(book:DemoBook):DemoBook {
 if(!canRefreshClassicDemoStory(book))return book;
 const story=makeClassicStory(book.classicId!,book.name,book.language||"uz");
 return {...book,title:story.title,pages:book.pages.map((page,index)=>({
  ...page,
  text:story.pages[index],
  image_url:classicReaderImage(book.classicId,page.image_url,index,story.pages[index])
 }))};
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
    prompt:previous.prompt,title:fitSequelTitle(previous.title,story.suffix),language:lang,
    classicId:previous.classicId,mode:"browser-demo",savedOnDevice:Boolean(previous.savedOnDevice),
    pages:story.pages.map((text,index)=>({number:index+1,text,image_url:art||illustration(index+1)}))
 };
 saveDemoBooks([sequel,...getDemoBooks()]);
 return sequel;
};
