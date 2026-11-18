import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Sparkles, ArrowLeft, ArrowRight, Plus, Download, Trash2, Film, ImagePlus, Heart, Library, WandSparkles, Home, UserRound, PlayCircle, MoonStar, Crown, CheckCircle2, Trees, Castle, House, Apple, Bird, Music2, Search, SlidersHorizontal, ChevronDown, ChevronUp, Volume2, PauseCircle, Square, Play, Star } from "lucide-react";
import "./style.css";
import "./storybook-theme.css";
import { createDemoBook, createDemoSequel, getDemoBooks, saveDemoBooks, isDemoBook, type DemoBook } from "./demo";
import { labels, languages, getSavedLanguage, saveLanguage, type Lang } from "./i18n";
import { classics, type ClassicId, type Classic } from "./classics";
import { ClassicCover } from "./ClassicCover";
import { AccountAction } from "./AccountAction";
import { endings, storyPresets, type EndingId } from "./story_interactions";

type Page={number:number;text:string;image_url:string};
type Book={id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:Page[];mode:string;language?:Lang;favorite?:boolean;lastPage?:number;savedOnDevice?:boolean;originalEnding?:string;endingChoice?:EndingId};
const API=(import.meta.env.VITE_API_BASE || "").replace(/\/$/,"");

function App(){
  const [accountAction,setAccountAction]=useState<{kind:"verify"|"recover";token:string}|null>(()=>{
    const fragment=window.location.hash.slice(1);
    const [kind,token]=fragment.split("=",2);
    if((kind==="verify"||kind==="recover")&&token&&/^[A-Za-z0-9_-]{35,100}$/.test(token))return {kind,token};
    return null;
  });
  useEffect(()=>{
    if(accountAction)window.history.replaceState(null,"",window.location.pathname+window.location.search);
  },[]);
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
  const [secondHero,setSecondHero]=useState("");
  const [age,setAge]=useState("5");
  const [themeIndex,setThemeIndex]=useState(0);
  const theme=themes[themeIndex];
  const [styleIndex,setStyleIndex]=useState(0);
  const style=styles[styleIndex];
  const [prompt,setPrompt]=useState("");
  const [classicId,setClassicId]=useState<ClassicId|null>(null);
  const [classicQuery,setClassicQuery]=useState("");
  const [classicCategory,setClassicCategory]=useState("all");
  const [classicAge,setClassicAge]=useState("all");
  const [showAllClassics,setShowAllClassics]=useState(false);
  const visibleClassics=classics.filter(item=>{
    const q=classicQuery.trim().toLocaleLowerCase();
    const text=Object.values(item.title).concat(Object.values(item.summary)).join(" ").toLocaleLowerCase();
    const matchAge=classicAge==="all"||((item.minAge??(item.id==="red-hood"?4:5))<=Number(classicAge));
    return (!q||text.includes(q))&&(classicCategory==="all"||item.category===classicCategory)&&matchAge;
  });
  const shownClassics=showAllClassics||classicQuery.trim()||classicCategory!=="all"||classicAge!=="all"?visibleClassics:visibleClassics.slice(0,6);
  const activeClassic=classics.find(x=>x.id===classicId);
  const pickClassic=(id:ClassicId)=>{const item=classics.find(x=>x.id===id);if(!item)return;setClassicId(id);setThemeIndex(item.themeIndex);setPrompt(item.prompt[storyLang]);setTab("create");};
  const changeStoryLanguage=(next:Lang)=>{setStoryLang(next);if(activeClassic)setPrompt(activeClassic.prompt[next]);};
  const [photo,setPhoto]=useState<File|null>(null);
  const [showInstallGuide,setShowInstallGuide]=useState(false);
  const [consent,setConsent]=useState(false);
  const [saveOnDevice,setSaveOnDevice]=useState(false);
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [editingPage,setEditingPage]=useState(false);
  const [pageDraft,setPageDraft]=useState("");
  const [speaking,setSpeaking]=useState(false);
  const [speechPaused,setSpeechPaused]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState("browser-demo");
  const [onlineApi,setOnlineApi]=useState(false);
  const fetchBooks=async()=>{setBooks(getDemoBooks());if(!API)return;try{const response=await fetch(API+"/api/books",{signal:AbortSignal.timeout(1800)});if(response.ok){setBooks([...getDemoBooks(),...await response.json()]);setOnlineApi(true);}}catch{/* Local demo */}};
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  // Each SPA screen starts from its heading instead of retaining a deep catalog scroll offset.
  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:"instant"});
  },[tab]);
  // While reading, a page-turn scrolls to the start of the page instead of leaving the new text offscreen.
  useEffect(()=>{
    if(tab!=="reader"||!active)return;
    const pageElement=document.querySelector(".reader-title");
    if(!pageElement)return;
    const offset=pageElement.getBoundingClientRect().top+window.scrollY-12;
    window.scrollTo({top:Math.max(0,offset),left:0,behavior:"instant"});
  },[page,tab,active?.id]);
  useEffect(()=>{void fetchBooks();if(API)fetch(API+"/api/health",{signal:AbortSignal.timeout(1800)}).then(r=>r.json()).then(data=>{setMode(data.mode);setOnlineApi(true)}).catch(()=>{});},[]);
  const openBook=(book:Book)=>{
    setEditingPage(false);setActive(book);setPage(Math.max(0,Math.min(book.lastPage||0,book.pages.length-1)));setTab("reader");setError("");
  };
  useEffect(()=>{
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    setSpeaking(false);setSpeechPaused(false);setEditingPage(false);
  },[tab,page,active?.id]);
  useEffect(()=>{
    if(tab!=="reader"||!active||!isDemoBook(active))return;
    const saved=getDemoBooks();
    const original=saved.find(book=>book.id===active.id);
    if(!original||original.lastPage===page)return;
    saveDemoBooks(saved.map(book=>book.id===active.id?{...book,lastPage:page}:book));
    setBooks(previous=>previous.map(book=>book.id===active.id?{...book,lastPage:page}:book));
  },[page,active?.id,tab]);
  const toggleFavorite=()=>{
    if(!active||!isDemoBook(active))return;
    const favorite=!active.favorite;
    const saved=getDemoBooks();
    saveDemoBooks(saved.map(book=>book.id===active.id?{...book,favorite}:book));
    setBooks(prev=>prev.map(book=>book.id===active.id?{...book,favorite}:book));
    setActive(prev=>prev?{...prev,favorite}:null);
  };
  const speakPage=()=>{
    if(!active||!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
      setError(t.noVoice);return;
    }
    const engine=window.speechSynthesis;
    if(speaking){
      if(speechPaused){engine.resume();setSpeechPaused(false);}
      else{engine.pause();setSpeechPaused(true);}
      return;
    }
    engine.cancel();
    setError("");
    const utterance=new SpeechSynthesisUtterance(active.pages[page].text);
    utterance.lang=({ru:"ru-RU",uz:"uz-UZ",en:"en-US"} as const)[active.language||storyLang];
    utterance.rate=0.86;
    utterance.onend=()=>{setSpeaking(false);setSpeechPaused(false);};
    utterance.onerror=()=>{setSpeaking(false);setSpeechPaused(false);};
    setSpeaking(true);setSpeechPaused(false);
    engine.speak(utterance);
  };
  const stopSpeech=()=>{
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    setSpeaking(false);setSpeechPaused(false);
  };
  const applyLocalBookChange=(book:Book)=>{
    if(!isDemoBook(book))return;
    saveDemoBooks(getDemoBooks().map(b=>b.id===book.id?{...b,...book}:b));
    setBooks(prev=>prev.map(b=>b.id===book.id?book:b));
    setActive(book);
  };
  const beginPageEdit=()=>{
    if(!active||!isDemoBook(active))return;
    stopSpeech();setPageDraft(active.pages[page].text);setEditingPage(true);
  };
  const savePageEdit=()=>{
    if(!active||!isDemoBook(active))return;
    const text=pageDraft.trim();
    if(text.length<12||text.length>1500){setError(t.generateError);return;}
    const revised={...active,pages:active.pages.map((p,i)=>i===page?{...p,text}:p)};
    if(page===active.pages.length-1){revised.originalEnding=text;revised.endingChoice=undefined;}
    applyLocalBookChange(revised);setEditingPage(false);setError("");
  };
  const continueAdventure=()=>{
    if(!active||!isDemoBook(active))return;
    stopSpeech();
    try{
      const sequel=createDemoSequel(active as DemoBook);
      setBooks(prev=>[sequel,...prev]);
      openBook(sequel);
    }catch{
      setError(t.generateError);
    }
  };
  const selectEnding=(choice:EndingId)=>{
    if(!active||!isDemoBook(active))return;
    const last=active.pages.length-1;
    const originalEnding=active.originalEnding||active.pages[last].text;
    const addition=endings[active.language||storyLang][choice].addition;
    applyLocalBookChange({...active,originalEnding,endingChoice:choice,pages:active.pages.map((p,i)=>i===last?{...p,text:originalEnding+" "+addition}:p)});
    setEditingPage(false);
  };
  const generate=async(e:React.FormEvent)=>{
    e.preventDefault();setError("");setBusy(true);
    try{
      const form=new FormData();form.append("name",name);form.append("other_heroes",secondHero.trim());form.append("age",age);form.append("theme",theme);form.append("style",style);form.append("prompt",prompt);form.append("language",storyLang);form.append("parental_consent",String(consent));if(photo)form.append("photo",photo);
      if(!onlineApi){const heroes=secondHero.trim()?name.trim()+({ru:" и ",uz:" va ",en:" and "}[storyLang])+secondHero.trim():name.trim();const book=createDemoBook(heroes,Number(age),theme,style,prompt,storyLang,classicId||undefined,saveOnDevice);setBooks(previous=>[book,...previous]);openBook(book);return;}
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
  if(accountAction)return <AccountAction kind={accountAction.kind} token={accountAction.token} api={API} lang={lang} onDone={()=>{setAccountAction(null);setTab("home");}}/>;
  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setTab("home")} aria-label={t.backHome}><span className="brandmark"><img src="/icons/icon-192.png" alt="" /></span><span>Wonder<span className="brandaccent">Tale</span><small>AI STORY STUDIO</small></span></button>
      <div className="header-actions"><label className="language-control"><span className="sr-only">{t.interfaceLanguage}</span><select aria-label={t.interfaceLanguage} value={lang} onChange={e=>switchLang(e.target.value as Lang)}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button className="small-button" onClick={()=>setTab("library")}><Library size={17}/> <span>{t.library}</span></button></div>
    </header>
    <main>
      {tab==="home"&&<>
        <div className="hero"><div className="hero-sky" aria-hidden="true"><img src="/images/wondertale-hero.webp" alt="" loading="eager" decoding="async"/></div><div className="hero-content"><div className="hero-decor decor-one">✦</div><div className="hero-decor decor-two">✧</div><div className="hero-badge"><Sparkles size={15}/> {t.badge}</div>
          <div className="hero-brand"><Crown size={26}/><span>WonderTale <strong>AI</strong></span></div><h1>{t.hero1} <em>{t.hero2}</em> {t.hero3}</h1>
          <p>{t.heroDesc}</p>
          <button className="primary-button" onClick={()=>setTab("create")}><WandSparkles size={19}/> {t.create} <ArrowRight size={18}/></button>
          </div>
        </div>
        <div className="quick-actions"><button type="button" onClick={()=>setTab("create")}><span className="quick-icon"><BookOpen size={22}/></span><strong>{t.create}</strong><ArrowRight size={16}/></button><button type="button" onClick={()=>setTab("library")}><span className="quick-icon"><Library size={22}/></span><strong>{t.library}</strong><ArrowRight size={16}/></button><div className="quick-coming"><span className="quick-icon"><PlayCircle size={22}/></span><strong>{t.cartoons}</strong><span className="mini-soon">{t.soon}</span></div></div>
        <section className="classic-section">
          <div className="section-head"><div><span className="section-eyebrow">✦ WonderTale</span><h2>{t.classicsTitle}</h2><p className="classic-intro">{t.classicsDesc}</p></div></div>
          <div className="classic-controls">
            <div className="classic-search"><Search size={18}/><input type="search" value={classicQuery} onChange={e=>setClassicQuery(e.target.value)} placeholder={t.classicSearch} aria-label={t.classicSearch}/></div>
            <div className="classic-filters">
              <div className="classic-categories" role="group" aria-label={t.classicCategory}>
                {([["all",t.classicAll],["magic",t.classicMagic],["adventure",t.classicAdventure],["animals",t.classicAnimals],["kindness",t.classicKindness]] as const).map(([value,label])=><button key={value} type="button" className={classicCategory===value?"active":""} onClick={()=>setClassicCategory(value)}>{label}</button>)}
              </div>
              <label className="classic-age"><SlidersHorizontal size={15}/><span>{t.classicAge}</span><select value={classicAge} onChange={e=>setClassicAge(e.target.value)} aria-label={t.classicAge}><option value="all">{t.classicAnyAge}</option>{[3,4,5,6,7,8,10].map(v=><option key={v} value={v}>{v}+</option>)}</select></label>
            </div>
            <span className="classic-count">{visibleClassics.length} {t.classicCount}</span>
          </div>
          {shownClassics.length?<div className="classic-grid">{shownClassics.map(item=><ClassicTile key={item.id} item={item} lang={lang} onPick={()=>pickClassic(item.id)} action={t.classicSelect}/>)}</div>:<p className="classic-empty">{t.classicEmpty}</p>}
          {visibleClassics.length>6&&!classicQuery.trim()&&classicCategory==="all"&&classicAge==="all"&&<button type="button" className="classic-toggle" onClick={()=>setShowAllClassics(v=>!v)}>{showAllClassics?t.classicLess:t.classicMore}{showAllClassics?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>}
        </section>
        <div className="features"><article><img className="feature-art" src="/images/features/recognizable-hero.png" alt="" loading="lazy" decoding="async"/><div className="feature-copy"><h3>{t.recognizable}</h3><p>{t.recognizableDesc}</p></div></article><article><img className="feature-art" src="/images/features/any-story.png" alt="" loading="lazy" decoding="async"/><div className="feature-copy"><h3>{t.anyStory}</h3><p>{t.anyStoryDesc}</p></div></article><article><img className="feature-art" src="/images/features/real-book.png" alt="" loading="lazy" decoding="async"/><div className="feature-copy"><h3>{t.realBook}</h3><p>{t.realBookDesc}</p></div></article></div>
        <div className="section-head"><div><span className="section-eyebrow">✦ WonderTale</span><h2>{t.shelf}</h2></div><button className="text-link" onClick={()=>setTab("library")}>{t.seeAll} <ArrowRight size={16}/></button></div>
        {books.length?<div className="book-grid">{books.slice(0,3).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty empty-compact"><span className="empty-compact-icon"><BookOpen size={23}/></span><div className="empty-compact-copy"><h3>{t.quiet}</h3><p>{t.quietDesc}</p></div><button className="secondary-button" onClick={()=>setTab("create")}>{t.firstBook} <ArrowRight size={16}/></button></div>}
      </>}
      {tab==="create"&&<section className="create-page">
        <button className="back-button" onClick={()=>setTab("home")}><ArrowLeft size={17}/> {t.backHome}</button>
        {heading(t.magic,t.magicDesc)}
        <div className="wizard-progress" aria-label="Create story"><span className="progress-step active"><span>1</span>{t.heroStep}</span><span className="progress-line"/><span className="progress-step"><span>2</span>{t.storyStep}</span><span className="progress-line"/><span className="progress-step"><span>3</span>{t.createBook}</span></div><form onSubmit={generate} className="form-card">
          <div className="step-title"><span>01</span><div><h3>{t.heroStep}</h3><p>{t.heroStepDesc}</p></div></div>
          <div className="form-grid"><label>{t.childName}<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder={t.nameExample}/></label><label>{t.age}<select value={age} onChange={e=>setAge(e.target.value)}>{Array.from({length:13},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} {t.years}</option>)}</select></label></div>
          <label className="second-hero-field">{t.extraHero}<input maxLength={45} value={secondHero} onChange={e=>setSecondHero(e.target.value)} placeholder={t.extraHeroHint}/></label>
          <label className="upload"> <ImagePlus size={25}/><strong>{photo?photo.name:t.photo}</strong><small>{t.photoHint}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
          <div className="step-title next"><span>02</span><div><h3>{t.classicFormTitle}</h3><p>{t.storyStepDesc}</p></div></div>
          <div className="classic-choice"><button type="button" className={!classicId?"active":""} onClick={()=>{setClassicId(null);setPrompt("");}}>{t.classicCustom}</button>{classics.map(item=><button type="button" className={classicId===item.id?"active":""} key={item.id} onClick={()=>{setClassicId(item.id);setThemeIndex(item.themeIndex);setPrompt(item.prompt[storyLang]);}}>{item.title[lang]}</button>)}</div>
          {activeClassic&&<p className="classic-selected"><CheckCircle2 size={16}/> {t.classicSelected}: <strong>{activeClassic.title[lang]}</strong></p>}
          <label>{t.world}</label><div className="chips">{themes.map((x,i)=><button type="button" key={x} className={"chip "+(themeIndex===i?"selected":"")} onClick={()=>setThemeIndex(i)}>{x}</button>)}</div>
          <label className="story-preset-label">{t.storyIdeas}</label>
          <div className="story-preset-actions">{storyPresets[storyLang].map(preset=><button type="button" key={preset.id} onClick={()=>{setClassicId(null);setPrompt(preset.idea);setThemeIndex(preset.id==="bedtime"?5:preset.id==="confidence"?4:0);}}>{preset.title}</button>)}</div>
          <label>{t.about}<textarea required minLength={8} maxLength={1200} rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={t.promptExample}/></label>
          <label>{t.style}<select value={styleIndex} onChange={e=>setStyleIndex(Number(e.target.value))}>{styles.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>
          <div className="story-lang-field"><label>{t.storyLanguage}</label><div className="story-lang-options">{languages.map(l=><button type="button" className={storyLang===l.id?"active":""} key={l.id} onClick={()=>changeStoryLanguage(l.id)}>{l.id.toUpperCase()} {storyLang===l.id&&<CheckCircle2 size={15}/>}</button>)}</div></div>
          {!onlineApi&&<div className="device-save-option">
            <label><input type="checkbox" checked={saveOnDevice} onChange={e=>setSaveOnDevice(e.target.checked)}/><span><strong>{t.deviceSave}</strong><small>{saveOnDevice?t.deviceSaveHint:t.sessionOnly}</small></span></label>
          </div>}
          <label className="consent"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
          {(mode==="demo"||mode==="browser-demo")&&<p className="notice">{activeClassic?t.classicDemo:t.demo}</p>}
          {error&&<p className="error" role="alert">{error}</p>}
          <button className="primary-button full" disabled={busy||!consent} type="submit"><Sparkles size={18}/>{busy?t.creating:t.createBook}<ArrowRight size={18}/></button>
        </form>
      </section>}
      {tab==="library"&&<section className="library-page">{heading(t.libraryTitle,t.libraryDesc)}<button className="primary-button add-book" onClick={()=>setTab("create")}><Plus size={18}/> {t.newStory}</button>{error&&<p className="error">{error}</p>}
        {books.length>0&&<div className="library-filters" role="group"><button type="button" className={!favoritesOnly?"active":""} onClick={()=>setFavoritesOnly(false)}>{t.allBooks}</button><button type="button" className={favoritesOnly?"active":""} onClick={()=>setFavoritesOnly(true)}><Heart size={15}/>{t.favorites}</button></div>}
        {(favoritesOnly?books.filter(book=>book.favorite):books).length?<div className="book-grid">{(favoritesOnly?books.filter(book=>book.favorite):books).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty"><BookOpen size={30}/><h3>{favoritesOnly?t.noFavorites:t.empty}</h3><p>{favoritesOnly?"":t.emptyDesc}</p></div>}</section>}
      {tab==="reader"&&active&&<section className="reader-page">
        <div className="reader-toolbar"><button className="back-button" onClick={()=>setTab("library")}><ArrowLeft size={17}/> {t.backLibrary}</button><div className="reader-actions">{isDemoBook(active)?<button className="icon-button" onClick={()=>window.print()} title={t.savePdf}><Download size={19}/></button>:<a className="icon-button" href={API+"/api/books/"+active.id+"/pdf"} title={t.downloadPdf}><Download size={19}/></a>}{isDemoBook(active)&&<button className="icon-button" onClick={toggleFavorite} title={active.favorite?t.unfavorite:t.favorite} aria-label={active.favorite?t.unfavorite:t.favorite}><Heart size={19} fill={active.favorite?"currentColor":"none"}/></button>}<button className="icon-button dangerous" onClick={()=>deleteBook(active)} title={t.delete}><Trash2 size={19}/></button></div></div>
        {error&&<p className="error" role="alert">{error}</p>}
        <div className="reader-title"><span className="reader-crown"><Crown size={19}/></span><span>{t.forChild} {active.name}</span>{isDemoBook(active)&&(active as import("./demo").DemoBook).savedOnDevice&&<span className="reader-saved-tag"><CheckCircle2 size={14}/>{t.savedOnDevice}</span>}<h2>{active.title}</h2><p>{t.page} {page+1} {t.of} {active.pages.length}</p></div>
        <div className="reader-audio-toolbar"><button type="button" onClick={speakPage}><Volume2 size={17}/>{speaking?(speechPaused?t.resumeAudio:t.pauseAudio):t.listen}{speaking?(speechPaused?<Play size={16}/>:<PauseCircle size={16}/>):null}</button>{speaking&&<button type="button" onClick={stopSpeech}><Square size={15}/>{t.stopAudio}</button>}</div>
        <div className="story-page"><div className="story-page-image"><img src={isDemoBook(active)?active.pages[page].image_url:API+active.pages[page].image_url} alt={t.illustration+" "+(page+1)} /></div><div className="story-text"><span className="dropcap-star">✦</span>{active.pages[page].text}</div></div>
        {isDemoBook(active)&&<div className="story-edit-zone">
          {!editingPage?<button type="button" onClick={beginPageEdit}><WandSparkles size={15}/>{t.editPage}</button>:
            <div className="story-page-editor"><textarea autoFocus value={pageDraft} onChange={e=>setPageDraft(e.target.value)} minLength={12} maxLength={1500} rows={7} aria-label={t.editPage}/>
              <div><button type="button" onClick={savePageEdit}>{t.savePage}</button><button type="button" onClick={()=>setEditingPage(false)}>{t.cancelEdit}</button></div>
            </div>}
        </div>}
        {isDemoBook(active)&&page===active.pages.length-1&&<div className="interactive-endings"><strong>{t.interactiveEnding}</strong>
          <div>{(["friendship","discovery"] as const).map(id=><button type="button" key={id} className={active.endingChoice===id?"active":""} onClick={()=>selectEnding(id)}>{endings[active.language||storyLang][id].title}</button>)}</div>
        </div>}
        {isDemoBook(active)&&page===active.pages.length-1&&<button type="button" className="sequel-action" onClick={continueAdventure}><BookOpen size={17}/>{t.sequel}<ArrowRight size={17}/></button>}
        {isDemoBook(active)&&<article className="print-book" aria-hidden="true">
          <div className="print-book-cover"><img src={active.pages[0].image_url} alt=""/><h1>{active.title}</h1><p>{t.forChild} {active.name}</p><small>WonderTale AI</small></div>
          {active.pages.map((item,index)=><section className="print-book-page" key={item.number}><div className="print-book-page-head"><span>WonderTale AI</span><span>{t.page} {index+1} {t.of} {active.pages.length}</span></div><img src={item.image_url} alt=""/><p>{item.text}</p></section>)}
        </article>}
        <div className="pager"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ArrowLeft size={18}/> {t.back}</button><span>{active.pages.map((_,i)=><button key={i} className={"dot "+(i===page?"active":"")} onClick={()=>setPage(i)} aria-label={t.page+" "+(i+1)}/>)}</span><button disabled={page===active.pages.length-1} onClick={()=>setPage(p=>Math.min(active.pages.length-1,p+1))}>{t.next} <ArrowRight size={18}/></button></div>
      </section>}
      {tab==="home"&&<section className="install-panel compact-install">
        <div className="install-icon"><img src="/icons/icon-192.png" alt="WonderTale AI"/></div>
        <div className="compact-install-body"><h3>{t.installTitle}</h3><p>{t.installDesc}</p>
          <button className="install-guide-trigger" type="button" aria-expanded={showInstallGuide} onClick={()=>setShowInstallGuide(v=>!v)}>
            {t.installHow} {showInstallGuide?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
          </button>
          {showInstallGuide&&<div className="install-guide"><p>{t.installIos}</p><p>{t.installAndroid}</p></div>}
        </div>
      </section>}
      {tab==="home"&&<section className="coming"><span className="coming-icon"><Film size={20}/></span><div><h3>{t.cartoons}</h3><p>{t.cartoonsDesc}</p></div><span className="soon">{t.soon}</span></section>}
      <nav className="mobile-tabbar" aria-label="WonderTale"><button type="button" className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Home size={21}/><span>{t.backHome}</span></button><button type="button" className={tab==="library"||tab==="reader"?"active":""} onClick={()=>setTab("library")}><Library size={21}/><span>{t.library}</span></button><button type="button" className={tab==="create"?"active":""} onClick={()=>setTab("create")}><Plus size={22}/><span>{t.create}</span></button></nav>
    </main>
    <footer>© WonderTale AI</footer>
  </div>;
}
function ClassicTile({item,lang,onPick,action}:{item:Classic;lang:Lang;onPick:()=>void;action:string}){
 return <button type="button" className={"classic-card classic-"+item.color} onClick={onPick} aria-label={action+": "+item.title[lang]}>
   <span className="classic-cover">{(true)
     ? <img className="classic-generated-image"
         src={"/images/classics/"+item.id+(["red-hood","cinderella","three-pigs","snow-white","ugly-duckling","bremen"].includes(item.id)?".svg":".webp")}
         alt={item.title[lang]} loading="lazy" decoding="async"/>
     : <ClassicCover item={item}/>}</span>
   <span className="classic-info"><strong>{item.title[lang]}</strong><small>{item.summary[lang]}</small><span className="classic-link">{action} <ArrowRight size={15}/></span></span>
 </button>;
}
function BookTile({book,open,lang}:{book:Book;open:()=>void;lang:Lang}){
  return <button className="book-tile" onClick={open}><img src={isDemoBook(book)?book.pages[0].image_url:API+book.pages[0].image_url} alt={labels[lang].cover}/><span className="book-caption"><strong>{book.title}</strong><small>{book.name} · {book.pages.length} {labels[lang].pages}</small>{(book.lastPage||0)>0&&<small className="read-progress">{labels[lang].continueReading}: {labels[lang].page} {(book.lastPage||0)+1}</small>}{book.favorite&&<span className="book-favorite-badge"><Heart size={14} fill="currentColor"/></span>}</span></button>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA remains usable online */});});}
