import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, Sparkles, ArrowLeft, ArrowRight, Plus, Download, Trash2, Film, ImagePlus, Heart, Library, WandSparkles, Home, UserRound, PlayCircle, MoonStar, Crown, CheckCircle2, Trees, Castle, House, Apple, Bird, Music2, Search, SlidersHorizontal, ChevronDown, ChevronUp, Volume2, PauseCircle, Square, Play, Star } from "lucide-react";
import "./style.css";
import "./storybook-theme.css";
import { createDemoBook, createDemoSequel, getDemoBooks, saveDemoBooks, isDemoBook, type DemoBook } from "./demo";
import { labels, languages, getSavedLanguage, saveLanguage, type Lang } from "./i18n";
import { classics, type ClassicId, type Classic } from "./classics";
import { ClassicCover } from "./ClassicCover";
import { AccountAction } from "./AccountAction";
import { PricingPlans } from "./PricingPlans";
import { ParentAccount } from "./ParentAccount";
import { loadPrivateBooks, transferLocalBooks, validateSession, setPrivateFavorite, updatePrivateReadingProgress, type RemoteBook } from "./private_library";
import { endings, storyPresets, type EndingId } from "./story_interactions";
import { getAuthenticatedOwner, readPendingMetadata, writePendingMetadata } from "./offline_queue";

type Page={number:number;text:string;image_url:string};
type Book={id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:Page[];mode:string;language?:Lang;favorite?:boolean;lastPage?:number;savedOnDevice?:boolean;originalEnding?:string;endingChoice?:EndingId};
const API=(import.meta.env.VITE_API_BASE || "").replace(/\/$/,"");
const bookImage=(url:string)=>!url?"/images/wondertale-hero.webp":url.startsWith("/images/")?url:API+url;

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
  const [tab,setTab]=useState<"home"|"create"|"library"|"reader"|"account">("home");
  const [onboardingStep,setOnboardingStep]=useState(0);
  const welcomeTouchStart=useRef<{x:number;y:number}|null>(null);
  const onWelcomeTouchStart=(event:React.TouchEvent<HTMLElement>)=>{
    const touch=event.touches[0];
    if(touch)welcomeTouchStart.current={x:touch.clientX,y:touch.clientY};
  };
  const onWelcomeTouchEnd=(event:React.TouchEvent<HTMLElement>)=>{
    const start=welcomeTouchStart.current;
    welcomeTouchStart.current=null;
    const touch=event.changedTouches[0];
    if(!start||!touch)return;
    const dx=touch.clientX-start.x;
    const dy=touch.clientY-start.y;
    if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.3)return;
    setOnboardingStep(current=>Math.max(0,Math.min(2,current+(dx<0?1:-1))));
  };
  const [showOnboarding,setShowOnboarding]=useState(()=>{try{return localStorage.getItem("wondertale-onboarding-v1")!=="seen"}catch{return true}});
  const finishOnboarding=(destination:"home"|"account")=>{
    try{localStorage.setItem("wondertale-onboarding-v1","seen")}catch{/* Continue even when private browsing blocks storage. */}
    setShowOnboarding(false);setTab(destination);
  };
  const [lang,setLang]=useState<Lang>(getSavedLanguage);
  const [storyLang,setStoryLang]=useState<Lang>(getSavedLanguage);
  const t=labels[lang];
  const themes=t.themeOptions;
  const styles=t.styleOptions;
  const switchLang=(next:Lang)=>{setLang(next);saveLanguage(next);document.documentElement.lang=next;};
  const [books,setBooks]=useState<Book[]>([]);
  const [privateToken,setPrivateToken]=useState<string|null>(null);
  // Prevent late responses from a previous parent session entering the current account.
  const sessionEpoch=useRef(0);
  // Serialize writes per book so rapid page turns cannot overwrite newer progress.
  const progressWrites=useRef(new Map<string,Promise<void>>());
  // A favorite endpoint toggles its state, so never overlap requests for one book.
  const favoriteWrites=useRef(new Set<string>());
  // Session-scoped offline changes. Never replay a previous parent's changes
  // into a different account, and never persist bearer tokens on the device.
  const pendingProgress=useRef(new Map<string,number>());
  const pendingFavorites=useRef(new Map<string,boolean>());
  const flushing=useRef(false);
  const recentlyCreated=useRef(new Map<string,number>());
  const offlineOwner=useRef<string|null>(null);
  const persistPending=()=>{
    if(!offlineOwner.current)return;
    writePendingMetadata(offlineOwner.current,{
      progress:Object.fromEntries(pendingProgress.current),
      favorites:Object.fromEntries(pendingFavorites.current)
    });
  };
  const [remoteBooks,setRemoteBooks]=useState<RemoteBook[]>([]);
  const [syncBusy,setSyncBusy]=useState(false);
  const [syncMessage,setSyncMessage]=useState("");
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
  const [usePersonalAi,setUsePersonalAi]=useState(false);

  // API health alone never authorizes uploading a child photo or generating a story.
  // The old demo FormData endpoint is not compatible with secure_main.py JSON routes.
  const loginParent=async(token:string):Promise<boolean>=>{
    const epoch=++sessionEpoch.current;
    pendingProgress.current.clear();pendingFavorites.current.clear();
    offlineOwner.current=null;
    recentlyCreated.current.clear();
    if(!API||!await validateSession(API,token)||sessionEpoch.current!==epoch)return false;
    try{
      const owner=await getAuthenticatedOwner(API,token);
      const remote=await loadPrivateBooks(API,token);
      if(sessionEpoch.current!==epoch)return false;
      offlineOwner.current=owner;
      const pending=readPendingMetadata(owner);
      pendingProgress.current=new Map(Object.entries(pending.progress));
      pendingFavorites.current=new Map(Object.entries(pending.favorites));
      const merged=remote.map(book=>({
        ...book,
        favorite:pendingFavorites.current.get(book.id)??book.favorite,
        lastPage:pendingProgress.current.get(book.id)??book.lastPage
      }));
      setPrivateToken(token);setRemoteBooks(merged);setBooks(merged);setActive(null);setSyncMessage("");
      return true;
    }catch{return false;}
  };
  const logoutParent=()=>{
    ++sessionEpoch.current;
    pendingProgress.current.clear();pendingFavorites.current.clear();
    offlineOwner.current=null;
    recentlyCreated.current.clear();
    const token=privateToken;
    setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);setSyncMessage("");
    if(token&&API)void fetch(API+"/api/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+token}}).catch(()=>{});
  };
  const syncSaved=async()=>{
    if(!privateToken||!API||syncBusy)return;
    const epoch=sessionEpoch.current;
    setSyncBusy(true);setSyncMessage("");
    try{
      const report=await transferLocalBooks(API,privateToken,getDemoBooks());
      if(sessionEpoch.current!==epoch)return;
      setRemoteBooks(report.serverBooks);
      setBooks(report.serverBooks);
      // Show all outcomes: already transferred books are not new uploads,
      // and partial failures must never look like a complete successful sync.
      const labels={
        ru:{uploaded:"Перенесено",existing:"Уже в аккаунте",failed:"Не перенесено",retry:"Повторите перенос для оставшихся книг",metadata:"Не синхронизированы отметки или прогресс"},
        uz:{uploaded:"Köçirildi",existing:"Akkauntda mavjud",failed:"Köçirilmadi",retry:"Qolgan kitoblar uçun qayta urinib köring",metadata:"Belgilar yoki öqiş jarayoni sinxronlanmadi"},
        en:{uploaded:"Transferred",existing:"Already in account",failed:"Not transferred",retry:"Retry to transfer the remaining books",metadata:"Favorites or reading progress not synced"}
      }[lang];
      setSyncMessage(
        labels.uploaded+": "+report.uploaded+" · "+
        labels.existing+": "+report.existing+" · "+
        labels.failed+": "+report.failed+
        (report.metadataFailed?" · "+labels.metadata+": "+report.metadataFailed:"")+
        (report.failed||report.metadataFailed?" · "+labels.retry:"")
      );
    }catch(error){
      if(sessionEpoch.current!==epoch)return;
      if(error instanceof Error&&error.message==="Private account authorization expired"){
        // Never leave private books on screen after the server rejects the session.
        ++sessionEpoch.current;
        setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);
        setSyncMessage({
          ru:"Сессия истекла. Войдите снова, чтобы перенести сохранённые книги.",
          uz:"Sessiya tugadi. Saqlangan kitoblarni köçiriş uçun qayta kiring.",
          en:"Your session expired. Sign in again to transfer saved books."
        }[lang]);
      }else{
        setSyncMessage({ru:"Не удалось перенести книги. Попробуйте позднее.",uz:"Kitoblarni köçiriş amalga oşmadi. Keyinroq qayta urinib köring.",en:"Transfer failed. Please retry later."}[lang]);
      }
    }finally{setSyncBusy(false);}
  };
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
  useEffect(()=>{if(!privateToken)setBooks(getDemoBooks());},[privateToken]);
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
  useEffect(()=>{
    if(tab!=="reader"||!active||isDemoBook(active)||!privateToken||!API)return;
    const bookId=active.id;
    const epoch=sessionEpoch.current;
    // Serialize writes for each book: a slow response for page 1 must not
    // overwrite a newer page 3 on the server or in the interface.
    const token=privateToken;
    const next=progressWrites.current.get(bookId)??Promise.resolve();
    const write=next.catch(()=>{}).then(async()=>{
      if(sessionEpoch.current!==epoch)return;
      try{
        await updatePrivateReadingProgress(API,token,bookId,page);
        if(sessionEpoch.current===epoch&&pendingProgress.current.get(bookId)===page){pendingProgress.current.delete(bookId);persistPending();}
      }catch(error){
        if(sessionEpoch.current===epoch&&!(error instanceof Error&&error.message==="Private account authorization expired")){
          pendingProgress.current.set(bookId,page);
          persistPending();
          setBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
          setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
        }
        throw error;
      }
      if(sessionEpoch.current!==epoch)return;
      setBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
      setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
    });
    progressWrites.current.set(bookId,write);
    void write.catch(()=>{ /* Keep last confirmed position if offline. */ }).finally(()=>{
      if(progressWrites.current.get(bookId)===write)progressWrites.current.delete(bookId);
    });
  },[page,tab,active?.id,privateToken]);
  useEffect(()=>{
    if(!privateToken||!API)return;
    let disposed=false;
    const epoch=sessionEpoch.current;
    const flush=async()=>{
      if(flushing.current||!navigator.onLine||disposed)return;
      flushing.current=true;
      try{
        for(const [id,position] of [...pendingProgress.current]){
          if(disposed||sessionEpoch.current!==epoch)break;
          // A queued write must not overtake an in-flight reader update.
          await (progressWrites.current.get(id)??Promise.resolve()).catch(()=>{});
          if(disposed||sessionEpoch.current!==epoch)break;
          if(pendingProgress.current.get(id)!==position)continue;
          try{
            await updatePrivateReadingProgress(API,privateToken,id,position);
            if(!disposed&&sessionEpoch.current===epoch&&pendingProgress.current.get(id)===position){pendingProgress.current.delete(id);persistPending();}
          }catch{break;}
        }
        for(const [id,favorite] of [...pendingFavorites.current]){
          if(disposed||sessionEpoch.current!==epoch)break;
          if(pendingFavorites.current.get(id)!==favorite)continue;
          try{
            await setPrivateFavorite(API,privateToken,id,favorite);
            if(!disposed&&sessionEpoch.current===epoch&&pendingFavorites.current.get(id)===favorite){pendingFavorites.current.delete(id);persistPending();}
          }catch{break;}
        }
      }finally{flushing.current=false;}
    };
    const onOnline=()=>{void flush();};
    // Retry transient server failures even when the browser never fires an online event.
    const retryInterval=window.setInterval(()=>{if(pendingProgress.current.size||pendingFavorites.current.size)void flush();},30000);
    window.addEventListener("online",onOnline);
    const onVisible=()=>{if(document.visibilityState==="visible")void flush();};
    document.addEventListener("visibilitychange",onVisible);
    void flush();
    return ()=>{
      disposed=true;
      window.clearInterval(retryInterval);
      window.removeEventListener("online",onOnline);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[privateToken]);
  // Reconnect only refreshes the authenticated library. Importing device books
  // still requires an explicit parent action, so no child data uploads silently.
  useEffect(()=>{
    if(!privateToken||!API||tab!=="library"||syncBusy)return;
    let disposed=false;
    let refreshing=false;
    const epoch=sessionEpoch.current;
    const refresh=async()=>{
      if(refreshing||!navigator.onLine)return;
      refreshing=true;
      try{
        const remote=await loadPrivateBooks(API,privateToken);
        if(disposed||sessionEpoch.current!==epoch)return;
        // Do not replace optimistic offline state with an older server snapshot.
        const merged=remote.map(book=>({
          ...book,
          favorite:pendingFavorites.current.get(book.id)??book.favorite,
          lastPage:pendingProgress.current.get(book.id)??book.lastPage
        }));
        // Protect newly created books from eventual-consistency lag, but never
        // retain a missing book forever after deletion or server reconciliation.
        const now=Date.now();
        for(const [id,createdAt] of recentlyCreated.current){
          if(now-createdAt>120000||merged.some(book=>book.id===id))recentlyCreated.current.delete(id);
        }
        const preserve=(previous:RemoteBook[])=>{
          const missing=previous.filter(book=>recentlyCreated.current.has(book.id)&&
            !merged.some(item=>item.id===book.id));
          return [...missing,...merged];
        };
        setRemoteBooks(preserve);
        setBooks(previous=>preserve(previous.filter(book=>!isDemoBook(book))));
      }catch(error){
        if(disposed||sessionEpoch.current!==epoch)return;
        if(error instanceof Error&&error.message==="Private account authorization expired"){
          ++sessionEpoch.current;
          setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);
          setSyncMessage({
            ru:"Сессия истекла. Войдите снова.",
            uz:"Sessiya tugadi. Qayta kiring.",
            en:"Your session expired. Sign in again."
          }[lang]);
        }
        // Keep the last loaded library visible during temporary network errors.
      }finally{refreshing=false;}
    };
    window.addEventListener("online",refresh);
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{
      disposed=true;
      window.removeEventListener("online",refresh);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[privateToken,tab,syncBusy,lang]);
  const toggleFavorite=async()=>{
    if(!active)return;
    if(isDemoBook(active)){
      const favorite=!active.favorite;
      const saved=getDemoBooks();
      saveDemoBooks(saved.map(book=>book.id===active.id?{...book,favorite}:book));
      setBooks(prev=>prev.map(book=>book.id===active.id?{...book,favorite}:book));
      setActive(prev=>prev?{...prev,favorite}:null);
      return;
    }
    if(!privateToken||!API)return;
    const bookId=active.id;
    const epoch=sessionEpoch.current;
    const writeKey=epoch+":"+bookId;
    if(favoriteWrites.current.has(writeKey))return;
    favoriteWrites.current.add(writeKey);
    try{
      const favorite=!active.favorite;
      try{
        await setPrivateFavorite(API,privateToken,bookId,favorite);
        if(sessionEpoch.current!==epoch)return;
        if(pendingFavorites.current.get(bookId)===favorite){pendingFavorites.current.delete(bookId);persistPending();}
      }catch(error){
        if(sessionEpoch.current===epoch&&!(error instanceof Error&&error.message==="Private account authorization expired")){
          pendingFavorites.current.set(bookId,favorite);
          persistPending();
          setBooks(prev=>prev.map(book=>book.id===bookId?{...book,favorite}:book));
          setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,favorite}:book));
          setActive(prev=>prev?.id===bookId?{...prev,favorite}:prev);
          return;
        }
        throw error;
      }
      if(sessionEpoch.current!==epoch)return;
      setBooks(prev=>prev.map(book=>book.id===bookId?{...book,favorite}:book));
      setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,favorite}:book));
      setActive(prev=>prev?.id===bookId?{...prev,favorite}:prev);
      setError("");
    }catch{
      if(sessionEpoch.current===epoch)setError(t.genericError);
    }finally{
      favoriteWrites.current.delete(writeKey);
    }
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
    // Use a matching installed voice when the browser provides one.
    // Never silently substitute an English voice for Uzbek or Russian.
    const voice=engine.getVoices().find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase())
      ||engine.getVoices().find(v=>v.lang.toLowerCase().split("-")[0]===utterance.lang.toLowerCase().split("-")[0]);
    if(voice)utterance.voice=voice;
    utterance.rate=0.86;
    utterance.onend=()=>{setSpeaking(false);setSpeechPaused(false);};
    utterance.onerror=event=>{
      setSpeaking(false);setSpeechPaused(false);
      if(event.error!=="canceled"&&event.error!=="interrupted")setError(t.noVoice);
    };
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
    e.preventDefault();
    if(busy)return;
    setError("");
    setBusy(true);
    try{
      if(usePersonalAi){
        const epoch=sessionEpoch.current;
        if(prompt.trim().length<12){
          throw new Error(({ru:"Опишите идею сказки минимум 12 символами.",uz:"Ertak ğoyasini kamida 12 ta belgi bilan yozing.",en:"Describe the story idea in at least 12 characters."} as const)[lang]);
        }
        if(!API||!privateToken){
          throw new Error(({ru:"Войдите в аккаунт родителя для AI-генерации.",uz:"AI ertak yaratiş uçun ota-ona akkauntiga kiring.",en:"Sign in to a parent account to generate AI stories."} as const)[lang]);
        }
        if(photo){
          throw new Error(({ru:"AI-генерация пока не принимает фото ребёнка. Удалите фото и повторите.",uz:"AI hozirça bolaning rasmini qabul qilmaydi. Rasmni olib taşlang.",en:"AI generation does not accept child photos yet. Remove the photo first."} as const)[lang]);
        }
        const data={
          name:name.trim(),age:Number(age),language:storyLang,
          classic_title:activeClassic?.title[storyLang]||"",
          idea:prompt.trim(),style,other_heroes:secondHero.trim()?[secondHero.trim()]:[],
          pages_count:8,
        };
        const response=await fetch(API+"/api/books/generate",{
          method:"POST",
          headers:{"Authorization":"Bearer "+privateToken,"Content-Type":"application/json"},
          body:JSON.stringify(data),
          signal:AbortSignal.timeout(120000),
        });
        if(!response.ok){
          if(response.status===401){
            throw new Error(({ru:"Сессия истекла. Войдите в аккаунт родителя снова.",uz:"Sessiya tugadi. Ota-ona akkauntiga qayta kiring.",en:"Your session has expired. Sign in to the parent account again."} as const)[lang]);
          }
          if(response.status===409){
            throw new Error(({ru:"Библиотека заполнена. Удалите ненужную сказку перед созданием новой.",uz:"Kutubxona tölgan. Yangi ertakdan oldin keraksizini öçiring.",en:"Your library is full. Delete a story before creating another."} as const)[lang]);
          }
          if(response.status===403||response.status===503){
            throw new Error(({ru:"AI-генерация пока не включена для этого аккаунта.",uz:"AI yaratiş uşbu akkaunt uçun hali yoqilmagan.",en:"AI generation is not enabled for this account yet."} as const)[lang]);
          }
          if(response.status===429){
            throw new Error(({ru:"Дневной лимит AI-сказок исчерпан.",uz:"Kunlik AI ertaklar limiti tugadi.",en:"Daily AI story limit reached."} as const)[lang]);
          }
          throw new Error(t.generateError);
        }
        const result:unknown=await response.json();
        if(!result||typeof result!=="object")throw new Error(t.generateError);
        const generated=result as {id?:unknown;title?:unknown;pages?:unknown;created_at?:unknown};
        if(typeof generated.id!=="string"||!/^[a-f0-9-]{36}$/i.test(generated.id)||
           typeof generated.title!=="string"||!generated.title.trim()||generated.title.length>120||
           !Array.isArray(generated.pages)||generated.pages.length!==data.pages_count||
           !generated.pages.every(p=>p&&typeof p.text==="string"&&
             p.text.trim().length>=70&&p.text.length<=1200))throw new Error(t.generateError);
        if(sessionEpoch.current!==epoch)return;
        // POST succeeded: show the saved story immediately even if the follow-up
        // library GET fails. Never encourage a duplicate paid generation.
        const created:RemoteBook={
          id:generated.id,created_at:typeof generated.created_at==="string"?generated.created_at:new Date().toISOString(),
          title:generated.title,name:data.name,age:data.age,language:storyLang,
          theme:data.classic_title,prompt:data.idea,style:data.style,
          pages:generated.pages.map((p:{text:string},index:number)=>({
            number:index+1,text:p.text,image_url:"/images/wondertale-hero.webp"
          })),mode:"private-account",favorite:false,lastPage:0
        };
        recentlyCreated.current.set(created.id,Date.now());
        setRemoteBooks(prev=>[created,...prev.filter(book=>book.id!==created.id)]);
        setBooks(prev=>[created,...prev.filter(book=>book.id!==created.id)]);
        openBook(created);
        try{
          const refreshed=await loadPrivateBooks(API,privateToken);
          if(sessionEpoch.current===epoch){
            const merged=refreshed.map(book=>({
              ...book,
              favorite:pendingFavorites.current.get(book.id)??book.favorite,
              lastPage:pendingProgress.current.get(book.id)??book.lastPage
            }));
            // A lagging read replica may not expose the newly committed book yet.
            // Keep it visible until the server includes it in a later snapshot.
            const visible=merged.some(book=>book.id===created.id)?merged:[created,...merged];
            if(merged.some(book=>book.id===created.id))recentlyCreated.current.delete(created.id);
            setRemoteBooks(visible);
            setBooks(visible);
          }
        }catch{
          // Keep the committed story on screen until a later library refresh.
        }
        return;
      }
      const heroes=secondHero.trim()?name.trim()+({ru:" и ",uz:" va ",en:" and "}[storyLang])+secondHero.trim():name.trim();
      const book=createDemoBook(heroes,Number(age),theme,style,prompt,storyLang,classicId||undefined,saveOnDevice);
      // When signed in, demo books stay in the browser only and are not shown
      // in the parent's remote library until explicitly transferred.
      if(!privateToken)setBooks(previous=>[book,...previous]);
      openBook(book);
    }catch(e){setError(e instanceof Error?e.message:t.genericError);}
    finally{setBusy(false);}
  };
  const deleteBook=async(book:Book)=>{
    if(!confirm(t.deleteConfirm))return;
    try{if(isDemoBook(book)){saveDemoBooks(getDemoBooks().filter(b=>b.id!==book.id));}else{if(!privateToken)throw new Error("Parent login required");const r=await fetch(API+"/api/books/"+book.id,{method:"DELETE",headers:{Authorization:"Bearer "+privateToken}});if(!r.ok)throw new Error("Ошибка удаления");pendingProgress.current.delete(book.id);pendingFavorites.current.delete(book.id);recentlyCreated.current.delete(book.id);persistPending();setRemoteBooks(prev=>prev.filter(b=>b.id!==book.id));}setBooks(prev=>prev.filter(b=>b.id!==book.id));setTab("library");setActive(null);}
    catch{setError(t.deleteError);}
  };
  const heading=(label:string,sub:string)=><div className="section-heading"><h2>{label}</h2><p>{sub}</p></div>;
  if(accountAction)return <AccountAction kind={accountAction.kind} token={accountAction.token} api={API} lang={lang} onDone={()=>{setAccountAction(null);setTab("home");}}/>;
  if(showOnboarding&&!privateToken)return <section className="welcome-screen" aria-label="WonderTale AI welcome" onTouchStart={onWelcomeTouchStart} onTouchEnd={onWelcomeTouchEnd} onKeyDown={event=>{if(event.key==="ArrowRight")setOnboardingStep(current=>Math.min(2,current+1));if(event.key==="ArrowLeft")setOnboardingStep(current=>Math.max(0,current-1));}}>
    <div className="welcome-art" aria-hidden="true"><img src="/images/wondertale-welcome.png" alt=""/></div>
    <div className="welcome-shade" aria-hidden="true"/>
    <div className="welcome-content">
      <div className="welcome-brand"><Crown size={27} fill="#ffd67a"/><span>WonderTale <strong>AI</strong></span></div>
      <h1>{[
        {ru:"Ваш ребёнок — герой собственной сказки",uz:"Farzandingiz öz ertagining qahramoni",en:"Your child is the hero of their own story"},
        {ru:"Волшебные истории каждый день",uz:"Har kuni sehrli hikoyalar",en:"Magical stories every day"},
        {ru:"Создавайте и сохраняйте сказки",uz:"Ertaklar yarating va saqlang",en:"Create and save stories"},
      ][onboardingStep][lang]}</h1>
      <div className="welcome-dots" role="group" aria-label="Onboarding slides">{[0,1,2].map(n=><button key={n} type="button" className={n===onboardingStep?"active":""} onClick={()=>setOnboardingStep(n)} aria-label={({ru:`Экран ${n+1} из 3`,uz:`${n+1}-sahifa, jami 3`,en:`Slide ${n+1} of 3`} as const)[lang]} aria-current={n===onboardingStep?"step":undefined}/>)}</div>
      <button type="button" className="welcome-primary" onClick={()=>onboardingStep<2?setOnboardingStep(n=>n+1):finishOnboarding("home")}>{onboardingStep<2?({ru:"Начать",uz:"Boşlaş",en:"Get started"} as const)[lang]:({ru:"Открыть сказки",uz:"Ertaklarni oçiş",en:"Explore stories"} as const)[lang]} <Sparkles size={18}/></button>
      <button type="button" className="welcome-secondary" onClick={()=>finishOnboarding("account")}>{({ru:"У меня уже есть аккаунт",uz:"Menda akkaunt bor",en:"I already have an account"} as const)[lang]}</button>
    </div>
  </section>;
  return <div className="shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setTab("home")} aria-label={t.backHome}><span className="brandmark"><img src="/icons/icon-192.png" alt="" /></span><span>Wonder<span className="brandaccent">Tale</span><small>AI STORY STUDIO</small></span></button>
      <div className="header-actions"><label className="language-control"><span className="sr-only">{t.interfaceLanguage}</span><select aria-label={t.interfaceLanguage} value={lang} onChange={e=>switchLang(e.target.value as Lang)}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button className="small-button" onClick={()=>setTab("account")}><UserRound size={17}/> <span>{({ru:"Аккаунт",uz:"Akkaunt",en:"Account"} as const)[lang]}</span></button></div>
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
          <label className="upload"> <ImagePlus size={25}/><strong>{photo?photo.name:t.photo}</strong><small>{t.photoHint}</small><input type="file" accept="image/jpeg,image/png,image/webp" disabled={usePersonalAi} onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
          {photo&&<button type="button" className="secondary-button" onClick={()=>setPhoto(null)}>{({ru:"Убрать фото",uz:"Rasmni olib taşlaş",en:"Remove photo"} as const)[lang]}</button>}
          <div className="step-title next"><span>02</span><div><h3>{t.classicFormTitle}</h3><p>{t.storyStepDesc}</p></div></div>
          <div className="classic-choice"><button type="button" className={!classicId?"active":""} onClick={()=>{setClassicId(null);setPrompt("");}}>{t.classicCustom}</button>{classics.map(item=><button type="button" className={classicId===item.id?"active":""} key={item.id} onClick={()=>{setClassicId(item.id);setThemeIndex(item.themeIndex);setPrompt(item.prompt[storyLang]);}}>{item.title[lang]}</button>)}</div>
          {activeClassic&&<p className="classic-selected"><CheckCircle2 size={16}/> {t.classicSelected}: <strong>{activeClassic.title[lang]}</strong></p>}
          <label>{t.world}</label><div className="chips">{themes.map((x,i)=><button type="button" key={x} className={"chip "+(themeIndex===i?"selected":"")} onClick={()=>setThemeIndex(i)}>{x}</button>)}</div>
          <label className="story-preset-label">{t.storyIdeas}</label>
          <div className="story-preset-actions">{storyPresets[storyLang].map(preset=><button type="button" key={preset.id} onClick={()=>{setClassicId(null);setPrompt(preset.idea);setThemeIndex(preset.id==="bedtime"?5:preset.id==="confidence"?4:0);}}>{preset.title}</button>)}</div>
          <label>{t.about}<textarea required minLength={8} maxLength={1200} rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={t.promptExample}/></label>
          <label>{t.style}<select value={styleIndex} onChange={e=>setStyleIndex(Number(e.target.value))}>{styles.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>
          <div className="story-lang-field"><label>{t.storyLanguage}</label><div className="story-lang-options">{languages.map(l=><button type="button" className={storyLang===l.id?"active":""} key={l.id} onClick={()=>changeStoryLanguage(l.id)}>{l.id.toUpperCase()} {storyLang===l.id&&<CheckCircle2 size={15}/>}</button>)}</div></div>
          <div className="story-lang-field"><label>{({ru:"Режим создания",uz:"Yaratiş rejimi",en:"Creation mode"} as const)[lang]}</label><div className="story-lang-options"><button type="button" className={!usePersonalAi?"active":""} onClick={()=>setUsePersonalAi(false)}>{({ru:"Демо",uz:"Demo",en:"Demo"} as const)[lang]}</button><button type="button" className={usePersonalAi?"active":""} onClick={()=>setUsePersonalAi(true)}>{({ru:"AI (аккаунт)",uz:"AI (akkaunt)",en:"AI (account)"} as const)[lang]}</button></div></div>
          {usePersonalAi&&<p className="notice">{({ru:"AI создаёт только текст, без фото ребёнка и персональных иллюстраций. Требуются вход в аккаунт и доступ к пилотной AI-генерации.",uz:"AI faqat matn yaratadi. Bolaning rasmi yuborilmaydi. Akkaunt va AI sinov ruxsati kerak.",en:"AI currently generates text only, without child photos or custom illustrations. A parent account and pilot AI access are required."} as const)[lang]}</p>}
          {!usePersonalAi&&<div className="device-save-option">
            <label><input type="checkbox" checked={saveOnDevice} onChange={e=>setSaveOnDevice(e.target.checked)}/><span><strong>{t.deviceSave}</strong><small>{saveOnDevice?t.deviceSaveHint:t.sessionOnly}</small></span></label>
          </div>}
          <label className="consent"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
          {!usePersonalAi&&<p className="notice">{activeClassic?t.classicDemo:t.demo}</p>}
          {error&&<p className="error" role="alert">{error}</p>}
          <button className="primary-button full" disabled={busy||!consent} type="submit"><Sparkles size={18}/>{busy?t.creating:t.createBook}<ArrowRight size={18}/></button>
        </form>
      </section>}
      {tab==="account"&&<><ParentAccount lang={lang} api={API} session={privateToken} syncedCount={remoteBooks.length} syncBusy={syncBusy} onLogin={loginParent} onLogout={logoutParent} onSync={syncSaved}/>{syncMessage&&<p className="parent-account-result" role="status">{syncMessage}</p>}<PricingPlans lang={lang}/></>}
      {tab==="library"&&<section className="library-page">{heading(t.libraryTitle,t.libraryDesc)}<button className="primary-button add-book" onClick={()=>setTab("create")}><Plus size={18}/> {t.newStory}</button>{error&&<p className="error">{error}</p>}
        {books.length>0&&<div className="library-filters" role="group"><button type="button" className={!favoritesOnly?"active":""} onClick={()=>setFavoritesOnly(false)}>{t.allBooks}</button><button type="button" className={favoritesOnly?"active":""} onClick={()=>setFavoritesOnly(true)}><Heart size={15}/>{t.favorites}</button></div>}
        {(favoritesOnly?books.filter(book=>book.favorite):books).length?<div className="book-grid">{(favoritesOnly?books.filter(book=>book.favorite):books).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty"><BookOpen size={30}/><h3>{favoritesOnly?t.noFavorites:t.empty}</h3><p>{favoritesOnly?"":t.emptyDesc}</p></div>}</section>}
      {tab==="reader"&&active&&<section className="reader-page">
        <div className="reader-toolbar"><button className="back-button" onClick={()=>setTab("library")}><ArrowLeft size={17}/> {t.backLibrary}</button><div className="reader-actions"><button className="icon-button" type="button" onClick={()=>window.print()} title={t.savePdf}><Download size={19}/></button>{(isDemoBook(active)||privateToken)&&<button className="icon-button" onClick={()=>void toggleFavorite()} title={active.favorite?t.unfavorite:t.favorite} aria-label={active.favorite?t.unfavorite:t.favorite}><Heart size={19} fill={active.favorite?"currentColor":"none"}/></button>}<button className="icon-button dangerous" onClick={()=>deleteBook(active)} title={t.delete}><Trash2 size={19}/></button></div></div>
        {error&&<p className="error" role="alert">{error}</p>}
        <div className="reader-title"><span className="reader-crown"><Crown size={19}/></span><span>{t.forChild} {active.name}</span>{isDemoBook(active)&&(active as import("./demo").DemoBook).savedOnDevice&&<span className="reader-saved-tag"><CheckCircle2 size={14}/>{t.savedOnDevice}</span>}<h2>{active.title}</h2><p>{t.page} {page+1} {t.of} {active.pages.length}</p></div>
        <div className="reader-audio-toolbar"><button type="button" onClick={speakPage}><Volume2 size={17}/>{speaking?(speechPaused?t.resumeAudio:t.pauseAudio):t.listen}{speaking?(speechPaused?<Play size={16}/>:<PauseCircle size={16}/>):null}</button>{speaking&&<button type="button" onClick={stopSpeech}><Square size={15}/>{t.stopAudio}</button>}</div>
        <div className="story-page"><div className="story-page-image"><img src={bookImage(active.pages[page].image_url)} alt={t.illustration+" "+(page+1)} /></div><div className="story-text"><span className="dropcap-star">✦</span>{active.pages[page].text}</div></div>
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
        {<article className="print-book" aria-hidden="true">
          <div className="print-book-cover"><img src={bookImage(active.pages[0].image_url)} alt=""/><h1>{active.title}</h1><p>{t.forChild} {active.name}</p><small>WonderTale AI</small></div>
          {active.pages.map((item,index)=><section className="print-book-page" key={item.number}><div className="print-book-page-head"><span>WonderTale AI</span><span>{t.page} {index+1} {t.of} {active.pages.length}</span></div><img src={bookImage(item.image_url)} alt=""/><p>{item.text}</p></section>)}
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
      <nav className="mobile-tabbar" aria-label="WonderTale"><button type="button" className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Home size={21}/><span>{t.backHome}</span></button><button type="button" className={tab==="library"||tab==="reader"?"active":""} onClick={()=>setTab("library")}><Library size={21}/><span>{t.library}</span></button><button type="button" className={tab==="create"?"active":""} onClick={()=>setTab("create")}><Plus size={22}/><span>{t.create}</span></button><button type="button" className={tab==="account"?"active":""} onClick={()=>setTab("account")}><UserRound size={21}/><span>{({ru:"Аккаунт",uz:"Akkaunt",en:"Account"} as const)[lang]}</span></button></nav>
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
  return <button className="book-tile" onClick={open}><img src={bookImage(book.pages[0].image_url)} alt={labels[lang].cover}/><span className="book-caption"><strong>{book.title}</strong><small>{book.name} · {book.pages.length} {labels[lang].pages}</small>{(book.lastPage||0)>0&&<small className="read-progress">{labels[lang].continueReading}: {labels[lang].page} {(book.lastPage||0)+1}</small>}{book.favorite&&<span className="book-favorite-badge"><Heart size={14} fill="currentColor"/></span>}</span></button>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA remains usable online */});});}
