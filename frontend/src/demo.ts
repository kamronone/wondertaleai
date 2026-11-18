// Browser-only preview fallback. Photos never leave the browser in this mode.
export type DemoBook = {id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:{number:number;text:string;image_url:string}[];mode:string};
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
export const createDemoBook=(name:string,age:number,theme:string,style:string,prompt:string):DemoBook=>{
  const title=name+" и волшебная звезда";
  const paragraphs=[
    "Однажды "+name+" увидел за окном маленькую звезду, которой нужна была помощь.",
    "Она рассказала о прекрасном мире под названием «"+theme+"», где исчезли все цвета радуги.",
    name+" отправился в путь вместе с весёлым лисёнком. Их ждала удивительная тропинка.",
    "Друзья встретили доброго дракона, который подсказал дорогу к волшебному дереву.",
    "Наш герой вспомнил свою мечту: "+prompt.trim().replace(/[.!?]+$/,"")+".",
    "Вместе они нашли маленький ключ, спрятанный среди светящихся цветов.",
    name+" повернул ключ, и мир снова наполнился красками, песнями и улыбками.",
    "Вернувшись домой, герой понял, что смелость и доброта превращают обычный день в сказку."
  ];
  const book:DemoBook={id:"local-"+crypto.randomUUID(),created_at:new Date().toISOString(),name,age,theme,style,prompt,title,mode:"browser-demo",pages:paragraphs.map((text,index)=>({number:index+1,text,image_url:illustration(index)}))};
  saveDemoBooks([book,...getDemoBooks()]);
  return book;
};
