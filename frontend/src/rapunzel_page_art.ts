/** Eight original page-specific offline scenes for Rapunzel. */
const tower='<path d="M310 473V171h183v302Z" fill="#d6c6db" stroke="#ae92ae" stroke-width="10"/><path d="M286 178L397 78l120 100" fill="#e6a8c5" stroke="#fff0dd" stroke-width="10" stroke-linejoin="round"/><rect x="366" y="224" width="73" height="105" rx="30" fill="#8d718e" stroke="#fff1e7" stroke-width="10"/><path d="M367 473v-82q31-33 64 0v82" fill="#927891"/>';
const trees='<g fill="#80ad90"><circle cx="114" cy="148" r="114"/><circle cx="67" cy="222" r="96"/><circle cx="679" cy="132" r="121"/><circle cx="748" cy="226" r="84"/></g><path d="M115 178v309m569-328v333" stroke="#a18372" stroke-width="37"/>';
const rapunzel=(x:number,y:number,s=1,long=true)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="134" rx="63" ry="13" fill="#6f5671" opacity=".15"/><path d="M-36 34Q-65 96-75 139H76Q57 93 36 34Z" fill="#bf91c6"/><circle cy="-13" r="41" fill="#f2c9b1"/><path d="M-40-16Q-53-72 0-68Q57-69 41-10Q5-33-40-16Z" fill="#efd18c"/>${long?'<path d="M-40-25Q-62 95-42 188M37-32Q85 78 68 185" stroke="#efd18c" stroke-width="18" fill="none" stroke-linecap="round"/>':""}<circle cx="-14" cy="-13" r="4" fill="#54435b"/><circle cx="15" cy="-13" r="4" fill="#54435b"/><path d="M-8 9Q1 17 11 8" stroke="#b57978" stroke-width="3" fill="none"/><path d="M-35 64l-42 44m113-44 42 44" stroke="#f2c9b1" stroke-width="12" stroke-linecap="round"/></g>`;
const traveler=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-44 37Q-61 99-53 147H56Q56 99 43 37Z" fill="#8b9bb2"/><circle cy="-11" r="42" fill="#ecc3a4"/><path d="M-40-18Q-38-72 3-64Q43-60 41-17" fill="#84634f"/><circle cx="-14" cy="-14" r="4" fill="#4e4454"/><circle cx="16" cy="-14" r="4" fill="#4e4454"/><path d="M-9 10Q0 18 11 10" fill="none" stroke="#ab7473" stroke-width="3"/><path d="M-42 58l-37 49m119-49 37 49" stroke="#ecc3a4" stroke-width="12" stroke-linecap="round"/></g>`;
const flowers=Array.from({length:10},(_,i)=>`<g transform="translate(${35+i*79} ${526+(i%3)*13})"><path d="M0 22V0" stroke="#6d9c75" stroke-width="4"/><circle cy="-6" r="9" fill="${i%2?"#f5c5d0":"#fff2ba"}"/></g>`).join("");
const birds='<path d="M155 183q17-22 34 0q17-22 34 0m400 45q15-20 30 0q15-20 30 0" fill="none" stroke="#8e7d9c" stroke-width="6" stroke-linecap="round"/>';
function scene(page:number):string {
 switch(page){
 case 0:return trees+tower+rapunzel(402,261,.44,true)+birds;
 case 1:return trees+tower+rapunzel(404,252,.48,true)+'<path d="M401 268q-27 101-18 233" stroke="#efce85" stroke-width="20" fill="none"/>';
 case 2:return trees+tower+rapunzel(402,256,.46,true)+traveler(608,397,.77)+flowers;
 case 3:return tower+rapunzel(405,254,.47,true)+traveler(572,398,.78)+'<path d="M395 258Q345 358 338 507" stroke="#efd18c" stroke-width="22" fill="none"/>';
 case 4:return trees+tower+rapunzel(400,262,.48,true)+traveler(555,406,.7)+'<path d="M220 485Q290 435 341 474" stroke="#eabbd8" stroke-width="14" fill="none"/>';
 case 5:return trees+rapunzel(290,369,1,true)+traveler(536,374,.95)+flowers;
 case 6:return '<path d="M66 443V275l157-106 159 106v168" fill="#f4ddc5" stroke="#a88d85" stroke-width="11"/><path d="M40 283L223 148 406 283" stroke="#b48b83" stroke-width="25" fill="none"/>'+rapunzel(435,377,.87,true)+traveler(607,387,.81)+flowers;
 default:return trees+rapunzel(318,369,1.08,true)+traveler(520,379,.96)+flowers+birds;
 }
}
export function rapunzelPageArtwork(index:number):string {
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Rapunzel, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#ead9ed"/><stop offset="1" stop-color="#f9e8d5"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="651" cy="108" r="63" fill="#fff1ba"/><path d="M0 412Q195 333 404 409T800 385V600H0" fill="#b5d2ac"/><path d="M0 509Q190 447 410 503T800 475V600H0" fill="#94bd9b"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
