/** Eight original, child-friendly Hansel and Gretel vector scenes.
 * Bundled and deterministic; no child photos or external image requests.
 */
const child=(x:number,y:number,s=1,girl=false)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="145" rx="56" ry="13" fill="#745c65" opacity=".15"/><path d="M-37 37Q-60 103-49 141H49Q60 100 37 37Z" fill="${girl?"#eaa3a0":"#79a6b6"}"/><circle cy="-17" r="43" fill="#f1c6a4"/><path d="M-44-24Q-37-79 8-66Q45-60 44-16L25-42Q-6-16-44-24" fill="${girl?"#a77559":"#836249"}"/><circle cx="-14" cy="-17" r="4" fill="#594554"/><circle cx="15" cy="-17" r="4" fill="#594554"/><path d="M-9 8Q0 15 10 8" fill="none" stroke="#bc7772" stroke-width="3"/><path d="M-37 69l-34 40m107-40 34 40" fill="none" stroke="#f1c6a4" stroke-width="12" stroke-linecap="round"/>${girl?'<path d="M-40 2q-24 38-12 65m90-64q25 38 12 65" stroke="#a77559" stroke-width="15" fill="none"/>':""}</g>`;
const children=(x=281,y=375,s=1)=>child(x,y,s,false)+child(x+155*s,y+5*s,s,true);
const trees='<g fill="#639481"><circle cx="70" cy="146" r="132"/><circle cx="183" cy="88" r="101"/><circle cx="733" cy="152" r="132"/><circle cx="601" cy="90" r="91"/></g><path d="M76 130v340m644-350v342" stroke="#997764" stroke-width="39"/>';
const ginger='<g><path d="M229 453V281L401 163 569 281v172Z" fill="#d9a071" stroke="#b77c62" stroke-width="12"/><path d="M204 290L401 140 600 290" fill="none" stroke="#f8e2be" stroke-width="38" stroke-linejoin="round"/><path d="M357 450V343Q401 311 447 343V450Z" fill="#b77d71"/><rect x="258" y="300" width="64" height="68" rx="12" fill="#9fc8d1" stroke="#fff6e5" stroke-width="10"/><rect x="483" y="300" width="64" height="68" rx="12" fill="#9fc8d1" stroke="#fff6e5" stroke-width="10"/><g fill="#f6b7bf"><circle cx="290" cy="281" r="15"/><circle cx="379" cy="205" r="16"/><circle cx="472" cy="208" r="16"/><circle cx="539" cy="275" r="15"/></g><g fill="#fff3d3"><circle cx="260" cy="421" r="12"/><circle cx="541" cy="425" r="12"/></g></g>';
const basket='<g><path d="M-45-12h90l-14 68h-65Z" fill="#b58c68" stroke="#956d60" stroke-width="6"/><path d="M-30-12Q0-76 30-12" fill="none" stroke="#956d60" stroke-width="9"/><ellipse cy="-18" rx="37" ry="15" fill="#eed5a3"/></g>';
const sun='<circle cx="660" cy="104" r="68" fill="#fff0ba"/>';
const path='<path d="M194 600Q283 452 381 385Q473 450 627 600" fill="#e8c7a7"/>';
function scene(page:number):string {
 switch(page) {
  case 0:return trees+path+children(260,384,1.02)+'<g fill="#efd9ae"><circle cx="208" cy="478" r="7"/><circle cx="185" cy="497" r="6"/><circle cx="154" cy="518" r="7"/></g>';
  case 1:return trees+path+children(270,387,.94)+'<g fill="#fff4dd"><circle cx="230" cy="498" r="7"/><circle cx="185" cy="520" r="7"/><circle cx="148" cy="542" r="6"/><circle cx="105" cy="557" r="5"/></g>';
  case 2:return trees+path+ginger+children(95,418,.63);
  case 3:return trees+ginger+children(193,396,.75)+'<g transform="translate(620 471)">'+basket+'</g>';
  case 4:return '<rect x="78" y="125" width="645" height="370" rx="24" fill="#f1d6b2"/><path d="M80 405h642" stroke="#c2987a" stroke-width="18"/><rect x="484" y="181" width="174" height="167" rx="22" fill="#b4d4d2" stroke="#fff7e4" stroke-width="13"/>'+children(191,363,.95)+'<g transform="translate(585 453)">'+basket+'</g>';
  case 5:return trees+ginger+children(188,402,.78)+'<path d="M490 450Q560 400 658 440" fill="none" stroke="#ffe8aa" stroke-width="15"/>';
  case 6:return trees+path+children(270,387,1)+'<g transform="translate(545 505)">'+basket+'</g><g fill="#fbebb5"><circle cx="192" cy="280" r="8"/><circle cx="585" cy="245" r="9"/></g>';
  default:return '<path d="M95 439V276l167-118 170 118v163" fill="#f8e3c6" stroke="#b68d73" stroke-width="12"/><path d="M72 281l190-142 195 142" fill="none" stroke="#ac7770" stroke-width="27"/><rect x="219" y="324" width="81" height="115" rx="12" fill="#b98d77"/>'+children(430,388,.92)+'<g transform="translate(655 473)">'+basket+'</g>';
 }
}
export function hanselGretelPageArtwork(index:number):string {
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Hansel and Gretel, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#f9e9cb"/><stop offset="1" stop-color="#d5e7d3"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/>${sun}<path d="M0 412Q170 322 397 397T800 382V600H0" fill="#bed3ad"/><path d="M0 509Q230 423 408 483T800 465V600H0" fill="#99c0a1"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
