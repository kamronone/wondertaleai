import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Sparkles, ArrowLeft, ArrowRight, Plus, Download, Trash2, Film, ImagePlus, Heart, Library, WandSparkles } from "lucide-react";
import "./style.css";
import { createDemoBook, getDemoBooks, saveDemoBooks, isDemoBook } from "./demo";

type Page={number:number;text:string;image_url:string};
type Book={id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:Page[];mode:string};
const API=(import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/,"");
const themes=["Волшебство","Космос","Динозавры","Морские приключения","Дружба","Перед сном"];
const styles=["Акварель","3D мультфильм","Книжная иллюстрация","Нежная пастель"];
function App(){
  const [tab,setTab]=useState<"home"|"create"|"library"|"reader">("home");
  const [books,setBooks]=useState<Book[]>([]);
  const [active,setActive]=useState<Book|null>(null);
  const [page,setPage]=useState(0);
  const [name,setName]=useState("");
  const [age,setAge]=useState("5");
  const [theme,setTheme]=useState(themes[0]);
  const [style,setStyle]=useState(styles[0]);
  const [prompt,setPrompt]=useState("");
  const [photo,setPhoto]=useState<File|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState("browser-demo");
  const [onlineApi,setOnlineApi]=useState(false);
  const fetchBooks=async()=>{setBooks(getDemoBooks());try{const response=await fetch(API+"/api/books",{signal:AbortSignal.timeout(1800)});if(response.ok){setBooks([...getDemoBooks(),...await response.json()]);setOnlineApi(true);}}catch{/* Local demo */}};
  useEffect(()=>{void fetchBooks();fetch(API+"/api/health",{signal:AbortSignal.timeout(1800)}).then(r=>r.json()).then(data=>{setMode(data.mode);setOnlineApi(true)}).catch(()=>{});},[]);
  const openBook=(book:Book)=>{setActive(book);setPage(0);setTab("reader");setError("");};
  const generate=async(e:React.FormEvent)=>{
    e.preventDefault();setError("");setBusy(true);
    try{
      const form=new FormData();form.append("name",name);form.append("age",age);form.append("theme",theme);form.append("style",style);form.append("prompt",prompt);form.append("parental_consent",String(consent));if(photo)form.append("photo",photo);
      if(!onlineApi){const book=createDemoBook(name,Number(age),theme,style,prompt);setBooks(previous=>[book,...previous]);openBook(book);return;}
      const response=await fetch(API+"/api/books",{method:"POST",body:form});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.detail==="string"?data.detail:"Не получилось создать книгу");}
      const book:Book=await response.json();setBooks(previous=>[book,...previous]);openBook(book);
    }catch(e){setError(e instanceof Error?e.message:"Ошибка генерации");}finally{setBusy(false);}
  };
  const deleteBook=async(book:Book)=>{
    if(!confirm("Удалить эту сказку?"))return;
    try{if(isDemoBook(book)){saveDemoBooks(getDemoBooks().filter(b=>b.id!==book.id));}else{const r=await fetch(API+"/api/books/"+book.id,{method:"DELETE"});if(!r.ok)throw new Error("Ошибка удаления");}setBooks(prev=>prev.filter(b=>b.id!==book.id));setTab("library");setActive(null);}
    catch{setError("Не удалось удалить сказку");}
  };
  const heading=(label:string,sub:string)=><div className="section-heading"><h2>{label}</h2><p>{sub}</p></div>;
  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setTab("home")} aria-label="На главную"><span className="brandmark">✦</span><span>Wonder<span className="brandaccent">Tale</span><small>AI STORY STUDIO</small></span></button>
      <button className="small-button" onClick={()=>setTab("library")}><Library size={17}/> <span>Мои сказки</span></button>
    </header>
    <main>
      {tab==="home"&&<>
        <div className="hero"><div className="hero-decor decor-one">✦</div><div className="hero-decor decor-two">✧</div><div className="hero-badge"><Sparkles size={15}/> Чудеса начинаются здесь</div>
          <h1>Сказка, в которой <em>главный герой</em> — ваш ребёнок</h1>
          <p>Создавайте тёплые, волшебные истории с именем ребёнка, его фотографией и самым необычным сюжетом.</p>
          <button className="primary-button" onClick={()=>setTab("create")}><WandSparkles size={19}/> Создать свою сказку <ArrowRight size={18}/></button>
          <div className="hero-art" aria-hidden="true"><div className="moon">☾</div><div className="star big">✦</div><div className="cloud">☁</div><div className="book-shape">📖</div><div className="little-star">✧</div></div>
        </div>
        <div className="features"><article><span>📷</span><h3>Узнаваемый герой</h3><p>В AI-режиме иллюстрации создаются по фотографии малыша.</p></article><article><span>✨</span><h3>Любой сюжет</h3><p>Космос, драконы или удивительные друзья. Вы решаете!</p></article><article><span>📚</span><h3>Настоящая книга</h3><p>Листайте страницы и скачивайте PDF для семейной коллекции.</p></article></div>
        <div className="section-head"><h2>Ваша волшебная полка</h2><button className="text-link" onClick={()=>setTab("library")}>Посмотреть все <ArrowRight size={16}/></button></div>
        {books.length?<div className="book-grid">{books.slice(0,3).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)}/>)}</div>:<div className="empty"><BookOpen size={32}/><h3>Пока здесь тихо</h3><p>Первая сказка уже ждёт своего главного героя.</p><button className="secondary-button" onClick={()=>setTab("create")}>Создать первую книгу</button></div>}
      </>}
      {tab==="create"&&<section className="create-page">
        <button className="back-button" onClick={()=>setTab("home")}><ArrowLeft size={17}/> На главную</button>
        {heading("Создадим немного волшебства","Расскажите нам про маленького героя и его приключение.")}
        <form onSubmit={generate} className="form-card">
          <div className="step-title"><span>01</span><div><h3>Наш главный герой</h3><p>Кто отправится навстречу приключениям?</p></div></div>
          <div className="form-grid"><label>Имя ребёнка<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Амир"/></label><label>Возраст<select value={age} onChange={e=>setAge(e.target.value)}>{Array.from({length:13},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} лет</option>)}</select></label></div>
          <label className="upload"> <ImagePlus size={25}/><strong>{photo?photo.name:"Добавить фотографию ребёнка"}</strong><small>По желанию · JPG, PNG или WebP · до 8 МБ</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
          <div className="step-title next"><span>02</span><div><h3>Придумаем историю</h3><p>Выберите тему или создайте свою.</p></div></div>
          <label>Мир приключений</label><div className="chips">{themes.map(x=><button type="button" key={x} className={"chip "+(theme===x?"selected":"")} onClick={()=>setTheme(x)}>{x}</button>)}</div>
          <label>О чём будет ваша сказка?<textarea required minLength={8} maxLength={1200} rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Например: Амир отправляется на Луну и помогает маленькой звезде найти дорогу домой..."/></label>
          <label>Стиль иллюстраций<select value={style} onChange={e=>setStyle(e.target.value)}>{styles.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="consent"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Я родитель или законный представитель ребёнка и согласен(на) использовать предоставленную фотографию для создания сказки.</span></label>
          {(mode==="demo"||mode==="browser-demo")&&<p className="notice">Сейчас включён деморежим: вы получите пробную историю с декоративными иллюстрациями, без сходства с фото.</p>}
          {error&&<p className="error" role="alert">{error}</p>}
          <button className="primary-button full" disabled={busy||!consent} type="submit"><Sparkles size={18}/>{busy?"Создаём волшебство...":"Создать мою сказку"}<ArrowRight size={18}/></button>
        </form>
      </section>}
      {tab==="library"&&<section className="library-page">{heading("Моя библиотека","Ваши тёплые истории хранятся здесь.")}<button className="primary-button add-book" onClick={()=>setTab("create")}><Plus size={18}/> Новая сказка</button>{error&&<p className="error">{error}</p>}{books.length?<div className="book-grid">{books.map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)}/>)}</div>:<div className="empty"><BookOpen size={30}/><h3>Книжная полка пуста</h3><p>Создайте первую семейную историю.</p></div>}</section>}
      {tab==="reader"&&active&&<section className="reader-page">
        <div className="reader-toolbar"><button className="back-button" onClick={()=>setTab("library")}><ArrowLeft size={17}/> Библиотека</button><div className="reader-actions">{isDemoBook(active)?<button className="icon-button" onClick={()=>window.print()} title="Сохранить PDF через печать"><Download size={19}/></button>:<a className="icon-button" href={API+"/api/books/"+active.id+"/pdf"} title="Скачать PDF"><Download size={19}/></a>}<button className="icon-button dangerous" onClick={()=>deleteBook(active)} title="Удалить"><Trash2 size={19}/></button></div></div>
        <div className="reader-title"><span>Сказка для {active.name}</span><h2>{active.title}</h2><p>Страница {page+1} из {active.pages.length}</p></div>
        <div className="story-page"><img src={isDemoBook(active)?active.pages[page].image_url:API+active.pages[page].image_url} alt={"Иллюстрация страницы "+(page+1)} /><div className="story-text">{active.pages[page].text}</div></div>
        <div className="pager"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ArrowLeft size={18}/> Назад</button><span>{active.pages.map((_,i)=><button key={i} className={"dot "+(i===page?"active":"")} onClick={()=>setPage(i)} aria-label={"Страница "+(i+1)}/>)}</span><button disabled={page===active.pages.length-1} onClick={()=>setPage(p=>Math.min(active.pages.length-1,p+1))}>Далее <ArrowRight size={18}/></button></div>
      </section>}
      <section className="coming"><span className="coming-icon"><Film size={20}/></span><div><h3>AI-мультфильмы</h3><p>Следующая глава WonderTale: истории будут оживать.</p></div><span className="soon">Скоро</span></section>
    </main>
    <footer>Сделано с <Heart size={13} fill="currentColor"/> для маленьких мечтателей · WonderTale AI</footer>
  </div>;
}
function BookTile({book,open}:{book:Book;open:()=>void}){
  return <button className="book-tile" onClick={open}><img src={isDemoBook(book)?book.pages[0].image_url:API+book.pages[0].image_url} alt="Обложка сказки"/><span className="book-caption"><strong>{book.title}</strong><small>{book.name} · {book.pages.length} страниц</small></span></button>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
