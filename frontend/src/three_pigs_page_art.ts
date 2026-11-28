/** Eight distinct offline scenes for the built-in Three Little Pigs.
 * Generated as static SVG data; no external requests or user media.
 */
const palette={sky:"#f8e9cd",leaf:"#83b692",grass:"#b7d7a0",earth:"#e4b889",ink:"#72525a"};
const pig=(x:number,y:number,size:number,shirt:string,hat=false)=>`<g transform="translate(${x} ${y}) scale(${size})">
 <ellipse cy="110" rx="58" ry="18" fill="#887475" opacity=".17"/>
 <path d="M-41 35Q-65 105-46 114H46Q65 105 41 35Z" fill="${shirt}"/>
 <path d="M-39 -29l-23-45 51 27m22 0 52-27-22 45" fill="#f5a5ae" stroke="#db8693" stroke-width="4"/>
 <circle cy="-11" r="47" fill="#f8b8bb" stroke="#dc9299" stroke-width="3"/>
 <circle cx="-15" cy="-17" r="5" fill="#523d4b"/><circle cx="17" cy="-17" r="5" fill="#523d4b"/>
 <ellipse cy="6" rx="22" ry="16" fill="#e996a3"/>
 <ellipse cx="-8" cy="6" rx="3" ry="5" fill="#a86078"/><ellipse cx="8" cy="6" rx="3" ry="5" fill="#a86078"/>
 <path d="M-9 27Q0 34 10 27" fill="none" stroke="#a45e73" stroke-width="3" stroke-linecap="round"/>
 <path d="M-42 58l-29 32m114-32 29 32" stroke="#f8b8bb" stroke-width="13" stroke-linecap="round"/>
 ${hat?'<path d="M-54-48Q0-82 54-48L45-37H-45Z" fill="#efbc64"/><path d="M-72-35Q0-50 72-35" stroke="#ce8d47" stroke-width="10" fill="none"/>':""}</g>`;
const house=(type:"straw"|"wood"|"brick",x:number,y:number,scale=1)=> {
 const fill={straw:"#edc46a",wood:"#c58b63",brick:"#d67c6c"}[type];
 const roof={straw:"#d8aa45",wood:"#8f614f",brick:"#a15b63"}[type];
 const detail=type==="straw"?Array.from({length:12},(_,i)=>`<path d="M${22+i*14} 40l-10 170" stroke="#f8e3a0" stroke-width="5"/>`).join(""):
 type==="wood"?Array.from({length:7},(_,i)=>`<path d="M17 ${38+i*24}H203" stroke="#e3b38a" stroke-width="5"/>`).join(""):
 Array.from({length:8},(_,i)=>`<path d="M15 ${39+i*24}H205M${i%2?52:90} ${39+i*24}v24M${i%2?146:160} ${39+i*24}v24" stroke="#f4c7b1" stroke-width="5"/>`).join("");
 return `<g transform="translate(${x} ${y}) scale(${scale})">
 <path d="M20 36h180v176H20Z" fill="${fill}" stroke="${roof}" stroke-width="7"/>
 ${detail}<path d="M0 37L110-50 220 37" fill="none" stroke="${roof}" stroke-width="26" stroke-linejoin="round"/>
 <rect x="89" y="115" width="47" height="97" rx="8" fill="#91666a"/>
 <rect x="37" y="70" width="37" height="40" rx="7" fill="#a6d6d1" stroke="#fff5d7" stroke-width="6"/>
 <rect x="152" y="70" width="37" height="40" rx="7" fill="#a6d6d1" stroke="#fff5d7" stroke-width="6"/>
 </g>`;
};
const wolf=(x:number,y:number,scale=1,blowing=false)=>`<g transform="translate(${x} ${y}) scale(${scale})">
 <path d="M-47 20l-23-82 52 30 48-34 45 89" fill="#858d96" stroke="#687583" stroke-width="6"/>
 <ellipse cy="83" rx="52" ry="59" fill="#8b949a"/>
 <circle cy="-6" r="52" fill="#9ea6a8"/>
 <ellipse cx="2" cy="19" rx="38" ry="25" fill="#eee2d5"/>
 <circle cx="-19" cy="-14" r="5" fill="#4b4754"/><circle cx="23" cy="-14" r="5" fill="#4b4754"/>
 <circle cx="1" cy="17" r="9" fill="#4d4753"/>
 <path d="M-13 40Q0 50 14 40" stroke="#69555d" fill="none" stroke-width="4" stroke-linecap="round"/>
 <path d="M-42 94l-30 40m115-40 30 40" stroke="#8b949a" stroke-width="17" stroke-linecap="round"/>
 ${blowing?'<path d="M58 0Q110-21 150 0M64 24Q135 12 185 30M55 48Q118 69 155 55" fill="none" stroke="#b5e0e4" stroke-width="9" stroke-linecap="round" opacity=".8"/>':""}</g>`;
const sun='<circle cx="658" cy="102" r="67" fill="#ffedb5"/>';
const meadow='<path d="M0 400Q168 335 346 404T800 388V600H0" fill="#a9c994"/><path d="M0 468Q210 399 410 474T800 435V600H0" fill="#8dbd8c"/><path d="M0 553Q150 503 325 552T800 535V600H0" fill="#d8b18b"/>';
const flowers=Array.from({length:14},(_,i)=>`<g transform="translate(${28+i*59} ${510+(i%3)*20})"><path d="M0 0v29" stroke="#668e69" stroke-width="4"/><circle cy="-5" r="10" fill="${i%2?"#fff6e4":"#f8b6c2"}"/><circle cy="-5" r="4" fill="#f3cf83"/></g>`).join("");
const stars='<g fill="#fff6de"><circle cx="140" cy="132" r="6"/><circle cx="310" cy="86" r="4"/><circle cx="514" cy="153" r="5"/></g>';
function scene(index:number):string{
 switch(index){
 case 0:return pig(235,346,.95,"#d98880",true)+pig(398,351,.95,"#edc569")+pig(554,354,.95,"#7f9cb6")+'<path d="M80 439Q230 420 320 448T620 441" stroke="#e5c7a2" stroke-width="20" fill="none"/>';
 case 1:return house("straw",350,224,1.25)+pig(211,390,.9,"#d98880",true)+'<g stroke="#f9df9c" stroke-width="7" stroke-linecap="round"><path d="M140 405l55-30M122 429l75-12M190 467l80-28"/></g>';
 case 2:return house("wood",360,210,1.25)+pig(202,391,.91,"#edc569")+'<path d="M154 452L290 320" stroke="#aa785f" stroke-width="17"/><rect x="111" y="442" width="120" height="21" rx="7" fill="#b78563"/>';
 case 3:return house("brick",334,170,1.48)+pig(193,400,.92,"#7f9cb6")+'<g fill="#cd776c"><rect x="70" y="450" width="100" height="46" rx="6"/><rect x="92" y="403" width="76" height="38" rx="5"/></g>';
 case 4:return house("straw",426,242,.95)+wolf(178,358,1.1,true)+pig(605,420,.7,"#d98880",true)+'<g stroke="#dfb95d" stroke-width="8" stroke-linecap="round"><path d="M500 315l72-42M518 390l85-20M560 452l90 25"/></g>';
 case 5:return house("wood",440,230,1.03)+wolf(177,347,1.08,true)+pig(559,440,.67,"#edc569")+pig(657,452,.55,"#d98880",true)+'<path d="M450 277l-76-93M520 330l60-76" stroke="#c08b66" stroke-width="17" stroke-linecap="round"/>';
 case 6:return house("brick",340,150,1.5)+wolf(183,424,.67,true)+pig(503,377,.6,"#d98880",true)+pig(574,375,.6,"#edc569")+pig(645,381,.6,"#7f9cb6");
 default:return house("brick",350,110,1.2)+wolf(250,430,.67,false)+pig(355,426,.64,"#d98880",true)+pig(460,425,.64,"#edc569")+pig(559,425,.64,"#7f9cb6")+'<g transform="translate(336 462)"><rect width="190" height="24" rx="7" fill="#f6e7d7"/><path d="M27 0v44m143-44v44" stroke="#a87865" stroke-width="12"/><ellipse cx="96" cy="0" rx="38" ry="11" fill="#e6ac7f"/></g>';
 }
}
export function threePigsPageArtwork(pageIndex:number):string{
 const page=Math.max(0,Math.min(7,Number.isFinite(pageIndex)?Math.trunc(pageIndex):0));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img"><title>The Three Little Pigs, page ${page+1}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#f6e5ca"/><stop offset="1" stop-color="#d9ecdc"/></linearGradient></defs><rect width="800" height="600" fill="url(#sky)"/>${sun}${stars}${meadow}${flowers}${scene(page)}</svg>`;
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
