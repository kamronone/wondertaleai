// Browser-only preview fallback. Photos never leave the browser in this mode.
import type { Lang } from "./i18n";
export type DemoBook = {id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:{number:number;text:string;image_url:string}[];mode:string;language?:Lang};
const key="wondertale-preview-books-v1";
export const getDemoBooks=():DemoBook[]=>{try{return JSON.parse(sessionStorage.getItem(key)||"[]")}catch{return []}};
export const saveDemoBooks=(books:DemoBook[])=>sessionStorage.setItem(key,JSON.stringify(books.slice(0,20)));
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
export const createDemoBook=(name:string,age:number,theme:string,style:string,prompt:string,language:Lang="ru"):DemoBook=>{
 const story=demoStories[language](name,theme,prompt);
 const book:DemoBook={id:"local-"+crypto.randomUUID(),created_at:new Date().toISOString(),name,age,theme,style,prompt,title:story.title,language,mode:"browser-demo",pages:story.pages.map((text,index)=>({number:index+1,text,image_url:illustration(index)}))};
 saveDemoBooks([book,...getDemoBooks()]);
 return book;
};
