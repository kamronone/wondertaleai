/** Eight original, deterministic Sleeping Beauty scenes for offline reading.
 * These are local illustrations, not remotely generated pictures.
 */
const castle='<g><path d="M138 465V267h105v198m25 0V178h265v287m26 0V267h109v198" fill="#e0cae0" stroke="#b99eb9" stroke-width="10"/><path d="M122 273l68-93 69 93m3-89 139-119 141 119m8 89 66-93 68 93" fill="#d9a9c4" stroke="#fff0e1" stroke-width="8"/><rect x="362" y="329" width="82" height="136" rx="29" fill="#a1869d"/><g fill="#ffe8b9"><rect x="174" y="307" width="27" height="54" rx="11"/><rect x="378" y="230" width="48" height="70" rx="13"/><rect x="604" y="307" width="27" height="54" rx="11"/></g></g>';
const girl=(x:number,y:number,s=1,asleep=false)=>`<g transform="translate(${x} ${y}) scale(${s})">
<ellipse cy="151" rx="69" ry="16" fill="#826b87" opacity=".17"/>
<path d="M-44 40Q-73 93-82 152Q0 173 81 152Q68 97 41 40Z" fill="#ebacc2" stroke="#d596ae" stroke-width="5"/>
<path d="M-39 40Q0 30 38 40v64Q0 119-38 104Z" fill="#f9d4dc"/>
<circle cy="-20" r="44" fill="#f5ceb5"/><path d="M-44-20Q-51-79 10-73Q58-59 43-9L25-47Q-8-25-44-20Z" fill="#c49b67"/>
<path d="M-23-66l14-15 15 14 17-14 15 14" fill="none" stroke="#e9c46b" stroke-width="8"/>
${asleep?'<path d="M-24-18q9 10 18 0m18 0q9 10 18 0" fill="none" stroke="#806775" stroke-width="3"/>':'<circle cx="-15" cy="-18" r="4" fill="#5c4755"/><circle cx="16" cy="-18" r="4" fill="#5c4755"/>'}
<path d="M-9 6Q0 14 11 6" stroke="#ad777c" stroke-width="3" fill="none"/>
<path d="M-42 62l-38 44m122-44 38 44" stroke="#f5ceb5" stroke-width="12" stroke-linecap="round"/>
</g>`;
const prince=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-48 41Q-63 113-56 151H56Q62 112 47 41Z" fill="#91a6c5"/><circle cy="-17" r="43" fill="#f0c4a9"/><path d="M-44-20Q-38-79 17-69Q54-57 42-17" fill="#85674f"/><path d="M-27-65l18-13 17 12 18-13 14 17" fill="none" stroke="#e4ba63" stroke-width="8"/><circle cx="-14" cy="-16" r="4" fill="#4e4354"/><circle cx="17" cy="-16" r="4" fill="#4e4354"/><path d="M-9 9Q0 17 11 9" stroke="#a77871" stroke-width="3" fill="none"/><path d="M-46 62l-38 44m128-44 38 44" stroke="#f0c4a9" stroke-width="12" stroke-linecap="round"/></g>`;
const fairy=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-43 39Q-68 103-75 152Q0 174 77 152Q56 96 43 39Z" fill="#a5b7d9"/><circle cy="-15" r="41" fill="#f4cfb7"/><path d="M-40-23Q-43-67 6-71Q50-69 42-18" fill="#d4c8be"/><path d="M39 69l100-103" stroke="#d9addb" stroke-width="8"/><path d="M140-42l12-31 13 31 32 13-32 12-13 31-12-31-31-12Z" fill="#fff0ae"/></g>`;
const spindle='<g><path d="M0-99v219M-18-80h36M-52 99h104" stroke="#967f80" stroke-width="11" stroke-linecap="round"/><ellipse cy="-13" rx="39" ry="23" fill="#d9ad87"/><path d="M0-99q60 73 0 145" stroke="#efe2d0" stroke-width="8" fill="none"/></g>';
const forest='<g fill="#77a18a"><circle cx="80" cy="184" r="124"/><circle cx="168" cy="99" r="95"/><circle cx="709" cy="163" r="139"/><circle cx="591" cy="99" r="101"/></g><path d="M89 184v291m618-308v308" stroke="#9c826c" stroke-width="39"/>';
const bed='<g><path d="M164 416h465v65H164Z" fill="#cbb5d3" stroke="#ad96b6" stroke-width="10"/><path d="M160 302v173m470-173v173" stroke="#ad8b8f" stroke-width="22"/><path d="M177 353q208-64 436 0v79H177Z" fill="#f7e7dc"/><path d="M179 367q213-55 432 0" stroke="#edc5d6" stroke-width="14" fill="none"/></g>';
const flowers=Array.from({length:12},(_,i)=>`<g transform="translate(${35+i*67} ${518+(i%3)*20})"><path d="M0 20V0" stroke="#699577" stroke-width="4"/><circle cy="-6" r="10" fill="${i%2?"#f3b5ca":"#ffefba"}"/></g>`).join("");
const confetti=Array.from({length:17},(_,i)=>`<circle cx="${35+(i*149)%730}" cy="${78+(i*79)%285}" r="${4+i%4}" fill="${i%2?"#f7d397":"#ecc2d9"}"/>`).join("");
function scene(page:number):string {
 switch(page){
 case 0:return castle+girl(401,362,.92)+fairy(597,372,.8)+confetti;
 case 1:return castle+girl(302,371,.89)+fairy(539,376,.82)+flowers;
 case 2:return '<path d="M110 451V168h570v283" fill="#edd9c5" stroke="#c9ac9e" stroke-width="13"/>'+girl(304,360,1.04)+'<g transform="translate(583 322)">'+spindle+'</g>';
 case 3:return bed+girl(411,343,.76,true)+'<g fill="#fff6d6"><circle cx="282" cy="201" r="7"/><circle cx="520" cy="235" r="8"/><circle cx="611" cy="184" r="5"/></g>';
 case 4:return forest+castle+'<path d="M175 491q30-86 67-9m341-7q32-110 57 4" fill="none" stroke="#6a9b7d" stroke-width="20"/>';
 case 5:return forest+prince(327,380,.98)+castle+'<path d="M209 492q66-105 99-58m243 32q66-110 90-47" stroke="#6a9b7d" stroke-width="16" fill="none"/>';
 case 6:return bed+girl(385,348,.83,false)+prince(586,368,.72)+flowers;
 default:return castle+girl(304,377,.97)+prince(508,383,.93)+flowers+confetti;
 }
}
export function sleepingBeautyPageArtwork(index:number):string{
 const page=Math.max(0,Math.min(7,Number.isFinite(index)?Math.trunc(index):0));
 const dawn=page===5||page===6||page===7;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><title>Sleeping Beauty, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${dawn?"#f8d8cc":"#ded4e9"}"/><stop offset="1" stop-color="#f5e9d8"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/><circle cx="654" cy="104" r="61" fill="#fff1be"/><path d="M0 420Q181 326 401 401T800 398V600H0" fill="#bdd4b3"/><path d="M0 513Q177 445 392 507T800 477V600H0" fill="#91baa1"/>${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
