/** Original eight-scene offline fallback for the Bremen Town Musicians.
 * No user photos and no remote image dependencies.
 */
const animal=(kind:"donkey"|"dog"|"cat"|"rooster",x:number,y:number,scale=1)=> {
 const colors={donkey:"#a79b95",dog:"#bc8b68",cat:"#d9af86",rooster:"#eed9a4"};
 const c=colors[kind];
 const parts={
 donkey:'<path d="M-42-49L-48-132Q-17-126-12-69M21-73L52-132Q73-115 43-39" fill="#bca7a0" stroke="#8d8181" stroke-width="5"/><path d="M-28 30Q0 51 29 30" fill="#eee5d7"/>',
 dog:'<path d="M-40-46Q-103-66-80 9Q-47 32-40-4M35-43Q99-60 77 7Q46 32 35-5" fill="#9e765f"/><ellipse cy="32" rx="23" ry="17" fill="#e9cdb7"/>',
 cat:'<path d="M-48-39L-66-109L-13-74M13-75L67-109L47-37" fill="#c99674" stroke="#9d8169" stroke-width="6"/><path d="M-27 30h-43m96 0h43M-27 43h-38m91 0h38" stroke="#eed7bb" stroke-width="3"/>',
 rooster:'<path d="M-24-76Q-57-119-28-139Q0-171 26-128Q64-139 49-94" fill="#d66865"/><path d="M40 4L102-17 42 28" fill="#e6a465"/><path d="M-48 66Q-110-1-84-78" fill="none" stroke="#72a6a2" stroke-width="20"/>'
 };
 return `<g transform="translate(${x} ${y}) scale(${scale})">
 <ellipse cy="136" rx="53" ry="13" fill="#6a6172" opacity=".16"/>
 <ellipse cy="76" rx="52" ry="65" fill="${c}"/>
 <circle cy="-17" r="53" fill="${c}" stroke="#9f897c" stroke-width="4"/>
 ${parts[kind]}<circle cx="-17" cy="-17" r="5" fill="#453c4c"/><circle cx="18" cy="-17" r="5" fill="#453c4c"/>
 <ellipse cx="0" cy="18" rx="13" ry="10" fill="#836d65"/>
 <path d="M-10 37Q0 46 12 37" fill="none" stroke="#765d61" stroke-width="4"/>
 <path d="M-25 114v45m49-45v45" stroke="${c}" stroke-width="16" stroke-linecap="round"/>
 </g>`;
};
const forest='<path d="M80 471V152m639 322V136" stroke="#a8836d" stroke-width="38"/><g fill="#729d83"><circle cx="95" cy="158" r="114"/><circle cx="172" cy="111" r="81"/><circle cx="696" cy="146" r="118"/><circle cx="594" cy="100" r="80"/></g>';
const road='<path d="M201 600Q295 471 392 418Q505 480 626 600" fill="#e8c4a5"/>';
const house='<path d="M220 439V250l190-123 192 123v189Z" fill="#f1d8b4" stroke="#bb9378" stroke-width="11"/><path d="M192 257l218-150 220 150" fill="none" stroke="#a16b6f" stroke-width="28" stroke-linejoin="round"/><path d="M372 439V322q40-35 82 0v117" fill="#9a7969"/><rect x="269" y="290" width="65" height="65" rx="8" fill="#ffeab6" stroke="#fff3df" stroke-width="9"/><rect x="494" y="290" width="65" height="65" rx="8" fill="#ffeab6" stroke="#fff3df" stroke-width="9"/>';
const music='<g fill="none" stroke="#8865ad" stroke-width="8" stroke-linecap="round"><path d="M103 118V80l29-7v38m0-38v-29l25-5v28"/><path d="M584 100V65l27-8v42m0-42V30l28-6v24"/><path d="M685 218v-31l33-10v38"/></g><g fill="#8865ad"><ellipse cx="99" cy="121" rx="12" ry="8"/><ellipse cx="128" cy="116" rx="12" ry="8"/><ellipse cx="580" cy="105" rx="12" ry="8"/><ellipse cx="607" cy="101" rx="12" ry="8"/><ellipse cx="682" cy="222" rx="13" ry="8"/></g>';
const band=(x=120,y=355,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})">${animal("donkey",70,75,.9)}${animal("dog",223,108,.8)}${animal("cat",360,116,.72)}${animal("rooster",495,78,.68)}</g>`;
function scene(i:number):string{
 switch(i){
 case 0:return forest+road+animal("donkey",270,354,1.25);
 case 1:return forest+road+animal("donkey",219,380,.9)+animal("dog",455,380,1.04);
 case 2:return forest+road+animal("donkey",153,420,.75)+animal("dog",312,411,.7)+animal("cat",519,407,.8);
 case 3:return forest+road+band(95,338,.95)+music;
 case 4:return forest+house+band(132,380,.6);
 case 5:return house+animal("donkey",327,402,.7)+animal("dog",465,408,.65)+music;
 case 6:return forest+house+band(103,360,.92)+music;
 default:return house+band(104,373,.94)+music+'<g fill="#f7c9ce"><circle cx="113" cy="523" r="11"/><circle cx="691" cy="513" r="12"/></g>';
 }
}
export function bremenPageArtwork(pageIndex:number):string{
 const page=Math.max(0,Math.min(7,Number.isFinite(pageIndex)?Math.trunc(pageIndex):0));
 const sunset=page===4||page===5;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Bremen Town Musicians, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sunset?"#d9b4cc":"#f8e9cc"}"/><stop offset="1" stop-color="${sunset?"#f0d3c9":"#d7e8d5"}"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="653" cy="94" r="60" fill="#fff0b7"/><path d="M0 402Q190 313 394 407T800 386V600H0" fill="#bad4ae"/><path d="M0 492Q180 431 400 479T800 468V600H0" fill="#93bb9a"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
