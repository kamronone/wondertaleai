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
 useEffect(()=>{
  let canceled=false;
  let url="";
  setPreview("");setError(false);
  const timer=window.setTimeout(()=>{
   createGiftCard({plan,language:lang,recipient,greeting}).then(blob=>{
    if(canceled)return;
    url=URL.createObjectURL(blob);setPreview(url);
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
   {error&&<p role="alert">{t[4]}</p>}
  </div>
 </details>;
}
