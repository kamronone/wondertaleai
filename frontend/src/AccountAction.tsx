import { useState, type FormEvent } from "react";
import type { Lang } from "./i18n";

type ActionKind = "verify" | "recover";
type Props = { kind: ActionKind; token: string; api: string; lang: Lang; onDone: () => void };

const words = {
 ru: { titleVerify:"Подтверждение email", titleRecover:"Восстановление доступа", explanationVerify:"Подтвердите адрес электронной почты, чтобы продолжить работу с семейным аккаунтом.", explanationRecover:"Установите новый пароль родительского аккаунта.", newPassword:"Новый пароль (не менее 12 символов)", submitVerify:"Подтвердить email", submitRecover:"Сменить пароль", working:"Проверяем...", successVerify:"Адрес подтверждён. Теперь можно войти в аккаунт.", successRecover:"Пароль изменён. Предыдущие сессии завершены.", unavailable:"Подключение аккаунтов пока недоступно. Демоверсия сайта продолжает работать без входа.", failed:"Ссылка недействительна или срок действия истёк. Запросите новую ссылку.", goHome:"На главную" },
 uz: { titleVerify:"Email manzilni tasdiqlash", titleRecover:"Kirishni tiklash", explanationVerify:"Oilaviy akkaunt uchun email manzilingizni tasdiqlang.", explanationRecover:"Ota-ona akkauntingizga yangi parol o‘rnating.", newPassword:"Yangi parol (kamida 12 belgi)", submitVerify:"Emailni tasdiqlash", submitRecover:"Parolni o‘zgartirish", working:"Tekshirilmoqda...", successVerify:"Email tasdiqlandi. Endi akkauntga kirishingiz mumkin.", successRecover:"Parol o‘zgartirildi. Oldingi seanslar yopildi.", unavailable:"Akkauntga ulanish hali mavjud emas. Demo saytdan ro‘yxatdan o‘tmasdan foydalanishingiz mumkin.", failed:"Havola noto‘g‘ri yoki muddati tugagan. Yangi havola so‘rang.", goHome:"Bosh sahifa" },
 en: { titleVerify:"Confirm your email", titleRecover:"Recover your account", explanationVerify:"Confirm your email address to continue using your family account.", explanationRecover:"Choose a new password for your parent account.", newPassword:"New password (at least 12 characters)", submitVerify:"Confirm email", submitRecover:"Reset password", working:"Checking...", successVerify:"Email confirmed. You can now sign in.", successRecover:"Password changed. All previous sessions were revoked.", unavailable:"Parent account connections are not available yet. The demo still works without signing in.", failed:"This link is invalid or expired. Please request a new one.", goHome:"Go home" }
};

export function AccountAction({kind,token,api,lang,onDone}:Props) {
 const t=words[lang];
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<"success"|"error"|null>(null);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(!api||busy)return;
  setBusy(true);setResult(null);
  try {
   const response=await fetch(api+(kind==="verify"?"/api/auth/verify-email":"/api/auth/reset-password"),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="verify"?{token}:{token,new_password:password}),signal:AbortSignal.timeout(12000)
   });
   setResult(response.ok?"success":"error");
  } catch {setResult("error");}
  finally {setBusy(false);}
 };
 return <main className="account-action-page">
  <section className="account-action-card">
   <img src="/icons/icon-192.png" alt="WonderTale AI" width={76} height={76}/>
   <h1>{kind==="verify"?t.titleVerify:t.titleRecover}</h1>
   <p>{kind==="verify"?t.explanationVerify:t.explanationRecover}</p>
   {!api?<p className="account-action-notice" role="status">{t.unavailable}</p>
    :result==="success"?<p className="account-action-success" role="status">{kind==="verify"?t.successVerify:t.successRecover}</p>
    :<form onSubmit={submit}>
      {kind==="recover"&&<label>{t.newPassword}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
      {result==="error"&&<p className="account-action-notice" role="alert">{t.failed}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy?t.working:kind==="verify"?t.submitVerify:t.submitRecover}</button>
     </form>}
   <button className="account-action-back" onClick={onDone}>{t.goHome}</button>
  </section>
 </main>;
}
