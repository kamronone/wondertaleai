import type { Classic } from "./classics";

// Original illustrated SVG scenes, rendered locally (no third-party media or image requests).
// These are editorial cover illustrations, not AI-generated child likenesses.
export function ClassicCover({item}:{item:Classic}){
 const id=item.id;
 // These six are genuine generated artwork, stored in this repository.
 const illustrated=["red-hood","cinderella","three-pigs","snow-white","ugly-duckling","bremen"];
 if(illustrated.includes(id)){
   return <img className="classic-generated-image" src={"/images/classics/"+id+".svg"} alt={item.title.ru} loading="lazy" decoding="async"/>;
 }
 const isForest=["red-hood","hansel-gretel","kolobok","teremok","snow-white","twelve-months"].includes(id)||item.icon==="forest";
 const isCastle=["cinderella","rapunzel","sleeping-beauty","princess-pea","snow-queen","aladdin","nutcracker"].includes(id)||item.icon==="castle";
 const isWater=["ugly-duckling","little-mermaid","fisherman-fish"].includes(id);
 const isHouse=["three-pigs","goldilocks","masha-bears","elves-shoemaker","turnip"].includes(id)||item.icon==="houses";
 const isMusic=["bremen","nutcracker"].includes(id)||item.icon==="music";
 const isFlower=["thumbelina","frog-prince","snow-white"].includes(id);
 const palettes:{[key:string]:[string,string,string]}={
 rose:["#483063","#a35387","#ffe0aa"],blue:["#182e66","#637fc7","#ffc7cf"],orange:["#634464","#cf8c6d","#ffe3ab"],
 green:["#173e55","#488781","#c7e4ac"],lilac:["#3c3c80","#9a80c9","#ffdcf7"],violet:["#231b61","#814da0","#e9aff7"]
 };
 const [night,sky,glow]=palettes[item.color]||palettes.violet;
 const uid="cover-"+id.replace(/[^a-z0-9-]/g,"");
 return <svg className="classic-scene" viewBox="0 0 400 280" role="img" aria-label={item.title.ru} xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id={uid+"-sky"} x1="0" x2=".2" y1="0" y2="1"><stop stopColor={night}/><stop offset="1" stopColor={sky}/></linearGradient>
    <radialGradient id={uid+"-light"}><stop stopColor={glow} stopOpacity=".85"/><stop offset="1" stopColor={glow} stopOpacity="0"/></radialGradient>
    <linearGradient id={uid+"-hill"} x1="0" x2=".6" y1="0" y2="1"><stop stopColor="#45798a"/><stop offset="1" stopColor="#203856"/></linearGradient>
  </defs>
  <rect width="400" height="280" fill={"url(#"+uid+"-sky)"}/>
  <circle cx="294" cy="62" r="106" fill={"url(#"+uid+"-light)"}/>
  <circle cx="294" cy="65" r="36" fill="#ffecc5" opacity=".94"/>
  <g fill="#fff4d2">{Array.from({length:18},(_,i)=><circle key={i} cx={(i*89+26)%398} cy={(i*47+15)%175} r={i%4===0?2.6:1.5} opacity={.48+(i%4)*.12}/>)}</g>
  <path d="M0 208 Q80 150 167 206 Q261 139 400 194 V280 H0Z" fill={isWater?"#377f9b":"#6e6395"} opacity=".52"/>
  <path d="M0 237 Q85 177 179 236 Q287 173 400 226 V280 H0Z" fill={"url(#"+uid+"-hill)"} opacity=".94"/>
  {isForest&&<g>
    {[[27,152,.98],[74,182,.75],[340,167,.86],[382,173,.72]].map(([x,y,k],i)=><g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
      <path d="M-7 88H7V13H-7Z" fill="#4a3454"/><path d="M0 -45 -40 39H40Z" fill="#244f59"/><path d="M0 -8 -36 59H36Z" fill="#2a6267"/><path d="M0 25 -34 77H34Z" fill="#33777a"/>
    </g>)}
    <path d="M146 269 Q177 226 204 212 Q229 221 254 263" stroke="#d8b499" strokeWidth="18" fill="none" opacity=".7"/>
    {id==="red-hood"&&<g transform="translate(154 160)"><path d="M20 -13Q55 -18 73 17L70 58H11L5 17Z" fill="#c3415d"/><circle cx="41" cy="18" r="21" fill="#ffe2bd"/><path d="M12 8Q20 -24 47 -20Q71 -16 72 11Q46 -3 12 8Z" fill="#ae284f"/><path d="M14 43L67 39L81 110H0Z" fill="#cd3653"/><path d="M35 17h3m17 0h3" stroke="#60435d" strokeWidth="3" strokeLinecap="round"/><path d="M38 29Q47 35 56 29" stroke="#b86f76" fill="none" strokeWidth="2"/></g>}
    {id==="snow-white"&&<g transform="translate(144 155)"><path d="M32 36L63 35L94 118H0Z" fill="#f2d375"/><path d="M27 36L70 36L62 73H35Z" fill="#4769ab"/><circle cx="49" cy="18" r="21" fill="#ffe0be"/><path d="M28 19Q18 -21 45 -20Q78 -13 68 29L62 5Q45 17 28 19Z" fill="#242847"/><path d="M42 -17l10 -12 14 14" stroke="#d84f69" strokeWidth="8" fill="none"/></g>}
  </g>}
  {isCastle&&<g transform="translate(144 104)" strokeLinejoin="round">
    <path d="M16 80V18H70V81M74 80V-4H126V81M129 81V18H185V81Z" fill="#8a74b2" stroke="#f9c4bf" strokeWidth="3"/>
    <path d="M8 22L43 -21L78 22ZM67 0L100 -53L135 0ZM122 22L157 -21L192 22Z" fill="#f3b2bf" stroke="#ffd5ba" strokeWidth="3"/>
    <path d="M90 80V39Q100 21 110 39V80" fill="#4d356e"/><g fill="#ffe6aa">{[29,54,85,117,143,171].map((x,i)=><rect key={i} x={x} y={i%2?35:48} width="9" height="15" rx="4"/>)}</g>
    <path d="M100 -54V-75" stroke="#ffecc9" strokeWidth="4"/><path d="M100 -75l27 10-27 9" fill="#ffdc95"/>
    {id==="rapunzel"&&<path d="M110 25Q145 67 137 134Q113 165 146 179" stroke="#ffe59d" strokeWidth="10" fill="none" strokeLinecap="round"/>}
  </g>}
  {isHouse&&<g transform="translate(114 115)">
    <path d="M15 60L90 -2 168 60V137H15Z" fill="#e4b292" stroke="#fce5ba" strokeWidth="5"/>
    <path d="M0 66L91 -25 184 66" fill="none" stroke="#8f4764" strokeWidth="22" strokeLinejoin="round"/>
    <path d="M77 137V83Q90 67 103 83V137Z" fill="#775064"/><rect x="35" y="78" width="25" height="23" rx="4" fill="#ffe9a4"/><rect x="124" y="78" width="25" height="23" rx="4" fill="#ffe9a4"/>
    {id==="three-pigs"&&[0,1,2].map(i=><g key={i} transform={`translate(${-25+i*48} 139)`}><circle cx="0" cy="0" r="19" fill="#f6b2ad"/><circle cx="-17" cy="-13" r="9" fill="#f6b2ad"/><circle cx="17" cy="-13" r="9" fill="#f6b2ad"/><ellipse cx="0" cy="9" rx="10" ry="8" fill="#e79191"/><circle cx="-7" cy="-2" r="2" fill="#593a55"/><circle cx="7" cy="-2" r="2" fill="#593a55"/></g>)}
  </g>}
  {isWater&&<g>
    <path d="M0 213Q44 203 82 215T165 211T252 212T344 214T400 210V280H0" fill="#3e7eac" opacity=".87"/>
    {[226,247,262].map((y,i)=><path key={i} d={`M-10 ${y} Q35 ${y-11} 82 ${y} T176 ${y} T270 ${y} T410 ${y}`} fill="none" stroke="#e9d4ec" strokeWidth="3" opacity=".5"/>)}
    {id==="ugly-duckling"&&<g><ellipse cx="176" cy="204" rx="52" ry="31" fill="#fff0d2"/><path d="M176 191Q178 128 211 127Q239 129 228 152Q221 165 209 159" stroke="#fff1d8" strokeWidth="24" fill="none" strokeLinecap="round"/><circle cx="219" cy="144" r="3.5" fill="#40365a"/><path d="M233 148L257 153L233 161Z" fill="#ecae82"/><ellipse cx="280" cy="234" rx="25" ry="17" fill="#f9daae"/><circle cx="300" cy="216" r="11" fill="#f9daae"/><path d="M310 216l17 6-17 5" fill="#e6aa79"/></g>}
    {id!=="ugly-duckling"&&<g><path d="M185 191Q202 150 242 172Q271 198 245 228Q218 249 195 220Z" fill="#e9bb8e"/><path d="M198 193Q168 209 172 243Q236 254 279 231Q235 204 198 193Z" fill="#87d6ca"/><path d="M234 192L287 213 242 220" fill="#4badb2"/><circle cx="223" cy="177" r="4" fill="#453a5d"/></g>}
  </g>}
  {isMusic&&<g transform="translate(120 163)"><ellipse cx="75" cy="68" rx="62" ry="20" fill="#dca985"/><ellipse cx="74" cy="23" rx="50" ry="43" fill="#bca1a2"/><path d="M45 -11L27 -52L70 -28M108 -11L125 -52L86 -28" fill="#a68299"/><circle cx="57" cy="22" r="4" fill="#44345a"/><circle cx="94" cy="22" r="4" fill="#44345a"/><path d="M67 41Q78 48 90 41" stroke="#654660" strokeWidth="3" fill="none"/><path d="M115 65L160 -25" stroke="#e6b36d" strokeWidth="12"/><ellipse cx="111" cy="62" rx="34" ry="43" fill="#e4ae6f" stroke="#9b6470" strokeWidth="4"/><circle cx="113" cy="62" r="10" fill="#a26968"/></g>}
  {isFlower&&<g>{[25,52,342,376].map((x,i)=><g key={i} transform={`translate(${x} ${215+i%2*14})`}><path d="M0 0V55" stroke="#74a175" strokeWidth="5"/>{[0,72,144,216,288].map(a=><ellipse key={a} cx="0" cy="-11" rx="8" ry="19" fill="#f5c2df" transform={`rotate(${a} 0 -23)`}/>) }<circle cx="0" cy="-22" r="7" fill="#f9d783"/></g>)}</g>}
  {!isForest&&!isCastle&&!isWater&&!isHouse&&!isMusic&&<g><path d="M145 205Q166 162 204 167Q242 170 265 213" fill="#efc88c"/><path d="M153 190Q204 125 262 191" stroke="#f9ddad" strokeWidth="10" fill="none"/><circle cx="206" cy="174" r="19" fill="#fff1d1"/><path d="M185 168Q198 130 223 161" fill="#7e568b"/></g>}
  <path d="M0 260Q92 218 169 261Q262 224 400 251V280H0Z" fill="#25324e" opacity=".44"/>
  <path d="M8 269Q110 259 199 270Q305 259 394 268" stroke="#fae7bc" fill="none" strokeWidth="3" opacity=".32"/>
 </svg>;
}
