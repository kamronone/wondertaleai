import { useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, CloudUpload, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import type { Lang } from "./i18n";

type Mode="login"|"register"|"forgot";
type Props={
 lang:Lang; api:string; session:string|null; syncedCount:number; syncBusy:boolean;
 onLogin:(token:string)=>Promise<boolean>;onLogout:()=>void;
 onSync:()=>Promise<void>;
};
const copy={
 ru:{title:"Аккаунт родителя",subtitle:"Семейная библиотека с защищённым доступом",notReady:"Личный кабинет пока недоступен: отдельная база и почтовый сервис не подключены. Ваши демосказки остаются в этом браузере.",demo:"Демонстрационный режим",email:"Электронная почта",password:"Пароль (не менее 12 символов)",login:"Войти",register:"Создать аккаунт",forgot:"Забыли пароль?",sendLink:"Отправить ссылку",back:"Назад ко входу",registerInfo:"После регистрации нужно подтвердить email по ссылке из письма.",registrationSent:"Проверьте почту: ссылка для подтверждения отправлена.",forgotSent:"Если аккаунт существует, на почту отправлена ссылка.",resend:"Отправить подтверждение ещё раз",resendSent:"Если email ожидает подтверждения, ссылка отправлена повторно.",unverified:"Сначала подтвердите email. Проверьте входящие или отправьте ссылку снова.",failed:"Не удалось выполнить запрос. Проверьте данные и подключение к серверу.",welcome:"Вы вошли в семейный аккаунт",sync:"Перенести мои сохранённые демосказки",syncDescription:"Копирование запускается только по вашему нажатию. Имя ребёнка и текст выбранных книг будут переданы в приватный аккаунт. Фото не передаётся.",syncNotice:"Для переноса используйте только собственное доверенное устройство.",syncDone:"Книг на сервере",logout:"Выйти",loading:"Выполняется…",privacy:"Демоистории не синхронизируются автоматически."},
 uz:{title:"Ota-ona akkaunti",subtitle:"Oilaviy ertaklar kutubxonasi",notReady:"Akkaunt hozirça mavjud emas: alohida baza va poçta xizmati ulanmagan. Demo ertaklar brauzeringizda saqlanadi.",demo:"Demo rejimi",email:"Elektron poçta",password:"Parol (kamida 12 belgi)",login:"Kiriş",register:"Akkaunt yaratiş",forgot:"Parolni unutdingizmi?",sendLink:"Havola yuboriş",back:"Kirişga qaytiş",registerInfo:"Röyxatdan ötgandan söng email manzilni xatdagi havola orqali tasdiqlang.",registrationSent:"Emailni tekşiring: tasdiqlaş havolasi yuborildi.",forgotSent:"Akkaunt mavjud bölsa, emailga havola yuboriladi.",resend:"Tasdiqlaş xatini qayta yuboriş",resendSent:"Email hali tasdiqlanmagan bölsa, havola qayta yuborildi.",unverified:"Avval emailni tasdiqlang. Poçtangizni tekşiring yoki havolani qayta yuboring.",failed:"Sörov bajarilmadi. Ma’lumotlar va serverni tekşiring.",welcome:"Oilaviy akkauntga kirdingiz",sync:"Saqlangan demo ertaklarimni köçiriş",syncDescription:"Faqat siz bosganda nusxa olinadi. Bola ismi va ertak matni şaxsiy akkauntga yuboriladi. Surat yuborilmaydi.",syncNotice:"Faqat özingizning işonçli qurilmangizdan foydalaning.",syncDone:"Serverdagi kitoblar",logout:"Çiqiş",loading:"Bajarilmoqda…",privacy:"Demo ertaklar avtomatik sinxronlanmaydi."},
 en:{title:"Parent account",subtitle:"Your private family story library",notReady:"Parent accounts are not available yet: a separate database and email provider are not connected. Demo stories remain in your browser.",demo:"Demo mode",email:"Email address",password:"Password (at least 12 characters)",login:"Sign in",register:"Create account",forgot:"Forgot password?",sendLink:"Send recovery link",back:"Back to sign in",registerInfo:"After registration, confirm your email using the link sent to your inbox.",registrationSent:"Check your email for the confirmation link.",forgotSent:"If the account exists, a recovery link has been sent.",resend:"Resend confirmation email",resendSent:"If the email awaits confirmation, another link has been sent.",unverified:"Confirm your email first. Check your inbox or request another link.",failed:"Unable to complete the request. Check your details and connection.",welcome:"You are signed in to your family account",sync:"Transfer saved demo stories",syncDescription:"Transfer happens only when you choose it. Child names and story text are copied to your private account. Photos are never sent.",syncNotice:"Only transfer from your own trusted device.",syncDone:"Books on server",logout:"Sign out",loading:"Working…",privacy:"Demo stories never sync automatically."}
};
export function ParentAccount({lang,api,session,syncedCount,syncBusy,onLogin,onLogout,onSync}:Props){
 const t=copy[lang];
 const [mode,setMode]=useState<Mode>("login");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [working,setWorking]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [unverified,setUnverified]=useState(false);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();
  if(!api||working)return;
  setWorking(true);setError("");setNotice("");setUnverified(false);
  try{
   const endpoint=mode==="login"?"/api/auth/login":mode==="register"?"/api/auth/register":"/api/auth/forgot-password";
   const payload=mode==="forgot"?{email}:{email,password};
   const res=await fetch(api+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
   if(!res.ok){if(mode==="login"&&res.status===403){setUnverified(true);throw Error("Unverified");}throw Error("Request failed");}
   const data=await res.json();
   if(mode==="login"){
    if(typeof data.access_token!=="string"||!await onLogin(data.access_token))throw Error("Invalid session");
    setPassword("");
   } else if(mode==="register"){
    // Registration may return an immediate session when email verification is disabled.
    // When verification is enabled the API returns {status:"verification_sent"} instead.
    if(typeof data.access_token==="string"){
     if(!await onLogin(data.access_token))throw Error("Invalid session");
    }else if(data.status==="verification_sent"){
     setNotice(t.registrationSent);
    }else{
     throw Error("Unexpected registration response");
    }
    setPassword("");
   }else{
    if(data.status!=="if_account_exists_email_sent")throw Error("Unexpected recovery response");
    setNotice(t.forgotSent);
    setPassword("");
   }
  }catch(e){setError(e instanceof Error&&e.message==="Unverified"?t.unverified:t.failed);}finally{setWorking(false);}
 };
 const resend=async()=>{
  if(!api||working||!email.trim())return;
  setWorking(true);setError("");setNotice("");
  try{
   const response=await fetch(api+"/api/auth/resend-verification",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email:email.trim()}),signal:AbortSignal.timeout(12000)
   });
   if(!response.ok)throw Error("Delivery request rejected");
   setNotice(t.resendSent);setUnverified(false);
  }catch{setError(t.failed);}finally{setWorking(false);}
 };
 return <section className="parent-account-page">
  <div className="parent-account-head"><span className="parent-account-symbol"><UserRound size={24}/></span><div><h2>{t.title}</h2><p>{t.subtitle}</p></div></div>
  {!api?<div className="parent-account-unavailable"><ShieldCheck size={30}/><h3>{t.demo}</h3><p>{t.notReady}</p></div>:
    session?<div className="parent-account-card"><div className="parent-account-success"><CheckCircle2 size={23}/><strong>{t.welcome}</strong></div>
      <p className="parent-account-muted">{t.syncDescription}</p><p className="parent-account-muted">{t.syncNotice}</p>
      <button type="button" className="parent-account-primary" onClick={()=>void onSync()} disabled={syncBusy}><CloudUpload size={17}/>{syncBusy?t.loading:t.sync}</button>
      <p className="parent-account-muted">{t.syncDone}: {syncedCount}</p>
      <button type="button" className="parent-account-secondary" onClick={onLogout}><LogOut size={16}/>{t.logout}</button>
    </div>:
    <form className="parent-account-card" onSubmit={submit}>
      <div className="parent-account-mode">
        <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");setNotice("");}}>{t.login}</button>
        <button type="button" className={mode==="register"?"active":""} onClick={()=>{setMode("register");setError("");setNotice("");}}>{t.register}</button>
      </div>
      <label><Mail size={16}/>{t.email}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /></label>
      {mode!=="forgot"&&<label><KeyRound size={16}/>{t.password}<input type="password" autoComplete={mode==="register"?"new-password":"current-password"} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      {mode==="register"&&<p className="parent-account-muted">{t.registerInfo}</p>}
      {notice&&<p className="parent-account-notice" role="status">{notice}</p>}
      {error&&<p className="parent-account-error" role="alert">{error}</p>}
      {unverified&&<button type="button" className="parent-account-secondary" disabled={working} onClick={()=>void resend()}>{t.resend}</button>}
      {mode==="register"&&notice&&<button type="button" className="parent-account-textbtn" disabled={working} onClick={()=>void resend()}>{t.resend}</button>}
      <button type="submit" className="parent-account-primary" disabled={working}>{working?t.loading:mode==="forgot"?t.sendLink:mode==="register"?t.register:t.login}</button>
      {mode==="login"?<button type="button" className="parent-account-textbtn" onClick={()=>{setMode("forgot");setError("");setNotice("");}}>{t.forgot}</button>:mode==="forgot"?<button type="button" className="parent-account-textbtn" onClick={()=>{setMode("login");setError("");setNotice("");}}>{t.back}</button>:null}
    </form>}
  <p className="parent-account-footnote">{t.privacy}</p>
 </section>;
}
