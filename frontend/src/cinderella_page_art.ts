/** Eight distinct offline Cinderella scenes. Bundled vector fallback only. */
const girl=(x:number,y:number,scale=1,gown=false)=>`<g transform="translate(${x} ${y}) scale(${scale})">
<ellipse cy="159" rx="73" ry="16" fill="#927b8d" opacity=".18"/>
<path d="M-47 38Q-69 108-78 149Q0 175 80 149Q70 94 43 38Z" fill="${gown?"#a8bcf1":"#8791b0"}" stroke="${gown?"#dce4ff":"#66718c"}" stroke-width="4"/>
<path d="M-42 36Q0 25 41 36V84Q0 101-41 84Z" fill="${gown?"#c7d9ff":"#f4e5d7"}"/>
<circle cy="-12" r="44" fill="#f2c7ad"/>
<path d="M-44 -12Q-50-78 9-70Q66-57 45-4L25-47Q-12-24-44-12Z" fill="#895e52"/>
<path d="M26-55q47 6 37 43" fill="none" stroke="#895e52" stroke-width="17"/>
<circle cx="-14" cy="-13" r="4" fill="#544257"/><circle cx="16" cy="-13" r="4" fill="#544257"/>
<path d="M-10 9Q0 18 11 9" stroke="#ab7772" stroke-width="3" fill="none"/>
<path d="M-43 66l-44 51m128-51 44 51" stroke="#f2c7ad" stroke-width="12" stroke-linecap="round"/>
${gown?'<path d="M-55 80Q-6 105 60 76M-66 125Q-4 141 63 118" fill="none" stroke="#f5f3ff" stroke-width="5"/><circle cx="0" cy="-67" r="8" fill="#a8cff9"/>':'<path d="M-29 48v63m58-63v63" stroke="#fff3e8" stroke-width="5"/>'}
</g>`;
const fairy=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><path d="M-68 38Q-108 142-82 164H80Q105 136 67 38Z" fill="#b9a6e1"/><circle cy="-5" r="42" fill="#f8d3ba"/><path d="M-45-25Q-35-92 14-68Q48-61 45-18" fill="#e4dddb"/><path d="M31 51l95-86" stroke="#d9a6ef" stroke-width="8"/><path d="M126-35l12-36 13 36 36 13-36 10-13 34-12-34-34-10Z" fill="#ffefb0"/><path d="M-60 70Q0 126 67 70" stroke="#eee8fa" stroke-width="7" fill="none"/></g>`;
const prince=(x:number,y:number,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-51 44h102l19 118H-69Z" fill="#e8e0ce" stroke="#d8b971" stroke-width="5"/><path d="M-10 43l10 110 12-110" fill="none" stroke="#c7a061" stroke-width="12"/><circle cy="-14" r="43" fill="#efc5a3"/><path d="M-42-22Q-42-76 16-66Q50-50 44-17Q23-42-42-22" fill="#755848"/><circle cx="-13" cy="-13" r="4" fill="#4a4052"/><circle cx="17" cy="-13" r="4" fill="#4a4052"/><path d="M-9 11Q0 19 11 10" stroke="#a26e6d" stroke-width="3" fill="none"/><path d="M-49 62l-37 60m134-60 38 60" stroke="#efc5a3" stroke-width="13" stroke-linecap="round"/></g>`;
const mice='<g fill="#a78c88" stroke="#866c73" stroke-width="3"><ellipse cx="135" cy="507" rx="28" ry="20"/><circle cx="154" cy="493" r="16"/><circle cx="141" cy="482" r="10"/><ellipse cx="225" cy="519" rx="22" ry="16"/><circle cx="242" cy="507" r="13"/><circle cx="231" cy="498" r="8"/></g><g fill="#fbf7eb"><circle cx="161" cy="493" r="3"/><circle cx="249" cy="506" r="3"/></g>';
const cottage='<path d="M45 394V172L250 90 461 172v223" fill="#f7e3d5" stroke="#bb947b" stroke-width="13"/><path d="M18 175L252 61 489 175" stroke="#af7b75" stroke-width="31" fill="none" stroke-linejoin="round"/><path d="M184 392V269q60-42 116 0v123" fill="#ae8172"/><rect x="81" y="221" width="68" height="68" rx="10" fill="#b7deda" stroke="#fff6e7" stroke-width="9"/><rect x="351" y="221" width="68" height="68" rx="10" fill="#b7deda" stroke="#fff6e7" stroke-width="9"/>';
const palace='<path d="M95 450V270h90V170h130v280m30 0V190h145v260m30 0V275h90v175" fill="#d3c8e3" stroke="#f8e8ed" stroke-width="9"/><path d="M90 275l50-65 52 65m-16-103 71-100 72 100m22 22 75-112 81 112m17 85 50-70 54 70" fill="#e9b7d0" stroke="#fff0db" stroke-width="7"/><g fill="#fff2bd"><rect x="231" y="217" width="27" height="54" rx="12"/><rect x="386" y="239" width="27" height="54" rx="12"/><rect x="533" y="309" width="27" height="54" rx="12"/></g>';
const pumpkin='<ellipse cx="381" cy="450" rx="112" ry="79" fill="#edb264" stroke="#d99254" stroke-width="12"/><path d="M381 372q-5-57 41-71" stroke="#749a6c" stroke-width="15" fill="none"/><path d="M354 377q-53 67 0 140M410 375q55 71-3 142" stroke="#f6d392" stroke-width="8" fill="none"/>';
const stars=Array.from({length:16},(_,i)=>`<circle cx="${33+(i*97)%735}" cy="${50+(i*61)%335}" r="${i%3+3}" fill="#fff8dd" opacity=".88"/>`).join("");
function scene(page:number):string{
 switch(page){
 case 0:return cottage+girl(573,355,1.07)+mice+'<path d="M557 460l-130 69" stroke="#ac8364" stroke-width="14" stroke-linecap="round"/>';
 case 1:return cottage+girl(565,335,.94)+mice+'<g fill="#f8b6cb"><path d="M102 391h130v26H102ZM270 420h133v28H270Z"/></g>';
 case 2:return cottage+fairy(594,292)+girl(226,354,.94)+pumpkin+'<g stroke="#f9e8a2" stroke-width="8"><path d="M440 275l-48-40M475 278l25-52"/></g>';
 case 3:return palace+girl(239,367,1.1,true)+'<g transform="translate(415 380)"><ellipse rx="120" ry="84" fill="#f3c47c" stroke="#e3ae72" stroke-width="12"/><circle cx="-75" cy="90" r="42" fill="none" stroke="#e9d5ba" stroke-width="12"/><circle cx="85" cy="90" r="42" fill="none" stroke="#e9d5ba" stroke-width="12"/></g>';
 case 4:return palace+girl(287,337,1.08,true)+prince(509,341,1.07)+'<path d="M325 449Q400 491 481 446" fill="none" stroke="#d8bdd4" stroke-width="11"/>';
 case 5:return '<path d="M0 380h800v220H0Z" fill="#d7c1d8"/><path d="M0 390h800" stroke="#ffefd2" stroke-width="20"/>'+girl(280,341,1.02,true)+prince(527,344,1.05)+'<rect x="390" y="435" width="38" height="90" rx="7" fill="#c99b80"/>';
 case 6:return palace+girl(359,379,1,true)+'<path d="M-20 600L690 376h150L120 600" fill="#ddd1e1" stroke="#f7e8e5" stroke-width="14"/><path d="M490 474l49-9-12 33-53 5Z" fill="#cbe8f6" stroke="#9fb9d7" stroke-width="5"/>';
 default:return palace+girl(294,375,1,true)+prince(506,374,1)+'<path d="M390 498l35-23 19 23-30 21Z" fill="#cbe8f6" stroke="#aac2df" stroke-width="5"/>';
 }
}
export function cinderellaPageArtwork(index:number):string {
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const night=page>=2&&page<=6;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Cinderella, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${night?"#b7b1da":"#f7e5ca"}"/><stop offset="1" stop-color="${night?"#edc4d9":"#e6ead9"}"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="666" cy="98" r="62" fill="${night?"#fff8d2":"#fff0bc"}"/>${stars}<path d="M0 459Q192 393 407 450T800 417V600H0" fill="${night?"#bdaccb":"#b8d2ae"}"/><path d="M0 535Q200 484 388 532T800 492V600H0" fill="${night?"#a5a5c5":"#ddc5aa"}"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
