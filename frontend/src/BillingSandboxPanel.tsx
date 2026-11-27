import {useState} from "react";
import BillingDashboard from "./BillingDashboard";

export default function BillingSandboxPanel(){
 const [draft,setDraft]=useState("");
 const [token,setToken]=useState("");
 if(!import.meta.env.DEV||import.meta.env.VITE_ENABLE_ANALYTICS_LOCAL_SANDBOX!=="true")return null;
 return <section className="billing-dashboard">
  <h2>Финансы: локальная тестовая среда</h2>
  {!token?<form onSubmit={e=>{e.preventDefault();if(draft.length>=32){setToken(draft);setDraft("");}}}>
   <label>Отдельный тестовый токен<input type="password" autoComplete="off" minLength={32} required value={draft} onChange={e=>setDraft(e.target.value)}/></label>
   <button type="submit">Открыть отчёт</button>
  </form>:<>
   <button type="button" onClick={()=>setToken("")}>Закрыть отчёт</button>
   <BillingDashboard api="" token={token}/>
  </>}
 </section>;
}
