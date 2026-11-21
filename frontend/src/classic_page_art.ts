import { classics } from "./classics";
import { redHoodPageArtwork } from "./red_hood_page_art";

/**
 * Offline, page-specific illustrations for the 30 built-in classics.
 * These are original vector fallbacks, not generated PNGs or user uploads.
 * Custom photos and server-owned illustrations always take priority.
 */
const ids = new Set(classics.map(item => item.id));
const groups: Record<string, string[]> = {
  forest: ["hansel-gretel","snow-white","goldilocks","kolobok","masha-bears","twelve-months","teremok","ryaba","turnip"],
  castle: ["cinderella","rapunzel","sleeping-beauty","princess-pea","snow-queen","aladdin","emperor-clothes"],
  village: ["three-pigs","pinocchio","elves-shoemaker","bremen","puss-boots","ali-baba"],
  water: ["ugly-duckling","little-mermaid","frog-prince","fisherman-fish"],
  fantasy: ["jack-beanstalk","thumbelina","nutcracker"]
};
const colors: Record<string, [string,string,string]> = {
  forest:["#f6e7be","#b6d3ad","#618a71"],
  castle:["#e8dafa","#b5b9e1","#8f78ad"],
  village:["#f7e2c2","#e7bc91","#a76e71"],
  water:["#e1f0ed","#a5d7d4","#5e9db8"],
  fantasy:["#f9dbeb","#d0c0ee","#947cba"]
};
function escapeXml(value:string):string {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
function scenery(theme:string, page:number, accent:string):string {
  if(theme==="castle")return `<g transform="translate(${(page%4-1)*24} 0)"><path d="M170 470V265h115v205m20 0V190h180v280m20 0V270h125v200" fill="#f4dfeb" stroke="${accent}" stroke-width="10"/><path d="M160 270l68-80 66 80m2-75 101-107 101 107m0 80 70-77 70 77" fill="#edb5c9" stroke="${accent}" stroke-width="8"/><path d="M368 470V372q26-46 54 0v98" fill="#9c7b96"/><g fill="#fce8a8"><rect x="222" y="315" width="22" height="42" rx="10"/><rect x="360" y="252" width="23" height="45" rx="10"/><rect x="444" y="252" width="23" height="45" rx="10"/><rect x="555" y="325" width="23" height="45" rx="10"/></g></g>`;
  if(theme==="water")return `<path d="M0 375Q100 330 200 375T400 375T600 375T800 375V600H0" fill="#69b5c5"/><path d="M0 415Q100 382 200 415T400 415T600 415T800 415" stroke="#e5f7f1" stroke-width="12" fill="none"/><path d="M185 435Q310 355 435 435L390 490H235Z" fill="#b98371"/><path d="M310 355V245l125 95Z" fill="#fff4d7"/><path d="M310 247v190" stroke="#806a77" stroke-width="8"/><g fill="#fff8e5"><circle cx="610" cy="395" r="15"/><circle cx="650" cy="410" r="10"/></g>`;
  if(theme==="village")return `<path d="M135 467V303L264 206 391 303v164Z" fill="#f8d4aa" stroke="${accent}" stroke-width="9"/><path d="M105 303l158-128 160 128" fill="none" stroke="#a96e63" stroke-width="30" stroke-linejoin="round"/><rect x="222" y="354" width="80" height="113" rx="9" fill="#a87968"/><rect x="154" y="325" width="54" height="54" rx="10" fill="#d5f3e4"/><path d="M500 460V310l90-65 90 65v150Z" fill="#f5e2bd" stroke="#b58d80" stroke-width="8"/><path d="M480 315l110-91 111 91" stroke="#bd8a80" stroke-width="20" fill="none"/>`;
  if(theme==="fantasy")return `<path d="M350 600Q290 470 365 380T370 170" stroke="#6aa783" stroke-width="45" fill="none"/><path d="M360 420q-135-135-190-10 115 105 190 10m3-125q130-138 188-20-107 113-188 20" fill="#85bc90"/><g transform="translate(415 250)"><circle r="95" fill="#fff1d1"/><g fill="#e9b8d7"><ellipse cy="-99" rx="49" ry="93"/><ellipse cy="99" rx="49" ry="93"/><ellipse cx="-99" rx="93" ry="49"/><ellipse cx="99" rx="93" ry="49"/></g><circle r="55" fill="#ffdf9c"/></g>`;
  return `<path d="M100 480l30-310h60l35 310m385 0 25-345h65l30 345" fill="#ad8471"/><g fill="#78a485"><circle cx="160" cy="165" r="125"/><circle cx="655" cy="123" r="134"/><circle cx="270" cy="125" r="75"/></g><path d="M270 600q100-210 190-210t190 210" fill="#efcca0"/>`;
}
function subject(id:string,page:number):string {
  const variant = page%4;
  const name = id.split("-").join(" ");
  const hues = ["#a85e77","#5e8d9b","#c18a65","#8a77ac"];
  const hue=hues[variant];
  const x=185+(page%3)*90;
  const y=365+(page%2)*16;
  const animal=/pigs|duckling|bremen|boots|frog|bears|fish|ryaba|kolobok|teremok/.test(id);
  if(animal)return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="90" rx="68" ry="54" fill="${hue}"/><circle cx="0" cy="0" r="62" fill="${hue}"/><path d="M-50 -33l-25-55 65 28m22 0 62-28-25 55" fill="${hue}"/><circle cx="-22" cy="-5" r="6" fill="#493e4b"/><circle cx="22" cy="-5" r="6" fill="#493e4b"/><ellipse cy="30" rx="19" ry="12" fill="#f9dfd2"/><path d="M-25 68l-30 56m83-56 30 56" stroke="${hue}" stroke-width="15" stroke-linecap="round"/></g>`;
  return `<g transform="translate(${x} ${y})"><path d="M-48 80Q-75 140-85 175H86Q74 116 49 80Z" fill="${hue}"/><circle cx="0" cy="0" r="49" fill="#f2c6a5"/><path d="M-50 0Q-50-68 2-63Q60-50 50 5L32-28Q-5-10-50 0" fill="#735460"/><circle cx="-15" cy="5" r="4" fill="#55424c"/><circle cx="16" cy="5" r="4" fill="#55424c"/><path d="M-11 25Q0 34 13 25" fill="none" stroke="#aa6d69" stroke-width="4" stroke-linecap="round"/><path d="M-45 102l-50 45m139-45 53 40" stroke="#f2c6a5" stroke-width="14" stroke-linecap="round"/></g>`;
}
export function classicPageArtwork(classicId:string,pageIndex:number):string {
 if(classicId==="red-hood")return redHoodPageArtwork(pageIndex);
 const item=classics.find(x=>x.id===classicId);
 if(!item)return "";
 const page=Math.max(0,Math.min(29,Math.trunc(Number.isFinite(pageIndex)?pageIndex:0)));
 const group=Object.keys(groups).find(key=>groups[key].includes(classicId))||"fantasy";
 const [sky,hill,accent]=colors[group];
 const shift=(page*71)%400;
 const title=escapeXml(item.title.ru);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>${title}, scene ${page+1}</title><defs><linearGradient id="background" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#fff9ea"/></linearGradient></defs><rect width="800" height="600" fill="url(#background)"/><circle cx="${615-shift/3}" cy="${90+page%3*17}" r="66" fill="#fff1be"/><path d="M0 430Q180 ${300+page%3*20} 385 420T800 395V600H0" fill="${hill}"/><path d="M0 520Q250 432 450 505T800 480V600H0" fill="${accent}" opacity=".38"/>${scenery(group,page,accent)}${subject(classicId,page)}<g fill="#fff5d5"><circle cx="${95+shift}" cy="105" r="8"/><circle cx="${705-shift/2}" cy="206" r="5"/><circle cx="480" cy="76" r="7"/></g><path d="M0 570Q200 548 400 570T800 570V600H0" fill="#fff2d7" opacity=".35"/></svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
/** Only replace built-in placeholder artwork, never custom illustrations. */
export function classicReaderImage(classicId:string|undefined,imageUrl:string,pageIndex:number):string {
 if(!classicId||!ids.has(classicId))return imageUrl;
 const oldAsset=imageUrl==="/images/classics/"+classicId+".webp"||imageUrl==="/images/classics/"+classicId+".svg";
 const oldRedHood=/^\/images\/classics\/red-hood\/(?:pages|watercolor)\/page-[1-8]\.png$/.test(imageUrl);
 // Data URLs may contain personalized artwork; never override them.
 if(!oldAsset&&!oldRedHood&&imageUrl.trim()!=="")return imageUrl;
 return `/images/classics/${classicId}/pages/page-${Math.max(1,Math.min(8,Math.trunc(pageIndex)+1))}.png`;
}

/** When a bundled PNG has not yet been installed, use the deterministic local art. */
export function classicPngFallback(url:string):string|null {
 const match = /^\/images\/classics\/([a-z0-9-]+)\/pages\/page-([1-8])\.png$/.exec(url);
 return match&&ids.has(match[1])?classicPageArtwork(match[1],Number(match[2])-1):null;
}
