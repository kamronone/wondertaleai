/** Gentle, eight-scene illustrated fallback for The Ugly Duckling. */
const duck=(x:number,y:number,scale=1,swan=false)=>`<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="73" rx="${swan?95:63}" ry="${swan?43:41}" fill="${swan?"#fff9ec":"#c3bcb5"}" stroke="${swan?"#e4e9e6":"#a99e99"}" stroke-width="5"/><path d="${swan?"M-3 58Q-10-63 50-72":"M-18 49Q-17-13 24-23"}" stroke="${swan?"#fff9ec":"#c3bcb5"}" stroke-width="${swan?28:23}" fill="none" stroke-linecap="round"/><circle cx="${swan?50:25}" cy="${swan?-68:-29}" r="${swan?27:26}" fill="${swan?"#fff9ec":"#c3bcb5"}"/><path d="${swan?"M75-71l48 12-47 16Z":"M48-29l37 10-36 16Z"}" fill="#e4ad70"/><circle cx="${swan?58:31}" cy="${swan?-73:-33}" r="5" fill="#4c5060"/><path d="M-40 75Q-80 33-41 25" stroke="${swan?"#fff9ec":"#c3bcb5"}" stroke-width="18" fill="none"/></g>`;
const yellow=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="33" rx="43" ry="29" fill="#f8d78e"/><circle cx="26" cy="-4" r="28" fill="#f8d78e"/><path d="M50-4l30 10-29 13" fill="#eaaa74"/><circle cx="34" cy="-10" r="5" fill="#52495b"/></g>`;
const pond='<path d="M0 390Q100 360 200 390T400 386T600 394T800 383V600H0" fill="#79b8bd"/><path d="M0 420Q90 396 180 419T360 418T560 417T800 412" fill="none" stroke="#e0f1e8" stroke-width="10"/><path d="M0 478Q125 452 260 477T530 474T800 474" fill="none" stroke="#c9e9e6" stroke-width="7"/>';
const reeds=Array.from({length:11},(_,i)=>`<g transform="translate(${25+i*75} ${442+(i%3)*18})"><path d="M0 100Q5 10 16-25" fill="none" stroke="#72997d" stroke-width="7"/><ellipse cx="16" cy="-30" rx="9" ry="31" fill="#a67e69"/></g>`).join("");
const nest='<ellipse cx="356" cy="456" rx="233" ry="87" fill="#cfa773" stroke="#ad8467" stroke-width="14"/><path d="M138 463Q330 380 575 461" fill="none" stroke="#ead0a0" stroke-width="25"/>';
const trees='<g fill="#a1bd8a"><circle cx="80" cy="165" r="125"/><circle cx="720" cy="164" r="128"/><circle cx="145" cy="102" r="99"/></g><path d="M85 192v303m620-295v301" stroke="#a3806c" stroke-width="31"/>';
function scene(page:number):string{
 switch(page){
 case 0:return nest+duck(318,379,.85)+yellow(184,417,.6)+yellow(465,412,.6)+yellow(540,429,.55);
 case 1:return pond+reeds+duck(330,365,1)+yellow(165,379,.65)+yellow(550,372,.7)+yellow(648,389,.55);
 case 2:return trees+'<path d="M0 530Q280 410 800 510V600H0" fill="#d7b993"/>'+duck(365,363,1.2);
 case 3:return trees+'<g fill="#fffaf1"><circle cx="190" cy="150" r="13"/><circle cx="280" cy="113" r="11"/><circle cx="560" cy="155" r="12"/><circle cx="660" cy="215" r="8"/></g><path d="M0 512Q120 470 245 503T490 507T800 498V600H0" fill="#e9eef2"/>'+duck(400,354,1.13);
 case 4:return pond+duck(331,368,.87)+duck(568,346,1,true)+'<path d="M180 300Q380 290 590 300" fill="none" stroke="#f9edd0" stroke-width="7"/>';
 case 5:return pond+duck(353,359,1.25,true)+'<path d="M160 466Q400 436 610 464" stroke="#ecf4e9" stroke-width="10" fill="none"/>';
 case 6:return pond+duck(238,359,.77,true)+duck(480,360,.77,true)+duck(624,382,.57,true);
 default:return pond+duck(390,331,1.5,true)+'<g fill="#f5e9c8"><circle cx="140" cy="180" r="11"/><circle cx="680" cy="240" r="10"/></g>';
 }
}
export function uglyDucklingPageArtwork(index:number):string{
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const winter=page===3;
 const sky=winter?"#d8e4ef":"#e4eadc";
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>The Ugly Duckling, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#fcf1df"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="663" cy="98" r="62" fill="#fff0bb"/><path d="M0 400Q185 300 394 388T800 367V600H0" fill="${winter?"#e9edf0":"#b8d0a7"}"/><path d="M0 495Q183 431 395 468T800 446V600H0" fill="${winter?"#f3f3f6":"#95bba7"}"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
