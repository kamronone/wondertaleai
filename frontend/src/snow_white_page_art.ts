/** Snow White: page-specific offline scenes, with no remote media or personal data. */
const snow=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="140" rx="67" ry="14" fill="#735f7d" opacity=".16"/><path d="M-37 44Q-69 102-83 141Q0 162 84 141Q63 94 36 44Z" fill="#f5d288"/><path d="M-40 40Q0 28 40 40V83Q0 100-40 83Z" fill="#577cae"/><circle cy="-13" r="41" fill="#f1c3a3"/><path d="M-43-8Q-57-74 5-66Q55-63 45 4L22-40Q-5-12-43-8Z" fill="#38374d"/><path d="M-20-60l20-12 19 12" fill="none" stroke="#cf6879" stroke-width="9"/><circle cx="-14" cy="-14" r="4" fill="#403949"/><circle cx="16" cy="-14" r="4" fill="#403949"/><path d="M-9 8Q0 16 11 7" fill="none" stroke="#ad6c6d" stroke-width="3"/><path d="M-39 65l-42 48m123-48 43 48" stroke="#f1c3a3" stroke-width="12" stroke-linecap="round"/></g>`;
const queen=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><path d="M-54 52Q-80 122-87 157H89Q70 106 53 52Z" fill="#65527a"/><path d="M-49 53h98v62H-49Z" fill="#8b6a9c"/><circle cy="-13" r="42" fill="#f2c5b2"/><path d="M-45-14Q-48-73 5-76Q50-69 48-11" fill="#51445d"/><path d="M-39-54l-8-43 28 18 19-31 21 31 26-19-7 44Z" fill="#d9b06a" stroke="#f4d692" stroke-width="4"/><circle cx="-13" cy="-13" r="4" fill="#55414d"/><circle cx="15" cy="-13" r="4" fill="#55414d"/><path d="M-10 15Q0 19 12 14" fill="none" stroke="#9a6665" stroke-width="3"/></g>`;
const helper=(x:number,y:number,c:string)=>`<g transform="translate(${x} ${y})"><path d="M-27 12Q-38 49-42 71H43Q37 39 29 12Z" fill="${c}"/><circle cy="-8" r="24" fill="#efd0ad"/><path d="M-28-25Q-1-60 28-25L36-17H-35Z" fill="${c}"/><circle cx="-9" cy="-9" r="3" fill="#4d4757"/><circle cx="10" cy="-9" r="3" fill="#4d4757"/><path d="M-8 5Q0 12 8 5" fill="none" stroke="#9a6964" stroke-width="2"/></g>`;
const helpers=(baseX=180,baseY=418)=>Array.from({length:7},(_,i)=>helper(baseX+(i%4)*108,baseY+Math.floor(i/4)*89,["#b67b6e","#648b8d","#9d82b8","#b7945d","#769b76","#b8889e","#718bb7"][i])).join("");
const trees='<g fill="#5a896f"><circle cx="96" cy="203" r="111"/><circle cx="154" cy="125" r="101"/><circle cx="683" cy="190" r="124"/><circle cx="583" cy="96" r="93"/></g><path d="M70 150v354m630-347v344" stroke="#a4816d" stroke-width="31"/>';
const cottage='<path d="M244 447V273L401 166 568 273v174Z" fill="#f3d7b2" stroke="#ae846c" stroke-width="9"/><path d="M222 285l180-145 188 145" fill="none" stroke="#a56d70" stroke-width="26" stroke-linejoin="round"/><path d="M365 447v-111q31-30 68 0v111" fill="#a2766c"/><rect x="279" y="305" width="54" height="56" rx="7" fill="#bdded4" stroke="#fff6dc" stroke-width="7"/><rect x="485" y="305" width="54" height="56" rx="7" fill="#bdded4" stroke="#fff6dc" stroke-width="7"/>';
const castle='<path d="M130 450V261h112v189m28 0V174h260v276m24 0V261h110v189" fill="#d5c6e3" stroke="#f4e6e9" stroke-width="8"/><path d="M116 264l70-87 70 87m7-87 140-125 139 125m1 87 68-87 69 87" fill="#c9a3d1" stroke="#ffedd7" stroke-width="8"/><g fill="#ffe8aa"><rect x="175" y="308" width="25" height="50" rx="9"/><rect x="379" y="237" width="43" height="66" rx="13"/><rect x="586" y="308" width="25" height="50" rx="9"/></g>';
const mirror='<path d="M-72-92Q0-162 72-92V78Q0 161-72 78Z" fill="#eed4ab" stroke="#b08c6c" stroke-width="15"/><path d="M-49-78Q0-129 49-78V65Q0 113-49 65Z" fill="#b5d4e0" stroke="#f5e9d0" stroke-width="6"/><path d="M0 119v70m-45 0h90" stroke="#b08c6c" stroke-width="18"/>';
const apple='<circle cx="0" cy="0" r="37" fill="#d65a64"/><path d="M-1-33q-2-27 18-32" fill="none" stroke="#719270" stroke-width="9"/><path d="M3-39q28-33 42-2-17 17-42 2" fill="#82ad7e"/>';
function scene(page:number):string {
 switch(page){
 case 0:return castle+snow(397,366,1.12);
 case 1:return castle+queen(300,365)+'<g transform="translate(561 310)">'+mirror+'</g>';
 case 2:return trees+snow(360,365,1.06)+'<g fill="#f3e4b5"><circle cx="288" cy="476" r="9"/><circle cx="470" cy="436" r="8"/></g>';
 case 3:return cottage+snow(166,406,.8)+helpers(426,429);
 case 4:return cottage+snow(387,365,.96)+helpers(190,430);
 case 5:return trees+snow(320,382,1)+'<g transform="translate(536 357)">'+apple+'</g>'+queen(650,401);
 case 6:return cottage+'<path d="M130 497h540v66H130Z" fill="#ead8c9"/><path d="M171 470Q395 436 622 469" fill="none" stroke="#efd8a3" stroke-width="48"/>'+helpers(180,428);
 default:return cottage+snow(404,363,1.05)+helpers(132,420)+'<g fill="#f1cbad"><circle cx="624" cy="389" r="27"/></g>';
 }
}
export function snowWhitePageArtwork(index:number):string {
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const bg=page===1?"#e8dcec":"#f6e8d0";
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Snow White, page ${page+1}</title><defs><linearGradient id="b" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#dcebcf"/></linearGradient></defs><rect width="800" height="600" fill="url(#b)"/><circle cx="639" cy="103" r="61" fill="#fff0bd"/><path d="M0 443Q160 372 360 427T800 410V600H0" fill="#a5c79e"/><path d="M0 520Q203 471 398 505T800 483V600H0" fill="#83b595"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
