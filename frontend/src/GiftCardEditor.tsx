import {useEffect,useState} from "react";
import {createGiftCard} from "./giftCard";

type Lang="ru"|"uz"|"en";
const copy={
 ru:["Открытка","Имя получателя","Поздравление","Сохранить PNG","Не удалось создать открытку","Предпросмотр открытки"],
 uz:["Tabriknoma","Qabul qiluvçi ismi","Tabrik","PNG saqlaş","Tabriknoma yaratilmadi","Tabriknomani köriş"],
 en:["Greeting card","Recipient name","Greeting","Save PNG","Could not create card","Card preview"]
};
export default function GiftCardEditor({lang,plan}:{lang:Lang;plan:"plus"|"family"}){
 const t=copy[lang];
 const [recipient,setRecipient]=useState("");
 const [greeting,setGreeting]=useState("");
 const [preview,setPreview]=useState("");
 const [error,setError]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [shareMessage,setShareMessage]=useState("");
 const shareCopy={ru:["Поделиться открыткой","Сохраните PNG и прикрепите его в Telegram.","Не удалось отправить открытку"],uz:["Tabriknomani ulaşiş","PNG faylni saqlang va Telegram orqali yuboring.","Tabriknoma yuborilmadi"],en:["Share card","Save the PNG and attach it in Telegram.","Could not share card"]}[lang];
 async function shareCard(){
  if(!file)return;
  setShareMessage("");
  try{
   if(!navigator.share||!navigator.canShare?.({files:[file]})){setShareMessage(shareCopy[1]);return;}
   await navigator.share({files:[file]});
  }catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setShareMessage(shareCopy[2]);}
 }
 useEffect(()=>{
  let canceled=false;
  let url="";
  setPreview("");setFile(null);setShareMessage("");setError(false);
  const timer=window.setTimeout(()=>{
   createGiftCard({plan,language:lang,recipient,greeting}).then(blob=>{
    if(canceled)return;
    url=URL.createObjectURL(blob);setPreview(url);setFile(new File([blob],"ertakcha-"+plan+".png",{type:"image/png"}));
   }).catch(()=>{if(!canceled)setError(true);});
  },180);
  return ()=>{canceled=true;window.clearTimeout(timer);if(url)URL.revokeObjectURL(url);};
 },[lang,plan,recipient,greeting]);
 return <details className="gift-card-editor">
  <summary>{t[0]}</summary>
  <div style={{display:"grid",gap:8,marginTop:8}}>
   <label>{t[1]}<input value={recipient} maxLength={60} onChange={e=>setRecipient(e.target.value)} style={{width:"100%",boxSizing:"border-box"}}/></label>
   <label>{t[2]}<textarea value={greeting} maxLength={240} rows={3} onChange={e=>setGreeting(e.target.value)} style={{width:"100%",boxSizing:"border-box"}}/></label>
   <small>{greeting.length}/240</small>
   {preview&&<><img src={preview} alt={t[5]} style={{width:"100%",maxWidth:280,height:"auto",borderRadius:12,justifySelf:"center"}}/><a href={preview} download={"ertakcha-"+plan+".png"}>{t[3]}</a></>}
   {preview&&file&&<button type="button" onClick={()=>void shareCard()}>{shareCopy[0]}</button>}
   {shareMessage&&<small role="status">{shareMessage}</small>}
   {error&&<p role="alert">{t[4]}</p>}
  </div>
 </details>;
}
