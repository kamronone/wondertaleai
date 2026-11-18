import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Sparkles, ArrowLeft, ArrowRight, Plus, Download, Trash2, Film, ImagePlus, Heart, Library, WandSparkles } from "lucide-react";
import "./style.css";
import { createDemoBook, getDemoBooks, saveDemoBooks, isDemoBook } from "./demo";
import { labels, languages, getSavedLanguage, saveLanguage, type Lang } from "./i18n";

type Page={number:number;text:string;image_url:string};
type Book={id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:Page[];mode:string};
const API=(import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/,"");

function App(){
  const [tab,setTab]=useState<"home"|"create"|"library"|"reader">("home");
  const [lang,setLang]=useState<Lang>(getSavedLanguage);
  const [storyLang,setStoryLang]=useState<Lang>(getSavedLanguage);
  const t=labels[lang];
  const themes=t.themeOptions;
  const styles=t.styleOptions;
  const switchLang=(next:Lang)=>{setLang(next);saveLanguage(next);document.documentElement.lang=next;};
  const [books,setBooks]=useState<Book[]>([]);
  const [active,setActive]=useState<Book|null>(null);
  const [page,setPage]=useState(0);
  const [name,setName]=useState("");
  const [age,setAge]=useState("5");
  const [themeIndex,setThemeIndex]=useState(0);
  const theme=themes[themeIndex];
  const [styleIndex,setStyleIndex]=useState(0);
  const style=styles[styleIndex];
  const [prompt,setPrompt]=useState("");
  const [photo,setPhoto]=useState<File|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState("browser-demo");
  const [onlineApi,setOnlineApi]=useState(false);
  const fetchBooks=async()=>{setBooks(getDemoBooks());try{const response=await fetch(API+"/api/books",{signal:AbortSignal.timeout(1800)});if(response.ok){setBooks([...getDemoBooks(),...await response.json()]);setOnlineApi(true);}}catch{/* Local demo */}};
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  useEffect(()=>{void fetchBooks();fetch(API+"/api/health",{signal:AbortSignal.timeout(1800)}).then(r=>r.json()).then(data=>{setMode(data.mode);setOnlineApi(true)}).catch(()=>{});},[]);
  const openBook=(book:Book)=>{setActive(book);setPage(0);setTab("reader");setError("");};
  const generate=async(e:React.FormEvent)=>{
    e.preventDefault();setError("");setBusy(true);
    try{
      const form=new FormData();form.append("name",name);form.append("age",age);form.append("theme",theme);form.append("style",style);form.append("prompt",prompt);form.append("language",storyLang);form.append("parental_consent",String(consent));if(photo)form.append("photo",photo);
      if(!onlineApi){const book=createDemoBook(name,Number(age),theme,style,prompt,storyLang);setBooks(previous=>[book,...previous]);openBook(book);return;}
      const response=await fetch(API+"/api/books",{method:"POST",body:form});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.detail==="string"?data.detail :t.generateError);}
      const book:Book=await response.json();setBooks(previous=>[book,...previous]);openBook(book);
    }catch(e){setError(e instanceof Error?e.message :t.genericError);}finally{setBusy(false);}
  };
  const deleteBook=async(book:Book)=>{
    if(!confirm(t.deleteConfirm))return;
    try{if(isDemoBook(book)){saveDemoBooks(getDemoBooks().filter(b=>b.id!==book.id));}else{const r=await fetch(API+"/api/books/"+book.id,{method:"DELETE"});if(!r.ok)throw new Error("Ошибка удаления");}setBooks(prev=>prev.filter(b=>b.id!==book.id));setTab("library");setActive(null);}
    catch{setError(t.deleteError);}
  };
  const heading=(label:string,sub:string)=><div className="section-heading"><h2>{label}</h2><p>{sub}</p></div>;
  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setTab("home")} aria-label={t.backHome}><span className="brandmark"><img src="/icons/icon.svg" alt="" /></span><span>Wonder<span className="brandaccent">Tale</span><small>AI STORY STUDIO</small></span></button>
      <div className="header-actions"><label className="language-control"><span className="sr-only">{t.interfaceLanguage}</span><select aria-label={t.interfaceLanguage} value={lang} onChange={e=>switchLang(e.target.value as Lang)}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button className="small-button" onClick={()=>setTab("library")}><Library size={17}/> <span>{t.library}</span></button></div>
    </header>
    <main>
      {tab==="home"&&<>
        <div className="hero"><div className="hero-decor decor-one">✦</div><div className="hero-decor decor-two">✧</div><div className="hero-badge"><Sparkles size={15}/> {t.badge}</div>
          <h1>{t.hero1} <em>{t.hero2}</em> {t.hero3}</h1>
          <p>{t.heroDesc}</p>
          <button className="primary-button" onClick={()=>setTab("create")}><WandSparkles size={19}/> {t.create} <ArrowRight size={18}/></button>
          <div className="hero-art" aria-hidden="true"><div className="moon">☾</div><div className="star big">✦</div><div className="cloud">☁</div><div className="book-shape">📖</div><div className="little-star">✧</div></div>
        </div>
        <div className="features"><article><span>📷</span><h3>{t.recognizable}</h3><p>{t.recognizableDesc}</p></article><article><span>✨</span><h3>{t.anyStory}</h3><p>{t.anyStoryDesc}</p></article><article><span>📚</span><h3>{t.realBook}</h3><p>{t.realBookDesc}</p></article></div>
        <div className="section-head"><h2>{t.shelf}</h2><button className="text-link" onClick={()=>setTab("library")}>{t.seeAll} <ArrowRight size={16}/></button></div>
        {books.length?<div className="book-grid">{books.slice(0,3).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty"><BookOpen size={32}/><h3>{t.quiet}</h3><p>{t.quietDesc}</p><button className="secondary-button" onClick={()=>setTab("create")}>{t.firstBook}</button></div>}
      </>}
      {tab==="create"&&<section className="create-page">
        <button className="back-button" onClick={()=>setTab("home")}><ArrowLeft size={17}/> {t.backHome}</button>
        {heading(t.magic,t.magicDesc)}
        <form onSubmit={generate} className="form-card">
          <div className="step-title"><span>01</span><div><h3>{t.heroStep}</h3><p>{t.heroStepDesc}</p></div></div>
          <div className="form-grid"><label>{t.childName}<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder={t.nameExample}/></label><label>{t.age}<select value={age} onChange={e=>setAge(e.target.value)}>{Array.from({length:13},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} {t.years}</option>)}</select></label></div>
          <label className="upload"> <ImagePlus size={25}/><strong>{photo?photo.name:t.photo}</strong><small>{t.photoHint}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
          <div className="step-title next"><span>02</span><div><h3>{t.storyStep}</h3><p>{t.storyStepDesc}</p></div></div>
          <label>{t.world}</label><div className="chips">{themes.map((x,i)=><button type="button" key={x} className={"chip "+(themeIndex===i?"selected":"")} onClick={()=>setThemeIndex(i)}>{x}</button>)}</div>
          <label>{t.about}<textarea required minLength={8} maxLength={1200} rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={t.promptExample}/></label>
          <label>{t.style}<select value={styleIndex} onChange={e=>setStyleIndex(Number(e.target.value))}>{styles.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>
          <label>{t.storyLanguage}<select value={storyLang} onChange={e=>setStoryLang(e.target.value as Lang)}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          <label className="consent"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
          {(mode==="demo"||mode==="browser-demo")&&<p className="notice">{t.demo}</p>}
          {error&&<p className="error" role="alert">{error}</p>}
          <button className="primary-button full" disabled={busy||!consent} type="submit"><Sparkles size={18}/>{busy?t.creating:t.createBook}<ArrowRight size={18}/></button>
        </form>
      </section>}
      {tab==="library"&&<section className="library-page">{heading(t.libraryTitle,t.libraryDesc)}<button className="primary-button add-book" onClick={()=>setTab("create")}><Plus size={18}/> {t.newStory}</button>{error&&<p className="error">{error}</p>}{books.length?<div className="book-grid">{books.map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty"><BookOpen size={30}/><h3>{t.empty}</h3><p>{t.emptyDesc}</p></div>}</section>}
      {tab==="reader"&&active&&<section className="reader-page">
        <div className="reader-toolbar"><button className="back-button" onClick={()=>setTab("library")}><ArrowLeft size={17}/> {t.backLibrary}</button><div className="reader-actions">{isDemoBook(active)?<button className="icon-button" onClick={()=>window.print()} title={t.savePdf}><Download size={19}/></button>:<a className="icon-button" href={API+"/api/books/"+active.id+"/pdf"} title={t.downloadPdf}><Download size={19}/></a>}<button className="icon-button dangerous" onClick={()=>deleteBook(active)} title={t.delete}><Trash2 size={19}/></button></div></div>
        <div className="reader-title"><span>{t.forChild} {active.name}</span><h2>{active.title}</h2><p>{t.page} {page+1} {t.of} {active.pages.length}</p></div>
        <div className="story-page"><img src={isDemoBook(active)?active.pages[page].image_url:API+active.pages[page].image_url} alt={t.illustration+" "+(page+1)} /><div className="story-text">{active.pages[page].text}</div></div>
        <div className="pager"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ArrowLeft size={18}/> {t.back}</button><span>{active.pages.map((_,i)=><button key={i} className={"dot "+(i===page?"active":"")} onClick={()=>setPage(i)} aria-label={t.page+" "+(i+1)}/>)}</span><button disabled={page===active.pages.length-1} onClick={()=>setPage(p=>Math.min(active.pages.length-1,p+1))}>{t.next} <ArrowRight size={18}/></button></div>
      </section>}
      {tab==="home"&&<section className="install-panel"><div className="install-icon"><img src="/icons/icon.svg" alt="WonderTale AI"/></div><div><h3>{t.installTitle}</h3><p>{t.installDesc}</p></div></section>}
      <section className="coming"><span className="coming-icon"><Film size={20}/></span><div><h3>{t.cartoons}</h3><p>{t.cartoonsDesc}</p></div><span className="soon">{t.soon}</span></section>
    </main>
    <footer><Heart size={13} fill="currentColor"/> WonderTale AI · {t.footer}</footer>
  </div>;
}
function BookTile({book,open,lang}:{book:Book;open:()=>void;lang:Lang}){
  return <button className="book-tile" onClick={open}><img src={isDemoBook(book)?book.pages[0].image_url:API+book.pages[0].image_url} alt={labels[lang].cover}/><span className="book-caption"><strong>{book.title}</strong><small>{book.name} · {book.pages.length} {labels[lang].pages}</small></span></button>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA remains usable online */});});}
