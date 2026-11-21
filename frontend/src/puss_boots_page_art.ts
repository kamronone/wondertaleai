/** Eight self-contained illustrations for Puss in Boots. */
const cat=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">
<ellipse cy="146" rx="68" ry="14" fill="#89778c" opacity=".17"/>
<path d="M-41 41Q-69 111-63 151H65Q70 113 41 41Z" fill="#e6b67f"/>
<circle cy="-18" r="48" fill="#eab67e" stroke="#ce966a" stroke-width="4"/>
<path d="M-46-35l-18-52 48 22m34 0 49-22-19 51" fill="#eab67e" stroke="#ce966a" stroke-width="5"/>
<path d="M-29-16q13-11 26 0m10 0q13-11 26 0" fill="none" stroke="#584551" stroke-width="5"/>
<ellipse cy="9" rx="10" ry="7" fill="#af7a70"/><path d="M-3 15l-12 15m18-15 12 15" fill="none" stroke="#9a6b65" stroke-width="3"/>
<path d="M-38 38l-49 31m125-31 49 31" stroke="#eab67e" stroke-width="13" stroke-linecap="round"/>
<path d="M-37 107v46m73-46v46" stroke="#784e68" stroke-width="23" stroke-linecap="round"/>
<path d="M-61-69q62-54 122 0l-21 14H-41Z" fill="#a35b66"/><path d="M-73-56q72-22 146 0" stroke="#a35b66" stroke-width="12" stroke-linecap="round"/>
<path d="M-40 55Q0 76 41 55" stroke="#c55b69" stroke-width="7" fill="none"/>
<path d="M61 82q83-54 74-103" stroke="#eab67e" stroke-width="20" fill="none" stroke-linecap="round"/>
</g>`;
const miller=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-46 37h92l19 128H-64Z" fill="#88aeb5"/><circle cy="-19" r="41" fill="#f0c6ad"/><path d="M-43-27Q-39-72 0-70Q41-71 43-25" fill="#84664e"/><circle cx="-14" cy="-21" r="4" fill="#55465b"/><circle cx="15" cy="-21" r="4" fill="#55465b"/><path d="M-10 5q10 14 20 0" stroke="#a37572" stroke-width="3" fill="none"/><path d="M-45 53l-36 47m126-47 36 47" stroke="#f0c6ad" stroke-width="12" stroke-linecap="round"/></g>`;
const royal=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-48 44h96l22 129H-70Z" fill="#b5a6d0"/><circle cy="-15" r="40" fill="#f2c7ae"/><path d="M-42-35l-11-34 29 10 24-32 22 32 31-12-10 36Z" fill="#eac46e"/><circle cx="-14" cy="-16" r="4" fill="#5c4a58"/><circle cx="15" cy="-16" r="4" fill="#5c4a58"/><path d="M-9 10q9 12 20 0" fill="none" stroke="#aa7772" stroke-width="3"/></g>`;
const castle='<path d="M175 461V270h113v191m38 0V174h164v287m36 0V275h114v186" fill="#dfcbe1" stroke="#b59bbd" stroke-width="10"/><path d="M164 277l66-86 68 86m17-96 92-108 94 108m15 96 62-87 70 87" fill="#d5abc9" stroke="#fff0e1" stroke-width="8"/><g fill="#ffedb9"><rect x="216" y="313" width="28" height="50" rx="12"/><rect x="388" y="233" width="34" height="58" rx="13"/><rect x="574" y="313" width="28" height="50" rx="12"/></g>';
const fields='<path d="M0 480Q158 411 334 476T800 448V600H0" fill="#a2c69a"/><path d="M0 539Q200 474 410 535T800 499V600H0" fill="#e6c39c"/>';
const trees='<g fill="#87b297"><circle cx="86" cy="176" r="119"/><circle cx="706" cy="141" r="119"/></g><path d="M85 194v295m612-308v308" stroke="#9a7967" stroke-width="35"/>';
const sack='<path d="M-41-18h82l25 98q-66 37-132 0Z" fill="#d3b18f" stroke="#a78775" stroke-width="8"/><path d="M-39-20q43 21 79 0" stroke="#8c7f6b" stroke-width="12" fill="none"/>';
function scene(i:number):string {
 switch(i){
 case 0:return fields+cat(305,381,1.1)+miller(565,387,.9)+'<g transform="translate(130 469)">'+sack+'</g>';
 case 1:return fields+cat(373,382,1.14)+'<g transform="translate(580 469)">'+sack+'</g>';
 case 2:return fields+trees+cat(280,383,.96)+'<g transform="translate(577 454)">'+sack+'</g><path d="M564 417q46-61 93 0" fill="none" stroke="#eac36d" stroke-width="15"/>';
 case 3:return castle+cat(270,399,1)+royal(527,390,.9)+'<g transform="translate(368 461)">'+sack+'</g>';
 case 4:return fields+cat(194,394,.88)+miller(440,390,.97)+royal(617,385,.74);
 case 5:return trees+cat(291,392,.98)+'<path d="M466 430q65-90 120-2" fill="#b7a2b6" stroke="#88768b" stroke-width="10"/><path d="M528 423q-10-85 34-106" stroke="#88768b" stroke-width="13" fill="none"/>';
 case 6:return castle+cat(310,392,.9)+miller(522,385,.92)+'<path d="M135 480q150-70 250-22" fill="none" stroke="#eecf9e" stroke-width="15"/>';
 default:return castle+cat(220,400,.94)+miller(425,390,.91)+royal(624,385,.77)+'<g fill="#f8c6d0"><circle cx="130" cy="520" r="13"/><circle cx="675" cy="520" r="12"/></g>';
 }
}
export function pussBootsPageArtwork(pageIndex:number):string {
 const page=Math.max(0,Math.min(7,Number.isFinite(pageIndex)?Math.trunc(pageIndex):0));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Puss in Boots, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#f5dfc9"/><stop offset="1" stop-color="#dfedd8"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="659" cy="103" r="63" fill="#fff0b9"/><path d="M0 425Q201 333 401 412T800 381V600H0" fill="#bcd0aa"/>${fields}${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
