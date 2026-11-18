// Browser-only preview fallback. Photos never leave the browser in this mode.
import type { Lang } from "./i18n";
import { classics, type ClassicId } from "./classics";
export type DemoBook = {id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:{number:number;text:string;image_url:string}[];mode:string;language?:Lang;classicId?:ClassicId;savedOnDevice?:boolean};
const sessionKey="wondertale-preview-books-v1";
const deviceKey="wondertale-opt-in-books-v1";
const readBooks=(store:Storage,key:string):DemoBook[]=>{
 try{const parsed=JSON.parse(store.getItem(key)||"[]");return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x.id==="string"&&x.id.startsWith("local-")&&Array.isArray(x.pages)).slice(0,20):[];}catch{return []}
};
export const getDemoBooks=():DemoBook[]=>{
 const session=readBooks(sessionStorage,sessionKey);
 const saved=readBooks(localStorage,deviceKey).map(b=>({...b,savedOnDevice:true}));
 const found=new Set<string>();
 return [...saved,...session].filter(book=>{if(found.has(book.id))return false;found.add(book.id);return true;}).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,30);
};
export const saveDemoBooks=(books:DemoBook[])=>{
 const chosen=books.filter(b=>b.savedOnDevice).slice(0,20);
 const ephemeral=books.filter(b=>!b.savedOnDevice).slice(0,20);
 // Names and stories stay in this browser; photos are never saved or uploaded in demo.
 if(chosen.length){localStorage.setItem(deviceKey,JSON.stringify(chosen));}else{localStorage.removeItem(deviceKey);}
 if(ephemeral.length){sessionStorage.setItem(sessionKey,JSON.stringify(ephemeral));}else{sessionStorage.removeItem(sessionKey);}
};
export const isDemoBook=(book:DemoBook)=>book.id.startsWith("local-");
const illustration=(index:number):string=>{
  const bg=[["#6b55af","#e5b2d9"],["#306c8b","#9cd8da"],["#604e9b","#d5a4b3"],["#657d9c","#f5c6a0"]][index%4];
  const stars=Array.from({length:20},(_,i)=>{const x=(i*137+index*42)%700+40;const y=(i*89+index*65)%700+30;return '<circle cx="'+x+'" cy="'+y+'" r="'+(i%4+2)+'" fill="#fff4d3"/>'}).join("");
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024"><defs><linearGradient id="sky" x2="0.5" y2="1"><stop stop-color="'+bg[0]+'"/><stop offset="1" stop-color="'+bg[1]+'"/></linearGradient></defs><rect width="768" height="1024" fill="url(#sky)"/>'+stars+'<circle cx="385" cy="505" r="230" fill="#fff2cd"/><path d="M385 315 L426 443 561 445 452 522 494 651 385 569 276 651 318 522 209 445 344 443Z" fill="#efbd64"/><circle cx="341" cy="523" r="9" fill="#55436c"/><circle cx="433" cy="523" r="9" fill="#55436c"/><path d="M346 565 Q385 610 424 565" fill="none" stroke="#ad6e89" stroke-width="9" stroke-linecap="round"/></svg>';
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
 "Bir kuni "+name+" deraza yonida yordamga muhtoj kichkina yulduzni ko‘rib qoldi.",
 "Yulduz «"+theme+"» olamidagi kamalakning barcha ranglari yo‘qolganini aytib berdi.",
 name+" quvnoq tulkicha bilan yo‘lga chiqdi. Ularni ajoyib sarguzasht kutardi.",
 "Do‘stlar sehrli daraxtga boradigan yo‘lni ko‘rsatgan mehribon ajdarni uchratishdi.",
 "Qahramon o‘z orzusini esladi: "+prompt.trim().replace(/[.!?]+$/,"")+".",
 "Birgalikda ular nur sochib turgan gullar orasidan kichkina kalitni topishdi.",
 name+" kalitni burdi va olam yana ranglar, qo‘shiqlar hamda tabassumlarga to‘ldi.",
 "Uyga qaytgan qahramon jasorat va mehr oddiy kunni ham ertakka aylantirishini tushundi."
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
 uz:["o‘rmon yo‘lida Qizil qalpoqchani uchratdi","u bilan buvisiga shirinlik olib bordi","ayyor bo‘rining gaplariga aldanmadi","buvijon bilan quvonchli choy ichdi"],
 en:["met Little Red Riding Hood on a forest path","helped carry treats to Grandma","noticed the wolf's misleading directions","enjoyed a happy tea party with Grandma"]},
 "cinderella":{
 ru:["познакомился с доброй Золушкой","помог украсить её платье звёздочками","увидел великолепный дворец и танцевальный зал","нашёл потерянную туфельку и вернул её подруге"],
 uz:["mehribon Zolushka bilan tanishdi","uning ko‘ylagini yulduzchalar bilan bezadi","ajoyib saroy va raqs zalini ko‘rdi","yo‘qolgan tuflichani topib do‘stiga qaytardi"],
 en:["met kind Cinderella","helped decorate her dress with stars","visited the beautiful palace ballroom","found the lost slipper and returned it to a friend"]},
 "three-pigs":{
 ru:["подружился с тремя поросятами","вместе с ними собирал кирпичи и строил уютный дом","придумал умный способ защитить домик от сильного ветра","пригласил волка поговорить по-доброму"],
 uz:["uchta cho‘chqacha bilan do‘stlashdi","ular bilan g‘isht yig‘ib qulay uy qurdi","uyni kuchli shamoldan asrash usulini topdi","bo‘rini do‘stona suhbatga taklif qildi"],
 en:["befriended three little pigs","collected bricks and built a cozy house together","found a clever way to make it strong against wind","invited the wolf to talk peacefully"]},
 "snow-white":{
 ru:["встретил Белоснежку в лесу","помог семерым друзьям навести порядок в домике","собрал корзинку вкусных лесных ягод","устроил праздник дружбы с Белоснежкой"],
 uz:["o‘rmonda Oppog‘oyni uchratdi","yetti do‘stga uyni yig‘ishtirishda yordam berdi","o‘rmon mevalaridan savat to‘ldirdi","Oppog‘oy bilan do‘stlik bayramini uyushtirdi"],
 en:["met Snow White in the forest","helped seven friends tidy their cozy cottage","collected a basket of delicious berries","celebrated friendship with Snow White"]},
 "ugly-duckling":{
 ru:["увидел грустного утёнка у пруда","помог ему познакомиться с другими птицами","напомнил ему, что каждый по-своему прекрасен","увидел, как утёнок вырос в прекрасного лебедя"],
 uz:["ko‘l yonida xafa o‘rdakchani ko‘rdi","unga boshqa qushlar bilan do‘stlashishda yordam berdi","har kim o‘ziga xos go‘zal ekanini eslatdi","o‘rdakcha chiroyli oqqushga aylanganini ko‘rdi"],
 en:["met a sad duckling by a pond","helped it make friends with other birds","reminded it that everyone is beautiful in their own way","watched the duckling grow into a graceful swan"]},
 "bremen":{
 ru:["встретил осла, собаку, кота и петуха","помог друзьям придумать весёлую песню","собрал музыкальные инструменты для концерта","выступил с друзьями перед благодарными слушателями"],
 uz:["eshak, it, mushuk va xo‘rozni uchratdi","do‘stlarga quvnoq qo‘shiq o‘ylab topishda yordam berdi","konsert uchun musiqa asboblarini tayyorladi","do‘stlari bilan tomoshabinlar oldida kuyladi"],
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
 "Kitob muqovasida oltin yulduzlar porlardi, havodan gullarning xushbo‘y isi kelardi. Go‘yo mo‘jiza boshlanayotgandek edi.",
 "Atrofdagi daraxtlar ohista shivirlardi, kimdir esa quvonib qo‘l silkitdi. Qahramon bu olamda uni kutishganini sezdi.",
 "Do‘stlar shoshilmadi, bir-biri bilan tanishib, hamkorlik qilishga kelishib olishdi. Ular endi haqiqiy jamoa edi.",
 "Hatto kichkina yaxshilik ham muhim bo‘lib chiqdi. Har kim qo‘lidan kelgancha yordam berdi.",
 "Avvaliga vazifa qiyin tuyuldi, ammo hech kim umidini yo‘qotmadi. Ular bir-birini tinglab, yangi fikr topishdi.",
 "Do‘stlar birgalikda kulishdi: halollik va sabr bilan har qanday jumboq yechilishi mumkin. Sarguzasht yanada qiziqarli bo‘ldi.",
 "Bayramda kulgu va samimiy so‘zlar yangradi. Hamma bu hikoyaning eng katta boyligi do‘stlik ekanini tushundi.",
 "Uyqu oldidan qahramon sarguzashtning eng go‘zal damlarini esladi. Sehrli ertak uning qalbida abadiy qoldi."
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
