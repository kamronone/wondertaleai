/** Distinct, self-contained storybook scenes for every Red Riding Hood demo page.
 * These are deterministic vector fallback illustrations: no child photo,
 * external requests or AI provider. High-resolution PNG originals can replace
 * each scene through the /images/classics/red-hood/pages/ asset directory.
 */
const C={sky:"#fbe2b8",sun:"#ffe6a0",leaf:"#6b9b72",leaf2:"#a6c27b",wood:"#9a674a",red:"#cc3d52",dress:"#ffecd9",skin:"#f3bb97",hair:"#714839",path:"#dfb78c",grass:"#bad6a0",wolf:"#858579",flower:"#f6a6b1",ink:"#5a4b45"};
const flowers=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><circle r="10" fill="#f9de84"/><circle cx="0" cy="-15" r="10" fill="#fff3ed"/><circle cx="0" cy="15" r="10" fill="#fff3ed"/><circle cx="-15" r="10" fill="#fff3ed"/><circle cx="15" r="10" fill="#fff3ed"/></g>`;
const girl=(x:number,y:number,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})">
<ellipse cx="0" cy="192" rx="75" ry="18" fill="#846b5b" opacity=".17"/>
<path d="M-26 113 L-56 177 Q0 210 56 177 L26 113Z" fill="#b96769"/>
<path d="M-30 110 L30 110 L43 163 Q0 184 -42 163Z" fill="${C.dress}"/>
<path d="M-63 113 Q-37 61 0 62 Q42 62 63 113 L79 173 Q0 199 -79 173Z" fill="${C.red}" stroke="#af3146" stroke-width="4"/>
<circle cy="65" r="48" fill="${C.skin}"/>
<path d="M-47 66 Q-48 -14 -1 -22 Q48 -16 48 65 Q29 36 10 21 Q-14 47 -47 66Z" fill="${C.red}" stroke="#af3146" stroke-width="4"/>
<path d="M-35 62 Q-20 45 -10 52 M10 52 Q20 45 34 62" fill="none" stroke="${C.hair}" stroke-width="9" stroke-linecap="round"/>
<circle cx="-17" cy="70" r="4" fill="${C.ink}"/><circle cx="18" cy="70" r="4" fill="${C.ink}"/>
<path d="M-10 91 Q0 101 12 90" fill="none" stroke="#a9544b" stroke-width="3" stroke-linecap="round"/>
<circle cx="-29" cy="89" r="9" fill="#e99c93" opacity=".65"/><circle cx="30" cy="89" r="9" fill="#e99c93" opacity=".65"/>
<path d="M-17 120 Q0 140 17 120" fill="none" stroke="#ffe3cf" stroke-width="7"/>
<path d="M42 125 Q75 118 80 148" fill="none" stroke="${C.skin}" stroke-width="11" stroke-linecap="round"/>
<path d="M43 134 Q67 109 95 132" fill="none" stroke="${C.wood}" stroke-width="7"/>
<path d="M49 132 L96 132 L91 177 Q70 187 55 177 Z" fill="#bb8958" stroke="#a9764e" stroke-width="4"/>
<path d="M51 147 H94 M53 159 H92" stroke="#ead5a8" stroke-width="4"/>
</g>`;
const wolf=(x:number,y:number,scale=1,cap=false)=>`<g transform="translate(${x} ${y}) scale(${scale})">
<ellipse cx="0" cy="150" rx="91" ry="22" fill="#846b5b" opacity=".16"/>
<path d="M-56 55 L-74 -13 L-23 18 L20 -2 L68 -26 L55 53Z" fill="${C.wolf}" stroke="#66685f" stroke-width="4"/>
<ellipse cy="102" rx="70" ry="66" fill="${C.wolf}"/>
<path d="M-53 112 Q0 150 49 108 Q35 169 -36 160 Z" fill="#e8d9c1"/>
<ellipse cx="0" cy="30" rx="62" ry="62" fill="${C.wolf}"/>
<path d="M-39 48 Q0 75 40 48 Q24 98 0 105 Q-32 94 -39 48Z" fill="#f0dbc1"/>
<circle cx="-20" cy="22" r="6" fill="${C.ink}"/><circle cx="21" cy="22" r="6" fill="${C.ink}"/>
<ellipse cx="0" cy="58" rx="12" ry="8" fill="${C.ink}"/>
<path d="M-12 74 Q0 82 14 72" fill="none" stroke="#76574d" stroke-width="4" stroke-linecap="round"/>
${cap?'<path d="M-63 -3 Q-15 -55 54 -14 L58 8 Q0 -5 -60 16Z" fill="#f8f0ea" stroke="#ce8f9f" stroke-width="6"/><circle cx="0" cy="28" r="29" fill="none" stroke="#bd9b67" stroke-width="4"/>':""}</g>`;
const forest=`<rect width="800" height="600" fill="url(#sky)"/>
<circle cx="655" cy="101" r="75" fill="${C.sun}" opacity=".7"/>
<path d="M0 400 Q215 300 420 380 Q610 290 800 375 V600 H0Z" fill="${C.leaf2}"/>
<path d="M0 465 Q250 376 450 450 Q635 377 800 454 V600 H0Z" fill="${C.grass}"/>
<path d="M240 600 Q390 420 430 365 Q483 443 620 600Z" fill="${C.path}"/>
<path d="M40 0 H95 L120 445 H58Z M684 0 H735 L752 426 H680Z" fill="${C.wood}"/>
<circle cx="70" cy="93" r="150" fill="${C.leaf}" opacity=".9"/>
<circle cx="148" cy="50" r="130" fill="${C.leaf2}"/>
<circle cx="707" cy="53" r="155" fill="${C.leaf}" opacity=".9"/>
<circle cx="633" cy="112" r="90" fill="${C.leaf2}"/>
${flowers(130,483)}${flowers(697,493)}${flowers(620,431)}${flowers(235,432)}`;
const cottage=(x:number,y:number,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})">
<path d="M-126 19 L0 -95 L126 19 V166 H-126Z" fill="#fff1d8" stroke="#bd8367" stroke-width="7"/>
<path d="M-148 23 L-2 -119 L151 23" fill="none" stroke="#a45b53" stroke-width="27" stroke-linejoin="round"/>
<path d="M-31 166 V70 Q-27 31 4 31 Q33 31 33 70 V166Z" fill="#956447"/>
<circle cx="20" cy="99" r="5" fill="#f2d17e"/>
<rect x="-95" y="45" width="41" height="52" rx="6" fill="#9cc9cf" stroke="#fef1d8" stroke-width="7"/>
<rect x="61" y="45" width="41" height="52" rx="6" fill="#9cc9cf" stroke="#fef1d8" stroke-width="7"/>
<path d="M-79 44 V97 M81 44 V97" stroke="#fef1d8" stroke-width="5"/>
</g>`;
const room=`<rect width="800" height="600" fill="#f7e4ce"/>
<rect y="435" width="800" height="165" fill="#d7ad8b"/>
<rect x="90" y="90" width="185" height="240" rx="75" fill="#e8b9a6" stroke="#b7836e" stroke-width="13"/>
<rect x="119" y="122" width="126" height="165" rx="58" fill="#cce4c7"/>
<path d="M181 120 V289 M120 212 H245" stroke="#fff6e8" stroke-width="13"/>
<rect x="595" y="143" width="130" height="32" rx="8" fill="#b07f5e"/>
<rect x="605" y="94" width="23" height="53" fill="#8fa7b5"/>
<rect x="650" y="107" width="24" height="40" fill="#bd7789"/>
<circle cx="680" cy="69" r="37" fill="#e6acbf"/>
${flowers(704,89)}`;
const bed=`<g><rect x="155" y="333" width="570" height="220" rx="31" fill="#ae7859" stroke="#865a48" stroke-width="12"/>
<rect x="170" y="360" width="538" height="160" rx="22" fill="#eec7ba"/>
<path d="M178 408 Q320 351 441 411 T708 407 V514 H178Z" fill="#f5d8c8"/>
<path d="M178 444 Q315 393 450 445 T708 441" fill="none" stroke="#da9b9c" stroke-width="20" stroke-dasharray="45 18"/>
<circle cx="179" cy="347" r="18" fill="#b78861"/><circle cx="710" cy="347" r="18" fill="#b78861"/></g>`;
const defs=`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff1cf"/><stop offset="1" stop-color="#bdddbb"/></linearGradient>
<filter id="shadow"><feDropShadow dx="0" dy="9" stdDeviation="10" flood-color="#785f52" flood-opacity=".15"/></filter></defs>`;
function scene(index:number):string{
 switch(index){
  case 0:return room+`<rect x="295" y="115" width="180" height="205" rx="22" fill="#b6845c"/><path d="M330 141 H449 V297 H330Z" fill="#ecd6a5"/><circle cx="390" cy="217" r="41" fill="#fcdf8d"/>`+girl(562,300,1.05);
  case 1:return forest+cottage(600,285,.48)+girl(335,270,1.15);
  case 2:return forest+girl(420,260,1.13)+`<path d="M162 362 Q220 302 285 335" fill="none" stroke="#efebd7" stroke-width="9"/>`+`<ellipse cx="228" cy="346" rx="41" ry="36" fill="#f4df98"/>`;
  case 3:return forest+wolf(210,315,1.03)+girl(544,285,1.07);
  case 4:return forest+cottage(445,275,1.05)+`<path d="M0 600 Q350 474 800 600" fill="#d3b08b"/>`+wolf(133,412,.55);
  case 5:return room+bed+wolf(440,289,.85,true);
  case 6:return room+bed+wolf(440,289,.76,true)+girl(675,319,.74);
  default:return forest+cottage(565,270,.68)+girl(320,315,.86)+`<g transform="translate(177 332)"><circle cy="46" r="41" fill="#f4c1a4"/><path d="M-42 50 Q-35 -20 0 6 Q38 -20 42 50" fill="#e3d5c6"/><path d="M-60 100 Q0 58 65 100 L67 182 H-60Z" fill="#b58dba"/><path d="M-45 44 Q0 67 43 44" fill="none" stroke="#fff0e3" stroke-width="14"/></g>`;
 }
}
/** Use only for the built-in Red Riding Hood demo, not private or uploaded photos. */
export function redHoodPageArtwork(pageIndex:number):string{
 const current=Math.max(0,Math.min(7,Math.trunc(Number.isFinite(pageIndex)?pageIndex:0)));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img"><title>Little Red Riding Hood, page ${current+1}</title>${defs}<rect width="800" height="600" fill="#fff6e7"/><g filter="url(#shadow)">${scene(current)}</g></svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}

/** Public, bundled PNG for a given reading page, no network API or account token. */
export function redHoodPagePng(pageIndex:number):string{
 const page=Math.max(1,Math.min(8,Math.trunc(Number.isFinite(pageIndex)?pageIndex:0)+1));
 return "/images/classics/red-hood/watercolor/page-"+page+".png";
}

/** Upgrade only the built-in classic cover/old demo art.
 * Never overwrite a real, customized illustration with fallback artwork.
 */
export function redHoodReaderImage(classicId:string|undefined,imageUrl:string,pageIndex:number):string{
 if(classicId!=="red-hood")return imageUrl;
 const oldCover=imageUrl==="/images/classics/red-hood.svg";
 const localVector=imageUrl.startsWith("data:image/svg+xml;charset=utf-8,");
 const builtinPage=/^\/images\/classics\/red-hood\/(?:pages|watercolor)\/page-[1-8]\.png$/.test(imageUrl);
 return oldCover||localVector||builtinPage ? redHoodPagePng(pageIndex) : imageUrl;
}
