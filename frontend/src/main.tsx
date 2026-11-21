import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { BookOpen, Sparkles, ArrowLeft, ArrowRight, Plus, Download, Trash2, Film, ImagePlus, Heart, Library, WandSparkles, Home, UserRound, PlayCircle, MoonStar, Crown, CheckCircle2, Trees, Castle, House, Apple, Bird, Music2, Search, SlidersHorizontal, ChevronDown, ChevronRight, ChevronUp, Volume2, PauseCircle, Square, Play, Star, ZoomIn, ZoomOut, X } from "lucide-react";
import "./style.css";
import "./storybook-theme.css";
import "./reader-polish.css";
import "./bedtime-games.css";
import "./profile-concept-three.css";
import "./ai-jobs.css";
import "./illustration-consent.css";
import "./library-concept-two.css";
import "./library-mobile-fixes.css";
import "./library-final-polish.css";
import "./library-exact-reference.css";
import "./library-screenshot-fixes.css";
import "./create-reference.css";
import "./create-step-two.css";
import "./create-step-one-button.css";
import "./shared-rounded-pages.css";
import "./reader-book-variants.css";
import "./reader-page-turn.css";
import "./reader-image-fullwidth.css";
import "./reader-living-art.css";
import "./reader-image-lightbox.css";
import "./reader-mobile-v1.css";
import {startReaderAmbience,readerAmbienceForClassic,type AmbiencePlayback} from "./reader_ambience";
import { readerZoomLabels } from "./reader_zoom_labels";
import { clampReaderZoom, readerFingerDistance } from "./reader_zoom_gestures";
import { createDemoBook, createDemoSequel, getDemoBooks, getLocalLibraryHealth, saveDemoBooks, isDemoBook, canRefreshClassicDemoStory, refreshClassicDemoStory, type DemoBook } from "./demo";
import { checkAiStoryAccess } from "./ai_preflight";
import {enqueueAiJob} from "./ai_jobs";
import {AiJobsPanel} from "./AiJobsPanel";
import {IllustrationConsentPanel} from "./IllustrationConsentPanel";
import {PrivateReaderIllustration} from "./PrivateReaderIllustration";
import {classicReaderImage,classicPngFallback,classicAnimatedPage} from "./classic_page_art";
import { labels, languages, getSavedLanguage, saveLanguage, type Lang } from "./i18n";
import { classics, type ClassicId, type Classic } from "./classics";
import { ClassicCover } from "./ClassicCover";
import { AccountAction } from "./AccountAction";
import { PricingPlans } from "./PricingPlans";
import { ParentAccount } from "./ParentAccount";
import { LegalCenter, type LegalDocument } from "./LegalCenter";
import { ProfileLegalMenu } from "./ProfileLegalMenu";
import { ProfileHeader } from "./ProfileHeader";
import { StoryChildPicker } from "./StoryChildPicker";
import { loadPrivateBooks, transferLocalBooks, validateSession, setPrivateFavorite, updatePrivateReadingProgress, PrivateBookNotFoundError, type RemoteBook } from "./private_library";
import { endings, storyPresets, type EndingId } from "./story_interactions";
import { canAppendStoryEnding } from "./ending_length";
import { translateSelectedStoryPrompt, leaveClassicStoryPrompt, shouldDetachClassicOnEdit } from "./story_language";
import { getAuthenticatedOwner, normalizePendingProgress, readPendingMetadata, writePendingMetadata } from "./offline_queue";
import { replayPendingChanges } from "./offline_replay";
import { resolveBookImage } from "./book_images";
import { printFullBook } from "./print_book";
import { nextReaderPage, resumeReaderPage, swipeDirection } from "./reader_navigation";
import { discoverBooks, type LibrarySort } from "./library_discovery";
import { getReadingAchievements } from "./reading_achievements";
import { StoryBranchQuest } from "./StoryBranchQuest";
import { CharacterBuilder } from "./CharacterBuilder";

type Page={number:number;text:string;image_url:string};
type Book={id:string;created_at:string;name:string;age:number;theme:string;prompt:string;style:string;title:string;pages:Page[];mode:string;language?:Lang;favorite?:boolean;lastPage?:number;savedOnDevice?:boolean;originalEnding?:string;endingChoice?:EndingId};
const API=(import.meta.env.VITE_API_BASE || "").replace(/\/$/,"");
// Disabled by default until a separate trusted AI worker is provisioned.
const AI_JOBS_ENABLED=import.meta.env.VITE_ENABLE_AI_JOB_QUEUE==="true";
const bookImage=(url:string)=>resolveBookImage(url,API);

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
  const readLegalHash=():LegalDocument|null=>{
    const match=window.location.hash.match(/^#legal\/(terms|privacy|copyright|parents)$/);
    return match?match[1] as LegalDocument:null;
  };
  const [tab,setTab]=useState<"home"|"create"|"library"|"reader"|"account"|"legal">(()=>readLegalHash()?"legal":"home");
  const [legalDocument,setLegalDocument]=useState<LegalDocument>(()=>readLegalHash()||"terms");
  const [legalReturnTab,setLegalReturnTab]=useState<"home"|"create"|"library"|"reader"|"account">("home");
  const openLegal=(document:LegalDocument)=>{
    if(tab!=="legal")setLegalReturnTab(tab);
    setLegalDocument(document);setTab("legal");
    window.history.replaceState(null,"",window.location.pathname+window.location.search+"#legal/"+document);
  };
  useEffect(()=>{
    const onHash=()=>{
      const doc=readLegalHash();
      if(doc){setLegalDocument(doc);setTab("legal");}
      else setTab(previous=>previous==="legal"?"home":previous);
    };
    window.addEventListener("hashchange",onHash);
    return ()=>window.removeEventListener("hashchange",onHash);
  },[]);
  useEffect(()=>{
    if(tab!=="legal"&&window.location.hash.startsWith("#legal/")){
      window.history.replaceState(null,"",window.location.pathname+window.location.search);
    }
  },[tab]);
  const [isOnline,setIsOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{
    const online=()=>setIsOnline(true);
    const offline=()=>setIsOnline(false);
    window.addEventListener("online",online);
    window.addEventListener("offline",offline);
    return ()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
  },[]);

  const [onboardingStep,setOnboardingStep]=useState(0);
  const welcomeTouchStart=useRef<{x:number;y:number;identifier:number}|null>(null);
  const onWelcomeTouchStart=(event:React.TouchEvent<HTMLElement>)=>{
    if(event.touches.length!==1){welcomeTouchStart.current=null;return;}
    const touch=event.touches[0];
    welcomeTouchStart.current={x:touch.clientX,y:touch.clientY,identifier:touch.identifier};
  };
  const onWelcomeTouchMove=(event:React.TouchEvent<HTMLElement>)=>{
    if(event.touches.length!==1)welcomeTouchStart.current=null;
  };
  const onWelcomeTouchEnd=(event:React.TouchEvent<HTMLElement>)=>{
    const start=welcomeTouchStart.current;
    welcomeTouchStart.current=null;
    if(!start||event.touches.length!==0||event.changedTouches.length!==1)return;
    const touch=Array.from(event.changedTouches).find(item=>item.identifier===start.identifier);
    if(!touch)return;
    const dx=touch.clientX-start.x;
    const dy=touch.clientY-start.y;
    if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.3)return;
    setOnboardingStep(current=>Math.max(0,Math.min(2,current+(dx<0?1:-1))));
  };
  const onWelcomeTouchCancel=()=>{welcomeTouchStart.current=null;};
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
  // Failed login attempts must not invalidate an already authenticated session.
  const loginAttempt=useRef(0);
  // Serialize writes per book so rapid page turns cannot overwrite newer progress.
  const progressWrites=useRef(new Map<string,Promise<void>>());
  // A favorite endpoint toggles its state, so never overlap requests for one book.
  const favoriteWrites=useRef(new Set<string>());
  // Session-scoped offline changes. Never replay a previous parent's changes
  // into a different account, and never persist bearer tokens on the device.
  const pendingProgress=useRef(new Map<string,number>());
  const pendingFavorites=useRef(new Map<string,boolean>());
  const flushing=useRef<number|null>(null);
  const recentlyCreated=useRef(new Map<string,number>());
  const transferAbort=useRef<AbortController|null>(null);
  const aiRetry=useRef<{token:string;payload:string;key:string}|null>(null);
  const offlineOwner=useRef<string|null>(null);
  const persistPending=()=>{
    if(!offlineOwner.current)return;
    writePendingMetadata(offlineOwner.current,{
      progress:Object.fromEntries(pendingProgress.current),
      favorites:Object.fromEntries(pendingFavorites.current)
    });
  };
  // iOS may suspend a PWA without completing outstanding network requests.
  // Flush the per-parent offline metadata when the page is hidden or closed.
  useEffect(()=>{
    const saveOnExit=()=>persistPending();
    const saveOnHidden=()=>{if(document.visibilityState==="hidden")persistPending();};
    window.addEventListener("pagehide",saveOnExit);
    document.addEventListener("visibilitychange",saveOnHidden);
    return ()=>{
      window.removeEventListener("pagehide",saveOnExit);
      document.removeEventListener("visibilitychange",saveOnHidden);
    };
  },[]);
  const [remoteBooks,setRemoteBooks]=useState<RemoteBook[]>([]);
  const [syncBusy,setSyncBusy]=useState(false);
  const [syncMessage,setSyncMessage]=useState("");
  const [libraryRefreshError,setLibraryRefreshError]=useState(false);
  const [libraryRefreshAttempt,setLibraryRefreshAttempt]=useState(0);
  const [active,setActive]=useState<Book|null>(null);
  const [page,setPage]=useState(0);
  const storyPageRef=useRef<HTMLDivElement|null>(null);
  const previousReaderPageRef=useRef<{id:string;page:number}|null>(null);
  const [editingPage,setEditingPage]=useState(false);
  const readerTouchStart=useRef<{x:number;y:number;identifier:number}|null>(null);
  const onReaderTouchStart=(event:React.TouchEvent<HTMLElement>)=>{
    // Never turn a page during a two-finger pinch or interrupted gesture.
    if(event.touches.length!==1){readerTouchStart.current=null;return;}
    const touch=event.touches[0];
    readerTouchStart.current={x:touch.clientX,y:touch.clientY,identifier:touch.identifier};
  };
  const onReaderTouchMove=(event:React.TouchEvent<HTMLElement>)=>{
    // A second finger may enter outside the reader after the first touch.
    // Once multi-touch is observed, the gesture cannot become a page turn.
    if(event.touches.length!==1)readerTouchStart.current=null;
  };
  const onReaderTouchEnd=(event:React.TouchEvent<HTMLElement>)=>{
    const start=readerTouchStart.current;
    readerTouchStart.current=null;
    // Only the finger that started the swipe may complete it.
    if(!start||event.touches.length!==0||event.changedTouches.length!==1||!active||editingPage)return;
    const touch=Array.from(event.changedTouches).find(item=>item.identifier===start.identifier);
    if(!touch)return;
    if(window.getSelection()?.toString().trim())return;
    const direction=swipeDirection(touch.clientX-start.x,touch.clientY-start.y);
    if(direction===null)return;
    setPage(previous=>nextReaderPage(previous,active.pages.length,direction));
  };
  const onReaderTouchCancel=()=>{readerTouchStart.current=null;};
  // Return to the new story page after a pager click, swipe or arrow key.
  // Do not skip the title when the reader opens for the first time.
  useEffect(()=>{
    if(tab!=="reader"||!active){previousReaderPageRef.current=null;return;}
    const previous=previousReaderPageRef.current;
    previousReaderPageRef.current={id:active.id,page};
    if(previous?.id===active.id&&previous.page!==page){
      storyPageRef.current?.scrollIntoView({behavior:"auto",block:"start"});
    }
  },[tab,active?.id,page]);
  useEffect(()=>{
    if(tab!=="reader"||!active||editingPage)return;
    const onKeyDown=(event:KeyboardEvent)=>{
      const target=event.target;
      if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
         (target instanceof HTMLElement&&(target.isContentEditable||!!target.closest("button, a, input, textarea, select, [role='button'], [role='dialog'], [contenteditable='true']"))))return;
      if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
      event.preventDefault();
      setPage(previous=>nextReaderPage(previous,active.pages.length,event.key==="ArrowRight"?1:-1));
    };
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[tab,active?.id,active?.pages.length,editingPage]);
  const [readerFontScale,setReaderFontScale]=useState<"small"|"normal"|"large">(()=>{
    try{const saved=localStorage.getItem("wondertale_reader_font_scale");return saved==="small"||saved==="large"?saved:"normal";}catch{return "normal";}
  });
  const [readerNightMode,setReaderNightMode]=useState(()=>{try{return localStorage.getItem("wondertale_reader_night_mode")==="true";}catch{return false;}});
  const [readerWarmMode,setReaderWarmMode]=useState(()=>{
    try{return localStorage.getItem("wondertale_reader_warm_mode")==="true";}catch{return false;}
  });
  const [readerBookStyle,setReaderBookStyle]=useState<"storybook"|"classic"|"spread"|"simple">(()=>{
    try{
      const saved=localStorage.getItem("wondertale_reader_book_style");
      return saved==="simple"||saved==="classic"||saved==="spread"?saved:"storybook";
    }catch{return "storybook";}
  });
  const [readerArtMotion,setReaderArtMotion]=useState<"off"|"gentle"|"magic">(()=>{
    try{const saved=localStorage.getItem("wondertale_reader_art_motion");return saved==="off"||saved==="gentle"||saved==="magic"?saved:"magic";}catch{return "magic";}
  });
  const [reduceArtMotion,setReduceArtMotion]=useState(()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false);
  useEffect(()=>{
    if(!window.matchMedia)return;
    const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduceArtMotion(mq.matches);
    update();
    mq.addEventListener?.("change",update);
    return ()=>mq.removeEventListener?.("change",update);
  },[]);
  const ambiencePlayback=useRef<AmbiencePlayback|null>(null);
  const [ambienceOn,setAmbienceOn]=useState(false);
  const stopAmbience=()=>{
    ambiencePlayback.current?.stop();
    ambiencePlayback.current=null;
    setAmbienceOn(false);
  };
  const toggleAmbience=()=>{
    if(ambiencePlayback.current){stopAmbience();return;}
    const classicId=isDemoBook(active as DemoBook)?(active as DemoBook).classicId:undefined;
    const playback=startReaderAmbience(readerAmbienceForClassic(classicId));
    if(playback){ambiencePlayback.current=playback;setAmbienceOn(true);}
  };
  useEffect(()=>{
    ambiencePlayback.current?.stop();
    ambiencePlayback.current=null;
    setAmbienceOn(false);
  },[active?.id,tab,readerNightMode,bedtimeUntil]);
  useEffect(()=>{
    const pause=()=>{
      if(document.visibilityState!=="visible"){
        ambiencePlayback.current?.stop();
        ambiencePlayback.current=null;
        setAmbienceOn(false);
      }
    };
    document.addEventListener("visibilitychange",pause);
    return ()=>{document.removeEventListener("visibilitychange",pause);ambiencePlayback.current?.stop();};
  },[]);
  const [readerFocusMode,setReaderFocusMode]=useState(false);
  const [bedtimeUntil,setBedtimeUntil]=useState<number|null>(null);
  const [wordGameAnswer,setWordGameAnswer]=useState<string|null>(null);
  const [readerEndActivity,setReaderEndActivity]=useState<"ending"|"adventure"|"game"|null>(null);
  useEffect(()=>{setWordGameAnswer(null);},[active?.id]);
  useEffect(()=>{
    if(bedtimeUntil===null)return;
    const remaining=bedtimeUntil-Date.now();
    if(remaining<=0){if("speechSynthesis" in window)window.speechSynthesis.cancel();setSpeaking(false);setSpeechPaused(false);setBedtimeUntil(null);return;}
    const timeout=window.setTimeout(()=>{
      if("speechSynthesis" in window)window.speechSynthesis.cancel();
      setSpeaking(false);setSpeechPaused(false);setBedtimeUntil(null);
    },remaining);
    return ()=>window.clearTimeout(timeout);
  },[bedtimeUntil]);
  const [readerSettingsOpen,setReaderSettingsOpen]=useState(false);
  useEffect(()=>{try{localStorage.setItem("wondertale_reader_book_style",readerBookStyle);}catch{/* Storage can be unavailable. */}},[readerBookStyle]);
  useEffect(()=>{try{localStorage.setItem("wondertale_reader_art_motion",readerArtMotion);}catch{/* Storage can be unavailable. */}},[readerArtMotion]);
  useEffect(()=>{try{localStorage.setItem("wondertale_reader_font_scale",readerFontScale);}catch{/* Browser storage can be unavailable. */}},[readerFontScale]);
  useEffect(()=>{try{localStorage.setItem("wondertale_reader_night_mode",String(readerNightMode));}catch{/* Browser storage can be unavailable. */}},[readerNightMode]);
  useEffect(()=>{try{localStorage.setItem("wondertale_reader_warm_mode",String(readerWarmMode));}catch{/* Browser storage can be unavailable. */}},[readerWarmMode]);
  const [name,setName]=useState("");
  const [heroKind,setHeroKind]=useState<"boy"|"girl"|"animal"|"robot"|"magical">("boy");
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
  const pickClassic=(id:ClassicId)=>{const item=classics.find(x=>x.id===id);if(!item)return;setClassicId(id);setThemeIndex(item.themeIndex);setPrompt(item.prompt[storyLang]);openCreate(true);};
  const changeStoryLanguage=(next:Lang)=>{
    if(next===storyLang)return;
    setPrompt(previous=>translateSelectedStoryPrompt(previous,storyLang,next,activeClassic?.prompt));
    setStoryLang(next);
  };
  const heroKindLabel=({ru:{boy:"Мальчик",girl:"Девочка",animal:"Животное",robot:"Робот",magical:"Волшебное существо"},uz:{boy:"Bola",girl:"Qiz",animal:"Hayvon",robot:"Robot",magical:"Sehrli jonzot"},en:{boy:"Boy",girl:"Girl",animal:"Animal",robot:"Robot",magical:"Magical creature"}} as const)[storyLang][heroKind];
  const storyIdeaWithHero=heroKind==="boy"?prompt.trim():prompt.trim()+" "+({ru:"Главный герой: ",uz:"Bosh qahramon: ",en:"Main hero: "} as const)[storyLang]+heroKindLabel+".";
  const combinedHeroName=secondHero.trim()?name.trim()+({ru:" и ",uz:" va ",en:" and "}[storyLang])+secondHero.trim():name.trim();
  const heroNameTooLong=combinedHeroName.length>60;
  const heroNameLengthError=({ru:"Имена двух героев вместе должны содержать не более 60 символов.",uz:"Ikki qahramon ismi birga 60 belgidan oshmasligi kerak.",en:"Both hero names together must be 60 characters or fewer."} as const)[lang];
  const [photo,setPhoto]=useState<File|null>(null);
  const [showInstallGuide,setShowInstallGuide]=useState(false);
  const [consent,setConsent]=useState(false);
  const [acceptedLegal,setAcceptedLegal]=useState(false);
  const [createStep,setCreateStep]=useState<1|2|3>(1);
  // Every new creation starts with the child, never with a stale confirmation step.
  const openCreate=(preservePreset=false)=>{
    setCreateStep(1);setConsent(false);setAcceptedLegal(false);setUsePersonalAi(false);setError("");
    // Avoid showing a previous child's personal details when starting a new story.
    setName("");setSecondHero("");setAge("5");setPhoto(null);setHeroKind("boy");
    if(!preservePreset){setClassicId(null);setPrompt("");setThemeIndex(0);setStyleIndex(0);}
    setTab("create");
  };
  const [saveOnDevice,setSaveOnDevice]=useState(false);
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [showLibraryAchievements,setShowLibraryAchievements]=useState(false);
  const [libraryShelf,setLibraryShelf]=useState<"all"|"favorites"|"saved"|"recent">("all");
  const [libraryQuery,setLibraryQuery]=useState("");
  const [librarySort,setLibrarySort]=useState<LibrarySort>("newest");
  const [libraryAge,setLibraryAge]=useState("all");
  const [pageDraft,setPageDraft]=useState("");
  const [speaking,setSpeaking]=useState(false);
  const [speechPaused,setSpeechPaused]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const libraryHealth=getLocalLibraryHealth();
  const localSaveError=libraryHealth==="corrupt"
    ?({ru:"В библиотеке обнаружены повреждённые или повторяющиеся записи. Изменения не сохранены, чтобы защитить сказки. Не очищайте данные Safari или PWA.",uz:"Kutubxonada shikastlangan yoki takroriy yozuvlar topildi. Ertaklarni saqlaş uçun özgarişlar yozilmadi. Safari yoki PWA ma’lumotlarini tozalamang.",en:"Damaged or duplicate records were found in your library. Changes were not saved to protect your stories. Do not clear Safari or PWA data."} as const)[lang]
    :libraryHealth==="unavailable"
    ?({ru:"Хранилище Safari недоступно. Не удалось сохранить изменения. Проверьте настройки браузера, не очищая данные сайта.",uz:"Safari xotirasi mavjud emas. Özgarişlar saqlanmadi. Sayt ma’lumotlarini öçirmasdan brauzer sozlamalarini tekşiring.",en:"Safari storage is unavailable. Changes were not saved. Check browser settings without clearing site data."} as const)[lang]
    :({ru:"Не удалось сохранить изменения на этом устройстве. Проверьте свободное место и настройки браузера.",uz:"Özgarişlarni qurilmaga saqlab bölmadi. Böş xotira va brauzer sozlamalarini tekşiring.",en:"Could not save changes on this device. Check available storage and browser settings."} as const)[lang];
  const [usePersonalAi,setUsePersonalAi]=useState(false);
  const [aiPagesCount,setAiPagesCount]=useState<8|12|20>(8);
  const [aiJobsRefresh,setAiJobsRefresh]=useState(0);

  // Child profile details must never carry over between parent sessions.
  const clearChildDraft=()=>{setName("");setAge("5");setSecondHero("");setPhoto(null);};

  // API health alone never authorizes uploading a child photo or generating a story.
  // The old demo FormData endpoint is not compatible with secure_main.py JSON routes.
  const loginParent=async(token:string):Promise<boolean>=>{
    // Account switching must not discard the previous parent's offline edits.
    persistPending();
    const attempt=++loginAttempt.current;
    // Keep the current account and its sync workers intact if login fails.
    if(!API||!await validateSession(API,token)||loginAttempt.current!==attempt)return false;
    try{
      const owner=await getAuthenticatedOwner(API,token);
      const remote=await loadPrivateBooks(API,token);
      if(loginAttempt.current!==attempt)return false;
      aiRetry.current=null;
      transferAbort.current?.abort();
      transferAbort.current=null;
      setSyncBusy(false);
      ++sessionEpoch.current;
      // Only replace the current owner's queue after the new session and library
      // have both been validated. A failed login must not erase offline edits.
      pendingProgress.current.clear();pendingFavorites.current.clear();
      recentlyCreated.current.clear();
      offlineOwner.current=owner;
      const pending=readPendingMetadata(owner);
      pendingProgress.current=normalizePendingProgress(new Map(Object.entries(pending.progress)),remote);
      pendingFavorites.current=new Map(Object.entries(pending.favorites));
      persistPending(); // Keep repaired positions for the next PWA restart.
      const merged=remote.map(book=>({
        ...book,
        favorite:pendingFavorites.current.get(book.id)??book.favorite,
        lastPage:pendingProgress.current.get(book.id)??book.lastPage
      }));
      clearChildDraft();
      // Search and favorites from the previous parent must not filter the new library.
      setLibraryShelf("all");setLibraryAge("all");
    setLibraryQuery("");setLibrarySort("newest");setFavoritesOnly(false);
      setPrivateToken(token);setRemoteBooks(merged);setBooks(merged);setActive(null);setPage(0);setEditingPage(false);setPageDraft("");setError("");setSyncMessage("");setTab("home");
      return true;
    }catch{return false;}
  };
  const logoutParent=()=>{
    aiRetry.current=null;
    transferAbort.current?.abort();
    transferAbort.current=null;
    setSyncBusy(false);
    ++loginAttempt.current;
    // Preserve unsynced reader progress for this parent before clearing in-memory state.
    persistPending();
    ++sessionEpoch.current;
    pendingProgress.current.clear();pendingFavorites.current.clear();
    offlineOwner.current=null;
    recentlyCreated.current.clear();
    const token=privateToken;
    clearChildDraft();
    setLibraryShelf("all");setLibraryAge("all");
    setLibraryQuery("");setLibrarySort("newest");setFavoritesOnly(false);
    setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);setPage(0);setEditingPage(false);setPageDraft("");setError("");setSyncMessage("");setTab("home");
    if(token&&API)void fetch(API+"/api/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+token}}).catch(()=>{});
  };
  const syncSaved=async()=>{
    if(!privateToken||!API||syncBusy)return;
    const epoch=sessionEpoch.current;
    const controller=new AbortController();
    transferAbort.current=controller;
    setSyncBusy(true);setSyncMessage("");
    try{
      const report=await transferLocalBooks(API,privateToken,getDemoBooks(),controller.signal);
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
        // Preserve offline edits for the same parent before discarding their
        // in-memory session. They can resume after signing in again.
        persistPending();
        ++sessionEpoch.current;
        pendingProgress.current.clear();pendingFavorites.current.clear();
        offlineOwner.current=null;recentlyCreated.current.clear();
        clearChildDraft();
        setLibraryShelf("all");setLibraryAge("all");
    setLibraryQuery("");setLibrarySort("newest");setFavoritesOnly(false);
        setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);setPage(0);setTab("home");
        setSyncMessage({
          ru:"Сессия истекла. Войдите снова, чтобы перенести сохранённые книги.",
          uz:"Sessiya tugadi. Saqlangan kitoblarni köçiriş uçun qayta kiring.",
          en:"Your session expired. Sign in again to transfer saved books."
        }[lang]);
      }else{
        setSyncMessage({ru:"Не удалось перенести книги. Попробуйте позднее.",uz:"Kitoblarni köçiriş amalga oşmadi. Keyinroq qayta urinib köring.",en:"Transfer failed. Please retry later."}[lang]);
      }
    }finally{
      if(transferAbort.current===controller){
        transferAbort.current=null;
        setSyncBusy(false);
      }
    }
  };
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  // Each SPA screen starts from its heading instead of retaining a deep catalog scroll offset.
  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:"instant"});
  },[tab]);
  useEffect(()=>{if(!privateToken)setBooks(getDemoBooks());},[privateToken]);
  const openBook=(book:Book)=>{
    setWordGameAnswer(null);setReaderEndActivity(null);
    setReaderFocusMode(false);setReaderSettingsOpen(false);
    setEditingPage(false);setActive(book);setPage(resumeReaderPage(book.lastPage,book.pages.length));setTab("reader");setError("");
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
    try{
      saveDemoBooks(saved.map(book=>book.id===active.id?{...book,lastPage:page}:book));
      setBooks(previous=>previous.map(book=>book.id===active.id?{...book,lastPage:page}:book));
    }catch{setError(localSaveError);}
  },[page,active?.id,tab]);
  useEffect(()=>{
    if(tab!=="reader"||!active||isDemoBook(active)||!privateToken||!API)return;
    const bookId=active.id;
    const epoch=sessionEpoch.current;
    // Persist the newest reading position before the network request starts.
    // A closed iPhone tab must not lose the last page while the API is pending.
    pendingProgress.current.set(bookId,page);
    persistPending();
    setBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
    setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
    // Serialize writes for each book: a slow response for page 1 must not
    // overwrite a newer page 3 on the server or in the interface.
    const token=privateToken;
    const next=progressWrites.current.get(bookId)??Promise.resolve();
    const write=next.catch(()=>{}).then(async()=>{
      // A later page turn supersedes queued positions, including after a
      // parent account switch. Only the latest pending page is sent.
      if(sessionEpoch.current!==epoch||pendingProgress.current.get(bookId)!==page)return;
      // Safari PWA can remain open while offline. The owner-scoped pending
      // queue is already persisted, so wait for the reconnect flush instead
      // of making a doomed request on every page turn.
      if(!navigator.onLine)return;
      try{
        await updatePrivateReadingProgress(API,token,bookId,page);
        if(sessionEpoch.current===epoch&&pendingProgress.current.get(bookId)===page){pendingProgress.current.delete(bookId);persistPending();}
      }catch(error){
        if(sessionEpoch.current===epoch&&pendingProgress.current.get(bookId)===page&&!(error instanceof Error&&error.message==="Private account authorization expired")){
          pendingProgress.current.set(bookId,page);
          persistPending();
          setBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
          setRemoteBooks(prev=>prev.map(book=>book.id===bookId?{...book,lastPage:page}:book));
        }
        throw error;
      }
      // A later page may already be queued; never overwrite it with this
      // older request's completion.
      if(sessionEpoch.current!==epoch||pendingProgress.current.has(bookId))return;
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
      if(flushing.current===epoch||!navigator.onLine||disposed)return;
      flushing.current=epoch;
      try{
        await replayPendingChanges({
          progress:pendingProgress.current,
          favorites:pendingFavorites.current,
          isActive:()=>!disposed&&sessionEpoch.current===epoch&&navigator.onLine,
          isMissingBook:error=>error instanceof PrivateBookNotFoundError,
          waitForProgress:id=>(progressWrites.current.get(id)??Promise.resolve()).catch(()=>{}),
          sendProgress:(id,page)=>updatePrivateReadingProgress(API,privateToken,id,page),
          sendFavorite:(id,favorite)=>setPrivateFavorite(API,privateToken,id,favorite),
          persist:persistPending
        });
      }finally{if(flushing.current===epoch)flushing.current=null;}
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
      if(refreshing||disposed)return;
      if(!navigator.onLine){setLibraryRefreshError(true);return;}
      refreshing=true;
      setLibraryRefreshError(false);
      try{
        const remote=await loadPrivateBooks(API,privateToken);
        if(disposed||sessionEpoch.current!==epoch)return;
        // An eventually consistent API can reveal a book only after login.
        // Reconcile its queued page with the now-known book length before
        // displaying or replaying any pending position.
        const repairedProgress=normalizePendingProgress(pendingProgress.current,remote);
        if([...pendingProgress.current].some(([id,position])=>repairedProgress.get(id)!==position)||
           repairedProgress.size!==pendingProgress.current.size){
          pendingProgress.current=repairedProgress;
          persistPending();
        }
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
        setBooks(previous=>preserve(previous.filter((book):book is RemoteBook=>book.mode==="private-account")));
      }catch(error){
        if(disposed||sessionEpoch.current!==epoch)return;
        if(error instanceof Error&&error.message==="Private account authorization expired"){
          persistPending();
          ++sessionEpoch.current;
          pendingProgress.current.clear();pendingFavorites.current.clear();
          offlineOwner.current=null;recentlyCreated.current.clear();
          clearChildDraft();
          setLibraryShelf("all");setLibraryAge("all");
    setLibraryQuery("");setLibrarySort("newest");setFavoritesOnly(false);
          setPrivateToken(null);setRemoteBooks([]);setBooks(getDemoBooks());setActive(null);setPage(0);setTab("home");
          setSyncMessage({
            ru:"Сессия истекла. Войдите снова.",
            uz:"Sessiya tugadi. Qayta kiring.",
            en:"Your session expired. Sign in again."
          }[lang]);
        }
        // Keep the last loaded library visible during temporary network errors.
        if(!(error instanceof Error&&error.message==="Private account authorization expired"))setLibraryRefreshError(true);
      }finally{refreshing=false;}
    };
    window.addEventListener("online",refresh);
    // Fetch a fresh snapshot as soon as the library opens, not only when
    // connectivity or visibility changes.
    void refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{
      disposed=true;
      window.removeEventListener("online",refresh);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[privateToken,tab,syncBusy,lang,libraryRefreshAttempt]);
  const toggleFavorite=async()=>{
    if(!active)return;
    if(isDemoBook(active)){
      const favorite=!active.favorite;
      const saved=getDemoBooks();
      try{
        saveDemoBooks(saved.map(book=>book.id===active.id?{...book,favorite}:book));
        setBooks(prev=>prev.map(book=>book.id===active.id?{...book,favorite}:book));
        setActive(prev=>prev?{...prev,favorite}:null);
      }catch{setError(localSaveError);}
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
    try{applyLocalBookChange(revised);setEditingPage(false);setError("");}
    catch{setError(localSaveError);}
  };
  const upgradeClassicStory=()=>{
    if(!active||!isDemoBook(active)||!canRefreshClassicDemoStory(active as DemoBook))return;
    const notice=({
      ru:"Заменить старый текст сказки новым сюжетом? Отредактированные страницы могут измениться. Личные изображения сохранятся.",
      uz:"Eski ertak matnini yangi hikoyaga almashtirasizmi? Tahrirlangan sahifalar o'zgarishi mumkin. Shaxsiy rasmlar saqlanadi.",
      en:"Replace the old fairy-tale text with the new story? Edited pages may change. Your personal images will be preserved."
    } as const)[lang];
    if(!window.confirm(notice))return;
    try{
      const next=refreshClassicDemoStory(active as DemoBook);
      applyLocalBookChange(next);
      setEditingPage(false);
      setError("");
    }catch{setError(localSaveError);}
  };
  const continueAdventure=()=>{
    if(!active||!isDemoBook(active))return;
    stopSpeech();
    try{
      const sequel=createDemoSequel(active as DemoBook);
      setBooks(prev=>[sequel,...prev]);
      openBook(sequel);
    }catch(e){
      setError(e instanceof Error&&e.message==="LOCAL_LIBRARY_FULL"
        ?({ru:"Библиотека заполнена. Удалите ненужную сказку перед созданием продолжения.",uz:"Kutubxona toldi. Davomini yaratishdan oldin keraksiz ertakni oçiring.",en:"Library full. Delete an unwanted story before creating a sequel."} as const)[lang]
        :e instanceof Error&&e.message==="LOCAL_LIBRARY_SAVE_FAILED"?localSaveError:t.generateError);
    }
  };
  const selectEnding=(choice:EndingId)=>{
    if(!active||!isDemoBook(active))return;
    const last=active.pages.length-1;
    const originalEnding=active.originalEnding||active.pages[last].text;
    const addition=endings[active.language||storyLang][choice].addition;
    if(!canAppendStoryEnding(originalEnding,addition)){
      setError(({ru:"Последняя страница слишком длинная для новой концовки. Сократите её через «Редактировать страницу» и повторите.",uz:"Oxirgi sahifa yangi yakun uchun juda uzun. Uni «Sahifani tahrirlash» orqali qisqartirib, qayta urinib köring.",en:"The final page is too long for a new ending. Shorten it using Edit page and try again."} as const)[lang]);
      return;
    }
    try{
      applyLocalBookChange({...active,originalEnding,endingChoice:choice,pages:active.pages.map((p,i)=>i===last?{...p,text:originalEnding+" "+addition}:p)});
      setEditingPage(false);setError("");
    }catch{setError(localSaveError);}
  };
  const generate=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy)return;
    // Pressing Enter inside an earlier wizard step must not bypass review and consent.
    if(createStep!==3){
      setError(({ru:"Завершите все шаги создания сказки.",uz:"Ertak yaratişning barça bosqiçlarini tugating.",en:"Complete all story creation steps first."} as const)[lang]);
      return;
    }
    if(!name.trim()||prompt.trim().length<8){
      setError(({ru:"Проверьте имя ребёнка и описание сюжета.",uz:"Bolaning ismi va syujet tavsifini tekşiring.",en:"Check the child's name and story idea."} as const)[lang]);
      setCreateStep(!name.trim()?1:2);
      return;
    }
    if(!acceptedLegal){
      setError(({ru:"Ознакомьтесь с условиями использования и политикой конфиденциальности.",uz:"Foydalanish shartlari va maxfiylik siyosati bilan tanishing.",en:"Please review and accept the terms and privacy policy."} as const)[lang]);
      return;
    }
    if(!consent){
      setError(({ru:"Подтвердите согласие перед созданием сказки.",uz:"Ertak yaratişdan oldin rozilikni tasdiqlang.",en:"Confirm your consent before creating a story."} as const)[lang]);
      return;
    }
    if(!usePersonalAi&&heroNameTooLong){
      setCreateStep(1);
      setError(heroNameLengthError);
      return;
    }

    if(usePersonalAi&&prompt.trim().length<12){
      setCreateStep(2);
      setError(({ru:"Для AI-сказки опишите сюжет минимум 12 символами.",uz:"AI ertak uçun syujetni kamida 12 ta belgi bilan yozing.",en:"For an AI story, describe the plot in at least 12 characters."} as const)[lang]);
      return;
    }
    if(usePersonalAi&&photo){
      setError(({ru:"AI пока не принимает фото ребёнка. Удалите фото на первом шаге.",uz:"AI hozir bolaning rasmini qabul qilmaydi. Birinçi bosqiçda rasmni olib taşlang.",en:"AI does not accept child photos yet. Remove the photo in step one."} as const)[lang]);
      setCreateStep(1);
      return;
    }
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
          idea:storyIdeaWithHero,style,other_heroes:secondHero.trim()?[secondHero.trim()]:[],
          pages_count:aiPagesCount,
        };
        const payload=JSON.stringify(data);
        // Only an identical request in the same parent session can reuse its
        // previous key and bypass a potentially already-spent daily quota.
        const safeRetry=aiRetry.current?.token===privateToken&&aiRetry.current.payload===payload;
        const aiAccess=safeRetry?"ready":await checkAiStoryAccess(API,privateToken);
        if(sessionEpoch.current!==epoch)return;
        if(aiAccess!=="ready"){
          const messages={
            login:{ru:"Сессия закончилась. Войдите в аккаунт родителя снова.",uz:"Sessiya tugadi. Ota-ona akkauntiga qayta kiring.",en:"Session expired. Sign in to your parent account again."},
            unavailable:{ru:"Не удалось проверить доступность AI. Проверьте соединение и повторите.",uz:"AI holatini tekşirib bölmadi. Internetni tekşirib qayta urining.",en:"Cannot check AI availability. Check your connection and retry."},
            "not-allowed":{ru:"AI-генерация пока недоступна для этого аккаунта. Демо-сказки по-прежнему работают.",uz:"AI yaratiş bu akkaunt uçun hali mavjud emas. Demo ertaklar işlaydi.",en:"AI generation is not yet available for this account. Demo stories still work."},
            limit:{ru:"Сегодняшний лимит AI-сказок исчерпан. Попробуйте завтра.",uz:"Bugungi AI ertaklar limiti tugadi. Ertaga qayta urining.",en:"Today's AI story quota is exhausted. Try again tomorrow."},
          } as const;
          throw new Error(messages[aiAccess][lang]);
        }
        const retry=aiRetry.current;
        const key=retry?.token===privateToken&&retry.payload===payload
          ?retry.key:crypto.randomUUID().replaceAll("-","");
        aiRetry.current={token:privateToken,payload,key};
        if(AI_JOBS_ENABLED){
          const queued=await enqueueAiJob(API,privateToken,data,key,AbortSignal.timeout(15000));
          if(sessionEpoch.current!==epoch)return;
          aiRetry.current=null;
          setAiJobsRefresh(v=>v+1);
          setTab("account");
          setSyncMessage(queued.status==="queued"
            ?({ru:"Сказка добавлена в очередь. Следите за статусом в профиле.",uz:"Ertak navbatga qöşildi. Holatini profilda kuzating.",en:"Your story is queued. Track its status in your profile."} as const)[lang]
            :({ru:"Статус сказки обновлён.",uz:"Ertak holati yangilandi.",en:"Story status updated."} as const)[lang]);
          return;
        }
        const response=await fetch(API+"/api/books/generate",{
          method:"POST",
          headers:{"Authorization":"Bearer "+privateToken,"Content-Type":"application/json","Idempotency-Key":key},
          body:payload,
          signal:AbortSignal.timeout(120000),
        });
        if(!response.ok){
          if(response.status===401){
            throw new Error(({ru:"Сессия истекла. Войдите в аккаунт родителя снова.",uz:"Sessiya tugadi. Ota-ona akkauntiga qayta kiring.",en:"Your session has expired. Sign in to the parent account again."} as const)[lang]);
          }
          if(response.status===409){
            // Same-key pending responses must not be mistaken for a full library.
            // Preserve the key so a later retry cannot start another paid call.
            const details=await response.json().catch(()=>({}));
            if(details?.detail==="Story generation is already processing"){
              throw new Error(({ru:"Сказка ещё создаётся. Повторите позже: новый запрос не будет оплачен повторно.",uz:"Ertak hali yaratilmoqda. Keyinroq qayta urining: yangi AI so'rovi yuborilmaydi.",en:"Your story is still processing. Retry later without paying for another request."} as const)[lang]);
            }
            throw new Error(({ru:"Библиотека заполнена. Удалите ненужную сказку перед созданием новой.",uz:"Kutubxona tölgan. Yangi ertakdan oldin keraksizini öçiring.",en:"Your library is full. Delete a story before creating another."} as const)[lang]);
          }
          if(response.status===403){
            throw new Error(({ru:"AI-генерация пока не включена для этого аккаунта.",uz:"AI yaratiş uşbu akkaunt uçun hali yoqilmagan.",en:"AI generation is not enabled for this account yet."} as const)[lang]);
          }
          if(response.status===503){
            throw new Error(({ru:"AI-сервис временно недоступен или не смог сохранить сказку. Попробуйте позже.",uz:"AI xizmati vaqtinça işlamayapti yoki ertakni saqlay olmadi. Keyinroq qayta urining.",en:"The AI service is temporarily unavailable or could not save the story. Please try again later."} as const)[lang]);
          }
          if(response.status===502){
            throw new Error(({ru:"AI не смог создать сказку. Попробуйте позже.",uz:"AI ertak yarata olmadi. Keyinroq qayta urining.",en:"AI could not generate the story. Please try again later."} as const)[lang]);
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
           !generated.pages.every((p,index)=>p&&typeof p==="object"&&
             p.number===index+1&&typeof p.text==="string"&&
             p.text.trim().length>=70&&p.text.length<=1200&&
             (p.image_url===""||typeof p.image_url==="undefined")))throw new Error(t.generateError);
        if(sessionEpoch.current!==epoch)return;
        aiRetry.current=null;
        // POST succeeded: show the saved story immediately even if the follow-up
        // library GET fails. Never encourage a duplicate paid generation.
        const created:RemoteBook={
          id:generated.id,created_at:typeof generated.created_at==="string"?generated.created_at:new Date().toISOString(),
          title:generated.title,name:data.name,age:data.age,language:storyLang,
          theme:data.classic_title,prompt:data.idea,style:data.style,
          pages:generated.pages.map((p:{text:string},index:number)=>({
            number:index+1,text:p.text,image_url:""
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
      const heroes=combinedHeroName;
      const book=createDemoBook(heroes,Number(age),theme,style,storyIdeaWithHero,storyLang,classicId||undefined,saveOnDevice);
      // When signed in, demo books stay in the browser only and are not shown
      // in the parent's remote library until explicitly transferred.
      if(!privateToken)setBooks(previous=>[book,...previous]);
      openBook(book);
    }catch(e){
      if(e instanceof Error&&e.message==="LOCAL_LIBRARY_FULL"){
        setError(({ru:"Библиотека этого устройства заполнена (20 книг в каждом режиме хранения). Удалите ненужную сказку в библиотеке перед созданием новой.",uz:"Bu qurilma kutubxonasi toldi (har bir saqlash rejimida 20 ta kitob). Yangi ertak yaratishdan oldin keraksiz kitobni oçiring.",en:"This device library is full (20 books per storage mode). Delete an unwanted story before creating another."} as const)[lang]);
      }else if(e instanceof Error&&e.message==="LOCAL_LIBRARY_SAVE_FAILED"){
        setError(localSaveError);
      }else setError(e instanceof Error?e.message:t.genericError);
    }
    finally{setBusy(false);}
  };
  const deleteBook=async(book:Book)=>{
    if(!confirm(t.deleteConfirm))return;
    try{if(isDemoBook(book)){saveDemoBooks(getDemoBooks().filter(b=>b.id!==book.id));}else{if(!privateToken)throw new Error("Parent login required");const r=await fetch(API+"/api/books/"+book.id,{method:"DELETE",headers:{Authorization:"Bearer "+privateToken}});if(!r.ok)throw new Error("Ошибка удаления");pendingProgress.current.delete(book.id);pendingFavorites.current.delete(book.id);recentlyCreated.current.delete(book.id);persistPending();setRemoteBooks(prev=>prev.filter(b=>b.id!==book.id));}setBooks(prev=>prev.filter(b=>b.id!==book.id));setTab("library");setActive(null);}
    catch{setError(t.deleteError);}
  };
  const shownBooks=discoverBooks(books,libraryQuery,favoritesOnly,librarySort).filter(book=>(libraryAge==="all"||book.age<=Number(libraryAge))&&(libraryShelf!=="saved"||(isDemoBook(book)&&Boolean(book.savedOnDevice))));
  const changeLibraryShelf=(next:"all"|"favorites"|"saved"|"recent")=>{
    setLibraryShelf(next);
    setFavoritesOnly(next==="favorites");
    if(next==="recent")setLibrarySort("newest");
  };
  const continueBook=books.find(book=>book.pages.length>1&&(book.lastPage??0)>0&&(book.lastPage??0)<book.pages.length-1);
  const readingStats=getReadingAchievements(books);
  const achievementLabels={
    books:({ru:"Сказки в библиотеке",uz:"Kutubxonadagi ertaklar",en:"Stories in library"} as const)[lang],
    reading:({ru:"Начал читать",uz:"Oqişni başladim",en:"Started reading"} as const)[lang],
    finished:({ru:"Дочитал до конца",uz:"Oxirigaça oqidim",en:"Reached final page"} as const)[lang],
    favorites:({ru:"Любимые сказки",uz:"Sevimli ertaklar",en:"Favorite stories"} as const)[lang],
    explorer:({ru:"Разные миры",uz:"Turli olamlar",en:"Different worlds"} as const)[lang],
    collection:({ru:"Сохранённые книги",uz:"Saqlangan kitoblar",en:"Saved books"} as const)[lang]
  };
  const heading=(label:string,sub:string)=><div className="section-heading"><h2>{label}</h2><p>{sub}</p></div>;
  if(accountAction)return <AccountAction kind={accountAction.kind} token={accountAction.token} api={API} lang={lang} onDone={()=>{setAccountAction(null);setTab("home");}}/>;
  if(showOnboarding&&!privateToken)return <section className="welcome-screen" aria-label="WonderTale AI welcome" onTouchStart={onWelcomeTouchStart} onTouchMove={onWelcomeTouchMove} onTouchEnd={onWelcomeTouchEnd} onTouchCancel={onWelcomeTouchCancel} tabIndex={0} onKeyDown={event=>{const target=event.target;if(target instanceof HTMLElement&&target.closest("button, select, input, textarea, [role='button']"))return;if(event.key==="ArrowRight"){event.preventDefault();setOnboardingStep(current=>Math.min(2,current+1));}if(event.key==="ArrowLeft"){event.preventDefault();setOnboardingStep(current=>Math.max(0,current-1));}}}>
    <button type="button" className="welcome-skip" onClick={()=>finishOnboarding("home")}>{({ru:"Пропустить",uz:"Ötkazib yuboriş",en:"Skip intro"} as const)[lang]}</button>
    <div className="welcome-art" aria-hidden="true"><img src="/images/wondertale-welcome.png" alt="" fetchPriority="high" decoding="async"/></div>
    <div className="welcome-shade" aria-hidden="true"/>
    <div className="welcome-content">
      <div className="welcome-brand"><Crown size={27} fill="#ffd67a"/><span>WonderTale <strong>AI</strong></span></div>
      <h1>{[
        {ru:"Ваш ребёнок — герой собственной сказки",uz:"Farzandingiz öz ertagining qahramoni",en:"Your child is the hero of their own story"},
        {ru:"Волшебные истории каждый день",uz:"Har kuni sehrli hikoyalar",en:"Magical stories every day"},
        {ru:"Создавайте и сохраняйте сказки",uz:"Ertaklar yarating va saqlang",en:"Create and save stories"},
      ][onboardingStep][lang]}</h1>
      <div className="welcome-dots" role="group" aria-label={({ru:"Экраны знакомства",uz:"Tanişuv sahifalari",en:"Introduction slides"} as const)[lang]}>{[0,1,2].map(n=><button key={n} type="button" className={n===onboardingStep?"active":""} onClick={()=>setOnboardingStep(n)} aria-label={({ru:`Экран ${n+1} из 3`,uz:`${n+1}-sahifa, jami 3`,en:`Slide ${n+1} of 3`} as const)[lang]} aria-current={n===onboardingStep?"step":undefined}/>)}</div>
      <button type="button" className="welcome-primary" onClick={()=>onboardingStep<2?setOnboardingStep(n=>n+1):finishOnboarding("home")}>{onboardingStep<2?({ru:"Начать",uz:"Boşlaş",en:"Get started"} as const)[lang]:({ru:"Открыть сказки",uz:"Ertaklarni oçiş",en:"Explore stories"} as const)[lang]} <Sparkles size={18}/></button>
      <button type="button" className="welcome-secondary" onClick={()=>finishOnboarding("account")}>{({ru:"У меня уже есть аккаунт",uz:"Menda akkaunt bor",en:"I already have an account"} as const)[lang]}</button>
    </div>
  </section>;
  return <div className="shell">
    {tab==="account"?<ProfileHeader lang={lang} onLanguage={switchLang} onPrivacy={()=>openLegal("privacy")}/>:
    <header className="topbar">
      <button type="button" className="brand" onClick={()=>setTab("home")} aria-label={t.backHome}><span className="brandmark"><img src="/icons/icon-192.png" alt="" /></span><span>Wonder<span className="brandaccent">Tale</span><small>AI STORY STUDIO</small></span></button>
      <div className="header-actions"><label className="language-control"><span className="sr-only">{t.interfaceLanguage}</span><select aria-label={t.interfaceLanguage} value={lang} onChange={e=>switchLang(e.target.value as Lang)}>{languages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button className="small-button" onClick={()=>setTab("account")}><UserRound size={17}/> <span>{({ru:"Профиль",uz:"Profil",en:"Profile"} as const)[lang]}</span></button></div>
    </header>}
    {!isOnline&&<div className="offline-status-banner" role="status">
      {({ru:"Нет интернета. Сохранённые на устройстве сказки доступны, а AI и синхронизация временно не работают.",uz:"Internet yoq. Qurilmada saqlangan ertaklarni öqiş mumkin, AI va sinxronlaş vaqtinça işlamaydi.",en:"You're offline. Stories saved on this device remain available; AI and sync are paused."} as const)[lang]}
    </div>}
    <main>
      {tab==="home"&&<>
        <div className="hero"><div className="hero-sky" aria-hidden="true"><img src="/images/wondertale-hero.webp" alt="" loading="eager" fetchPriority="high" decoding="async"/></div><div className="hero-content"><div className="hero-decor decor-one">✦</div><div className="hero-decor decor-two">✧</div><div className="hero-badge"><Sparkles size={15}/> {t.badge}</div>
          <div className="hero-brand"><Crown size={26}/><span>WonderTale <strong>AI</strong></span></div><h1>{t.hero1} <em>{t.hero2}</em> {t.hero3}</h1>
          <p>{t.heroDesc}</p>
          <button className="primary-button" onClick={()=>openCreate()}><WandSparkles size={19}/> {t.create} <ArrowRight size={18}/></button>
          </div>
        </div>
        {continueBook&&<button type="button" className="continue-story-card" onClick={()=>openBook(continueBook)}>
          <StoryIllustration url={continueBook.pages[0]?.image_url||""} alt={continueBook.title} lazy/>
          <span className="continue-story-copy">
            <small>{({ru:"Продолжить чтение",uz:"Öqişni davom ettiriş",en:"Continue reading"} as const)[lang]}</small>
            <strong>{continueBook.title}</strong>
            <small>{t.page} {(continueBook.lastPage??0)+1} {t.of} {continueBook.pages.length}</small>
            <span className="continue-story-progress" role="progressbar" aria-label={t.page+" "+((continueBook.lastPage??0)+1)+" "+t.of+" "+continueBook.pages.length} aria-valuemin={0} aria-valuemax={continueBook.pages.length} aria-valuenow={(continueBook.lastPage??0)+1}>
              <span style={{width:(((continueBook.lastPage??0)+1)/Math.max(1,continueBook.pages.length)*100)+"%"}}/>
            </span>
          </span>
          <ArrowRight size={19} aria-hidden="true"/>
        </button>}
        <div className="quick-actions"><button type="button" onClick={()=>setTab("library")}><span className="quick-icon"><Library size={22}/></span><strong>{t.library}</strong><ArrowRight size={16}/></button><button type="button" onClick={()=>document.getElementById("classic-stories")?.scrollIntoView({behavior:"smooth",block:"start"})}><span className="quick-icon"><BookOpen size={22}/></span><strong>{t.classicsTitle}</strong><ArrowRight size={16}/></button></div>
        <div className="section-head"><div><span className="section-eyebrow">✦ WonderTale</span><h2>{t.shelf}</h2></div><button className="text-link" onClick={()=>setTab("library")}>{t.seeAll} <ArrowRight size={16}/></button></div>
        {books.length?<div className="book-grid">{books.slice(0,3).map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:<div className="empty empty-compact"><span className="empty-compact-icon"><BookOpen size={23}/></span><div className="empty-compact-copy"><h3>{t.quiet}</h3><p>{t.quietDesc}</p></div><button className="secondary-button" onClick={()=>openCreate()}>{t.firstBook} <ArrowRight size={16}/></button></div>}
        <section className="classic-section" id="classic-stories">
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
      </>}
      {tab==="create"&&<section className="create-page create-reference-page">
        <div className="create-reference-hero"><div className="create-reference-hero-copy">{heading(t.magic,t.magicDesc)}</div><img src="/images/create-hero-story.png" alt="" loading="eager" decoding="async" width={328} height={186}/></div>
        <div className="wizard-progress" role="group" aria-label={({ru:"Этапы создания сказки",uz:"Ertak yaratiş bosqiçlari",en:"Story creation steps"} as const)[lang]}>{([1,2,3] as const).map((step,index)=><React.Fragment key={step}>{index>0&&<span className="progress-line"/>}<span className={"progress-step"+(createStep===step?" active":"")+(createStep>step?" completed":"")} aria-current={createStep===step?"step":undefined}><span>{step}</span>{step===1?t.heroStep:step===2?t.storyStep:t.createBook}</span></React.Fragment>)}</div><form onSubmit={generate} className="form-card" noValidate>
          {createStep===1&&<><div className="step-title"><span>01</span><div><h3>{t.heroStep}</h3><p>{t.heroStepDesc}</p></div></div>
          {privateToken&&API&&<StoryChildPicker key={privateToken} api={API} session={privateToken} lang={lang} onSelect={child=>{if(child){setName(child.nickname);setAge(String(child.age));}}}/>}
          <div className="form-grid"><label>{t.childName}<input required maxLength={60} aria-invalid={heroNameTooLong} aria-describedby={heroNameTooLong?"hero-name-limit":undefined} value={name} onChange={e=>{setName(e.target.value);if(error===heroNameLengthError)setError("");}} placeholder={t.nameExample}/></label><label>{t.age}<select value={age} onChange={e=>setAge(e.target.value)}>{Array.from({length:13},(_,i)=>i+2).map(n=><option key={n} value={n}>{n} {t.years}</option>)}</select></label></div>
          <div className="create-hero-picker"><strong>{({ru:"Тип главного героя",uz:"Qahramon turi",en:"Main hero type"} as const)[lang]}</strong><p>{({ru:"Выберите, кем будет главный герой сказки.",uz:"Ertakdagi asosiy qahramonni tanlang.",en:"Choose the main character of your story."} as const)[lang]}</p><div className="create-hero-options" role="group" aria-label={({ru:"Тип главного героя",uz:"Qahramon turi",en:"Main hero type"} as const)[lang]}>{(["boy","girl","animal","robot","magical"] as const).map(kind=><button key={kind} type="button" className={"create-hero-option"+(heroKind===kind?" selected":"")} aria-pressed={heroKind===kind} onClick={()=>setHeroKind(kind)}><img src={"/images/create-"+({boy:"boy",girl:"girl",animal:"fox",robot:"robot",magical:"dragon"} as const)[kind]+".png"} alt="" width={138} height={118} loading="lazy"/><span>{({ru:{boy:"Мальчик",girl:"Девочка",animal:"Животное",robot:"Робот",magical:"Волшебный"},uz:{boy:"Bola",girl:"Qiz",animal:"Hayvon",robot:"Robot",magical:"Sehrli jonzot"},en:{boy:"Boy",girl:"Girl",animal:"Animal",robot:"Robot",magical:"Creature"}} as const)[lang][kind]}</span>{heroKind===kind&&<CheckCircle2 className="create-hero-checked" size={19} aria-hidden="true"/>}</button>)}</div></div>
          <details className="create-reference-extras"><summary><SlidersHorizontal size={17}/>{({ru:"Дополнительные настройки",uz:"Qoshimcha sozlamalar",en:"Additional options"} as const)[lang]}<ChevronDown size={17}/></summary><div className="create-reference-extras-inner">
          <label className="second-hero-field">{t.extraHero}<input maxLength={45} aria-invalid={heroNameTooLong} aria-describedby={heroNameTooLong?"hero-name-limit":undefined} value={secondHero} onChange={e=>{setSecondHero(e.target.value);if(error===heroNameLengthError)setError("");}} placeholder={t.extraHeroHint}/></label>{heroNameTooLong&&<p className="wizard-inline-error" id="hero-name-limit" role="status">{heroNameLengthError}</p>}
          <details className="wizard-optional-character"><summary><UserRound size={16}/>{({ru:"Добавить персонажа",uz:"Qahramon qoshish",en:"Add a character"} as const)[lang]}<ChevronDown size={16}/></summary><CharacterBuilder key={privateToken?"private":"demo"} lang={lang} allowSave={!privateToken} onApply={hero=>{setSecondHero(hero);setError("");}}/></details>
          <label className="upload"> <ImagePlus size={25}/><strong>{photo?photo.name:t.photo}</strong><small>{t.photoHint}</small><input type="file" accept="image/jpeg,image/png,image/webp" disabled={usePersonalAi} onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
          {photo&&<button type="button" className="secondary-button" onClick={()=>setPhoto(null)}>{({ru:"Убрать фото",uz:"Rasmni olib taşlaş",en:"Remove photo"} as const)[lang]}</button>}
          </div></details>
          <div className="wizard-step-actions wizard-step-one-actions"><button type="button" className="primary-button wizard-step-one-next" onClick={()=>{if(!name.trim()){setError(({ru:"Введите имя ребёнка.",uz:"Bolaning ismini kiriting.",en:"Enter the child's name."} as const)[lang]);return;}if(heroNameTooLong){setError(heroNameLengthError);return;}setError("");setCreateStep(2);}}>{t.next}<ArrowRight size={17}/></button></div></>}
          {createStep===2&&<div className="wizard-step-two"><div className="step-title next"><span>02</span><div><h3>{t.classicFormTitle}</h3><p>{t.storyStepDesc}</p></div></div>
          <div className="wizard-step-two-section-label"><BookOpen size={17} aria-hidden="true"/><strong>{({ru:"Выберите основу сказки",uz:"Ertak asosini tanlang",en:"Choose a story foundation"} as const)[lang]}</strong></div>
          <div className="classic-choice" role="group" aria-label={t.classicFormTitle}><button type="button" aria-pressed={!classicId} className={!classicId?"active":""} onClick={()=>{setPrompt(previous=>leaveClassicStoryPrompt(previous,storyLang,activeClassic?.prompt));setClassicId(null);}}>{t.classicCustom}</button>{classics.map(item=><button type="button" aria-pressed={classicId===item.id} className={classicId===item.id?"active":""} key={item.id} onClick={()=>{setClassicId(item.id);setThemeIndex(item.themeIndex);setPrompt(item.prompt[storyLang]);}}>{item.title[lang]}</button>)}</div>
          {activeClassic&&<p className="classic-selected"><CheckCircle2 size={16}/> {t.classicSelected}: <strong>{activeClassic.title[lang]}</strong></p>}
          <label className="wizard-step-two-section-label"><Castle size={17} aria-hidden="true"/><strong>{t.world}</strong></label><div className="chips">{themes.map((x,i)=><button type="button" key={x} className={"chip "+(themeIndex===i?"selected":"")} onClick={()=>setThemeIndex(i)}>{x}</button>)}</div>
          <label className="story-preset-label wizard-step-two-section-label"><Sparkles size={17} aria-hidden="true"/><strong>{t.storyIdeas}</strong></label>
          <div className="story-preset-actions">{storyPresets[storyLang].map(preset=><button type="button" key={preset.id} onClick={()=>{setClassicId(null);setPrompt(preset.idea);setThemeIndex(preset.id==="bedtime"?5:preset.id==="confidence"?4:0);}}>{preset.title}</button>)}</div>
          <label className="wizard-step-two-prompt">{t.about}<textarea required minLength={8} maxLength={1200} rows={3} aria-describedby="story-prompt-count" aria-invalid={prompt.trim().length<8} value={prompt} onChange={e=>{const next=e.target.value;if(shouldDetachClassicOnEdit(next,storyLang,activeClassic?.prompt))setClassicId(null);setPrompt(next);}} placeholder={t.promptExample}/></label><small id="story-prompt-count" className="story-character-counter" data-invalid={prompt.trim().length<8}>{prompt.trim().length} / 1200 · {({ru:"минимум 8 символов",uz:"kamida 8 belgi",en:"minimum 8 characters"} as const)[lang]}</small>
          <details className="wizard-step-two-options"><summary><SlidersHorizontal size={17} aria-hidden="true"/>{({ru:"Оформление и язык сказки",uz:"Rasmlar uslubi va ertak tili",en:"Story style and language"} as const)[lang]}<ChevronDown size={16} aria-hidden="true"/></summary><div className="wizard-step-two-options-content">
          <label>{t.style}<select value={styleIndex} onChange={e=>setStyleIndex(Number(e.target.value))}>{styles.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>
          <div className="story-lang-field"><label>{t.storyLanguage}</label><div className="story-lang-options" role="group" aria-label={t.storyLanguage}>{languages.map(l=><button type="button" aria-pressed={storyLang===l.id} className={storyLang===l.id?"active":""} key={l.id} onClick={()=>changeStoryLanguage(l.id)}>{l.id.toUpperCase()} {storyLang===l.id&&<CheckCircle2 size={15}/>}</button>)}</div></div></div></details>
          <div className="wizard-step-actions"><button type="button" className="secondary-button" onClick={()=>setCreateStep(1)}><ArrowLeft size={16}/>{t.back}</button><button type="button" className="primary-button" onClick={()=>{if(prompt.trim().length<8){setError(({ru:"Опишите сюжет минимум 8 символами.",uz:"Syujetni kamida 8 ta belgi bilan yozing.",en:"Describe the plot in at least 8 characters."} as const)[lang]);return;}setError("");setCreateStep(3);}}>{t.next}<ArrowRight size={17}/></button></div></div>}
          {createStep===3&&<><div className="step-title next"><span>03</span><div><h3>{t.createBook}</h3><p>{t.storyStepDesc}</p></div></div><div className="story-lang-field"><label>{({ru:"Режим создания",uz:"Yaratiş rejimi",en:"Creation mode"} as const)[lang]}</label><div className="story-lang-options creator-mode-options" role="group" aria-label={({ru:"Режим создания",uz:"Yaratish rejimi",en:"Creation mode"} as const)[lang]}><button type="button" aria-pressed={!usePersonalAi} className={!usePersonalAi?"active":""} onClick={()=>setUsePersonalAi(false)}>{({ru:"Демо",uz:"Demo",en:"Demo"} as const)[lang]}</button><button type="button" aria-pressed={usePersonalAi} className={usePersonalAi?"active":""} onClick={()=>setUsePersonalAi(true)}>{({ru:"AI (аккаунт)",uz:"AI (akkaunt)",en:"AI (account)"} as const)[lang]}</button></div></div>
          <div className="wizard-review" aria-label={({ru:"Проверка перед созданием",uz:"Yaratişdan oldingi tekşiruv",en:"Review before creating"} as const)[lang]}>
             <strong>{({ru:"Проверьте детали сказки",uz:"Ertak ma’lumotlarini tekşiring",en:"Review your story"} as const)[lang]}</strong>
             <dl>
               <div><dt>{t.childName}</dt><dd>{name.trim()}</dd></div>
               <div><dt>{t.age}</dt><dd>{age} {t.years}</dd></div>
               <div><dt>{({ru:"Тип героя",uz:"Qahramon turi",en:"Hero type"} as const)[lang]}</dt><dd>{heroKindLabel}</dd></div>
               {secondHero.trim()&&<div><dt>{t.extraHero}</dt><dd>{secondHero.trim()}</dd></div>}
               <div><dt>{t.world}</dt><dd>{activeClassic?activeClassic.title[lang]:theme}</dd></div>
               <div><dt>{t.storyLanguage}</dt><dd>{languages.find(item=>item.id===storyLang)?.label||storyLang}</dd></div>
               <div><dt>{t.style}</dt><dd>{style}</dd></div>
             </dl>
             <p>{prompt}</p>
             <button type="button" onClick={()=>setCreateStep(2)}>{({ru:"Изменить сюжет",uz:"Syujetni özgartiriş",en:"Edit story"} as const)[lang]}</button>
           </div>
           {usePersonalAi&&<label>{({ru:"Длина AI-сказки",uz:"AI ertak uzunligi",en:"AI story length"} as const)[lang]}<select value={aiPagesCount} onChange={e=>setAiPagesCount(Number(e.target.value) as 8|12|20)}><option value={8}>8 {({ru:"страниц",uz:"sahifa",en:"pages"} as const)[lang]}</option><option value={12}>12 {({ru:"страниц",uz:"sahifa",en:"pages"} as const)[lang]}</option><option value={20}>20 {({ru:"страниц",uz:"sahifa",en:"pages"} as const)[lang]}</option></select></label>}
          {usePersonalAi&&<p className="notice">{({ru:"AI создаёт только текст, без фото ребёнка и персональных иллюстраций. Требуются вход в аккаунт и доступ к пилотной AI-генерации.",uz:"AI faqat matn yaratadi. Bolaning rasmi yuborilmaydi. Akkaunt va AI sinov ruxsati kerak.",en:"AI currently generates text only, without child photos or custom illustrations. A parent account and pilot AI access are required."} as const)[lang]}</p>}
          {!usePersonalAi&&<div className="device-save-option">
            <label><input type="checkbox" checked={saveOnDevice} onChange={e=>setSaveOnDevice(e.target.checked)}/><span><strong>{t.deviceSave}</strong><small>{saveOnDevice?t.deviceSaveHint:t.sessionOnly}</small></span></label>
          </div>}
          <label className="consent"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
          <label className="consent legal-consent"><input required type="checkbox" checked={acceptedLegal} onChange={e=>setAcceptedLegal(e.target.checked)}/><span>{({ru:"Я ознакомился(-ась) с условиями и политикой конфиденциальности.",uz:"Foydalanish shartlari va maxfiylik siyosatini oqib chiqdim.",en:"I have read and accept the terms and privacy policy."} as const)[lang]}</span></label>
          <div className="legal-consent-links"><button type="button" onClick={()=>openLegal("terms")}>{({ru:"Условия",uz:"Shartlar",en:"Terms"} as const)[lang]}</button><button type="button" onClick={()=>openLegal("privacy")}>{({ru:"Конфиденциальность",uz:"Maxfiylik",en:"Privacy"} as const)[lang]}</button><button type="button" onClick={()=>openLegal("parents")}>{({ru:"Данные детей",uz:"Bolalar malumoti",en:"Children's data"} as const)[lang]}</button></div>
          {!usePersonalAi&&<p className="notice">{activeClassic?t.classicDemo:t.demo}</p>}
          {error&&<p className="error" role="alert">{error}</p>}
          <div className="wizard-step-actions wizard-step-three-actions"><button type="button" className="secondary-button" onClick={()=>setCreateStep(2)} disabled={busy}><ArrowLeft size={16}/>{t.back}</button><button className="primary-button full" disabled={busy||!consent||!acceptedLegal} type="submit"><Sparkles size={18}/>{busy?t.creating:t.createBook}<ArrowRight size={18}/></button></div></>}
          {error&&createStep!==3&&<p className="error" role="alert">{error}</p>}
        </form>
        <button type="button" className="create-reference-reading-link" onClick={()=>setTab("library")}><img src="/images/create-read-story-banner.png" alt="" width={287} height={155} loading="lazy" decoding="async"/><span><strong>{({ru:"Читать сказки",uz:"Ertak oqish",en:"Read stories"} as const)[lang]}</strong><small>{({ru:"Читайте готовые сказки и сохраняйте любимые.",uz:"Tayyor ertaklarni oqing va sevimlilaringizni saqlang.",en:"Read ready-made stories and save favorites."} as const)[lang]}</small></span><ArrowRight size={20}/></button>
      </section>}
      {tab==="legal"&&<LegalCenter lang={lang} document={legalDocument} onSelect={openLegal} onBack={()=>setTab(legalReturnTab)}/>}
      {tab==="account"&&<section className="profile-concept-three">
        <ParentAccount lang={lang} api={API} session={privateToken} syncedCount={remoteBooks.length} syncBusy={syncBusy} onLogin={loginParent} onLogout={logoutParent} onSync={syncSaved}/>
        {AI_JOBS_ENABLED&&privateToken&&API&&<AiJobsPanel key={privateToken} api={API} session={privateToken} lang={lang} refreshVersion={aiJobsRefresh} onOpenLibrary={()=>{setLibraryRefreshAttempt(v=>v+1);setTab("library");}}/>}
        {import.meta.env.VITE_ENABLE_AI_ILLUSTRATION_CONSENT==="true"&&privateToken&&API&&
          <IllustrationConsentPanel key={privateToken} api={API} session={privateToken} lang={lang}
            onOpenPrivacy={()=>openLegal("privacy")} onOpenParents={()=>openLegal("parents")}/>}
        <ProfileLegalMenu lang={lang} onOpen={openLegal}/>
        {syncMessage&&<p className="parent-account-result" role="status">{syncMessage}</p>}
        <details className="account-plans-disclosure">
          <summary>
            <span className="profile-plan-icon"><Crown size={22} aria-hidden="true"/></span>
            <span className="profile-plan-copy"><strong>{({ru:"Тарифы и возможности",uz:"Tariflar va imkoniyatlar",en:"Plans and features"} as const)[lang]}</strong><small>{({ru:"Дополнительные возможности сервиса",uz:"Qoshimcha imkoniyatlar va tariflar",en:"Available plans and extra features"} as const)[lang]}</small></span>
            <ChevronRight size={19} className="profile-plan-chevron" aria-hidden="true"/>
          </summary>
          <PricingPlans lang={lang} api={API} session={privateToken}/>
        </details>
      </section>}
      {tab==="library"&&<section className="library-page library-concept-two">
        <div className="library-concept-heading">
          <span className="library-concept-heading-icon"><Library size={28} aria-hidden="true"/></span>
          <div><h2>{t.libraryTitle}</h2><p>{t.libraryDesc}</p></div>
        </div>
        {!isOnline&&<div className="library-sync-warning" role="status">
          <span>{privateToken?({ru:"Нет интернета. Серверная библиотека может быть недоступна после перезапуска. Для офлайн-чтения используйте сохранённые на устройстве демосказки; приватные книги не кешируются PWA.",uz:"Internet yoq. Server kutubxonasi qayta ochilganda mavjud bolmasligi mumkin. Oflayn oqish uchun qurilmada saqlangan demo ertaklardan foydalaning; shaxsiy kitoblar PWA keshiga yozilmaydi.",en:"You are offline. Server books may be unavailable after restarting. Use stories saved on this device for offline reading; private books are never stored in the PWA cache."} as const)[lang]:({ru:"Нет интернета. Доступны только сказки, уже сохранённые на этом устройстве.",uz:"Internet yoq. Faqat qurilmada saqlangan ertaklar mavjud.",en:"You are offline. Only stories already saved on this device are available."} as const)[lang]}</span>
        </div>}
        {!privateToken&&getLocalLibraryHealth()==="corrupt"&&<div className="library-sync-warning" role="alert">
          <span>{({ru:"Часть сохранённых сказок повреждена и временно не отображается. Мы не удаляем эти данные. Не очищайте данные Safari или PWA: это может уничтожить книги без возможности восстановления.",uz:"Saqlangan ertaklarning ayrimlari shikastlangan va vaqtincha körinmayapti. Ma’lumotlar öçirilmaydi. Safari yoki PWA ma’lumotlarini tozalamang: kitoblarni qaytarib bölmasligi mumkin.",en:"Some saved stories are damaged and temporarily hidden. Their data has not been deleted. Do not clear Safari or PWA data: you may permanently lose the stories."} as const)[lang]}</span>
        </div>}
        {!privateToken&&getLocalLibraryHealth()==="unavailable"&&<div className="library-sync-warning" role="status">
          <span>{({ru:"Хранилище браузера недоступно. Локальные сказки могут не отображаться, а изменения не сохранятся. Проверьте настройки Safari.",uz:"Brauzer xotirasi mavjud emas. Mahalliy ertaklar körinmasligi va özgarişlar saqlanmasligi mumkin. Safari sozlamalarini tekshiring.",en:"Browser storage is unavailable. Local stories may be hidden and changes may not be saved. Check Safari settings."} as const)[lang]}</span>
        </div>}
        <div className="library-concept-toolbar">
          <label className="library-concept-search">
            <Search size={20} aria-hidden="true"/>
            <span className="sr-only">{({ru:"Поиск по сказкам",uz:"Ertaklarni qidirish",en:"Search stories"} as const)[lang]}</span>
            <input type="search" value={libraryQuery} onChange={event=>setLibraryQuery(event.target.value)} placeholder={({ru:"Поиск по сказкам...",uz:"Ertaklar ichidan qidirish...",en:"Search stories..."} as const)[lang]}/>
          </label>
          <div className="library-filters library-concept-chips" role="group" aria-label={t.library}>
            <button type="button" aria-pressed={libraryShelf==="all"} className={libraryShelf==="all"?"active":""} onClick={()=>changeLibraryShelf("all")}><Library size={15}/>{({ru:"Все",uz:"Barchasi",en:"All"} as const)[lang]}</button>
            <button type="button" aria-pressed={favoritesOnly} className={libraryShelf==="favorites"?"active":""} title={t.favorites} onClick={()=>changeLibraryShelf("favorites")}><Heart size={15}/>{({ru:"Избранное",uz:"Sevimlilar",en:"Favorites"} as const)[lang]}</button>
            <button type="button" aria-pressed={libraryShelf==="saved"} className={libraryShelf==="saved"?"active":""} onClick={()=>changeLibraryShelf("saved")}><Download size={15}/>{({ru:"На устройстве",uz:"Yuklangan",en:"On device"} as const)[lang]}</button>
            <button type="button" aria-pressed={libraryShelf==="recent"} className={libraryShelf==="recent"?"active":""} onClick={()=>changeLibraryShelf("recent")}><PlayCircle size={15}/>{({ru:"Недавние",uz:"So\u0027nggi",en:"Recent"} as const)[lang]}</button>
          </div>
        </div>
        <div className="library-concept-metrics">
        <button type="button" className="library-achievements-toggle" aria-expanded={showLibraryAchievements} aria-controls="library-achievements-panel" onClick={()=>setShowLibraryAchievements(value=>!value)}>
          <Star size={18} aria-hidden="true"/>
          <span>{({ru:"Достижения",uz:"Yutuqlar",en:"Achievements"} as const)[lang]}</span>
          <strong>{readingStats.unlocked}/{readingStats.total}</strong>
          <ChevronDown size={15} aria-hidden="true"/>
        </button>
          <div className="library-concept-metric">
            <BookOpen size={22} aria-hidden="true"/>
            <span>{({ru:"Сказки",uz:"Ertaklar",en:"Stories"} as const)[lang]}</span>
            <strong>{books.length}</strong>
          </div>
          <div className="library-concept-metric">
            <Sparkles size={22} aria-hidden="true"/>
            <span>{({ru:"Читали",uz:"Oqilganlar",en:"Read"} as const)[lang]}</span>
            <strong>{books.filter(book=>(book.lastPage??0)>0).length}</strong>
          </div>
        </div>
        {showLibraryAchievements&&<div className="library-achievements-panel" id="library-achievements-panel">
        <section className="reading-achievements" aria-label={({ru:"Достижения чтения",uz:"Oqiş yutuqlari",en:"Reading achievements"} as const)[lang]}>
          <div className="reading-achievements-heading"><Star size={18}/><strong>{({ru:"Мои достижения",uz:"Mening yutuqlarim",en:"My achievements"} as const)[lang]}</strong></div>
          <p className="reading-achievements-summary" role="status">{readingStats.unlocked} / {readingStats.total} {({ru:"достижений открыто",uz:"yutuq oçildi",en:"achievements unlocked"} as const)[lang]}</p>
          <div className="reading-achievements-grid">
            {readingStats.entries.map(item=><div className={"reading-achievement"+(item.count>=item.goal?" unlocked":"")} key={item.id} aria-label={item.count>=item.goal?achievementLabels[item.id]+" ✓":achievementLabels[item.id]}>
              <div className="reading-achievement-count"><Star size={15} fill={item.count>=item.goal?"currentColor":"none"}/><strong>{item.count}</strong><small>/ {item.goal}</small></div>
              <span>{achievementLabels[item.id]}</span>
              <div className="reading-achievement-track" role="progressbar" aria-label={achievementLabels[item.id]} aria-valuemin={0} aria-valuemax={item.goal} aria-valuenow={Math.min(item.count,item.goal)}><span style={{width:Math.min(100,item.count/item.goal*100)+"%"}}/></div>
            </div>)}
          </div>
          <small className="reading-achievements-note">{({ru:"Прогресс рассчитан по текущей библиотеке. Последняя страница означает, что вы до неё дошли.",uz:"Natijalar joriy kutubxona asosida hisoblanadi. Oxirgi sahifaga yetiş yakunlangan deb hisoblanadi.",en:"Progress is based on this library. Reaching the final page counts as finishing."} as const)[lang]}</small>
        </section>
        </div>}
        {books.some(book=>typeof book.lastPage==="number"&&book.lastPage>0&&book.lastPage<book.pages.length-1)&&<div className="library-resume">
          <div className="library-resume-text"><BookOpen size={17}/><span>{({ru:"Продолжить чтение",uz:"Oqishni davom ettirish",en:"Continue reading"} as const)[lang]}</span></div>
          {books.filter(book=>typeof book.lastPage==="number"&&book.lastPage>0&&book.lastPage<book.pages.length-1).slice(0,1).map(book=><button key={book.id} type="button" onClick={()=>openBook(book)}><span>{book.title}</span><ArrowRight size={17}/></button>)}
        </div>}
        {privateToken&&libraryRefreshError&&<div className="library-sync-warning" role="status">
          <span>{({ru:"Не удалось обновить библиотеку. Ранее загруженные книги сохранены.",uz:"Kutubxonani yangilab bölmadi. Avval yuklangan kitoblar saqlangan.",en:"Could not refresh your library. Previously loaded books are still available."} as const)[lang]}</span>
          <button type="button" disabled={!isOnline} onClick={()=>setLibraryRefreshAttempt(value=>value+1)}>{({ru:"Повторить",uz:"Qayta uriniş",en:"Retry"} as const)[lang]}</button>
        </div>}{books.length>0&&<button className="primary-button add-book" onClick={()=>openCreate()}><Plus size={18}/> {t.newStory}</button>}{error&&<p className="error">{error}</p>}
        {books.length>0&&<>
          <details className="library-concept-advanced">
            <summary><SlidersHorizontal size={16}/>{({ru:"Сортировка и возраст",uz:"Saralash va yosh",en:"Sort and age"} as const)[lang]}<ChevronDown size={16}/></summary>
            <div className="library-discovery">
              <label>{({ru:"Сортировка",uz:"Saralash",en:"Sort by"} as const)[lang]}
                <select value={librarySort} onChange={event=>setLibrarySort(event.target.value as LibrarySort)}>
                  <option value="newest">{({ru:"Сначала новые",uz:"Yangilari avval",en:"Newest first"} as const)[lang]}</option>
                  <option value="title">{({ru:"По названию",uz:"Nomi boyicha",en:"By title"} as const)[lang]}</option>
                  <option value="continue">{({ru:"По прогрессу",uz:"Oqish jarayoni",en:"Reading progress"} as const)[lang]}</option>
                </select>
              </label>
              <div className="library-age-filter"><label>{({ru:"Возраст читателя",uz:"Oquvchi yoshi",en:"Reader age"} as const)[lang]} <select value={libraryAge} onChange={event=>setLibraryAge(event.target.value)}><option value="all">{({ru:"Любой возраст",uz:"Barcha yoshlar",en:"All ages"} as const)[lang]}</option>{[3,5,7,10,12].map(years=><option value={years} key={years}>{years}+</option>)}</select></label></div>
            </div>
          </details>
          <p className="library-results-note" role="status">{shownBooks.length} / {books.length} {({ru:"сказок",uz:"ertak",en:"stories"} as const)[lang]}</p>
        </>}
        {shownBooks.length?<div className="book-grid">{shownBooks.map(book=><BookTile key={book.id} book={book} open={()=>openBook(book)} lang={lang}/>)}</div>:books.length?<div className="library-empty-results"><Search size={24}/><p>{({ru:"Ничего не найдено. Попробуйте другой запрос или фильтр.",uz:"Hech narsa topilmadi. Boshqa soz yoki filtrni sinab koring.",en:"No matching stories. Try a different search or filter."} as const)[lang]}</p><button type="button" onClick={()=>{setLibraryQuery("");changeLibraryShelf("all");setLibrarySort("newest");setLibraryAge("all");}}>{({ru:"Сбросить фильтры",uz:"Filtrlarni tozalash",en:"Clear filters"} as const)[lang]}</button></div>:<div className="empty library-concept-empty">
          <div className="library-concept-art" aria-hidden="true">
            <img className="library-concept-castle-art" src="/images/library-story-castle-premium.png" alt="" width={480} height={360} loading="lazy" decoding="async"/>
          </div>
          <div className="library-empty-copy"><h3>{t.empty}</h3><p>{t.emptyDesc}</p></div>
          <button className="primary-button library-concept-create" type="button" onClick={()=>openCreate()}><Plus size={19}/>{t.newStory}</button>

        </div>}</section>}
      {tab==="reader"&&active&&<section className={"reader-page"+(readerFocusMode?" reader-focused":"")}>
        <div className="reader-toolbar"><button className="back-button" onClick={()=>setTab("library")}><ArrowLeft size={17}/> {t.backLibrary}</button><div className="reader-actions"><button className="icon-button" type="button" onClick={()=>void printFullBook()} title={t.savePdf} aria-label={t.savePdf}><Download size={19}/></button>{(isDemoBook(active)||privateToken)&&<button className="icon-button" onClick={()=>void toggleFavorite()} title={active.favorite?t.unfavorite:t.favorite} aria-label={active.favorite?t.unfavorite:t.favorite}><Heart size={19} fill={active.favorite?"currentColor":"none"}/></button>}<button className="icon-button dangerous" type="button" onClick={()=>deleteBook(active)} title={t.delete} aria-label={t.delete}><Trash2 size={19}/></button></div></div>
        {error&&<p className="error" role="alert">{error}</p>}
        <div className="reader-mode-controls" role="group" aria-label={({ru:"Режим чтения",uz:"Oqish rejimi",en:"Reading mode"} as const)[lang]}>
          <button type="button" aria-pressed={readerFocusMode} className={readerFocusMode?"active":""} onClick={()=>{setReaderFocusMode(v=>!v);setReaderSettingsOpen(false);setEditingPage(false);}}>
            <BookOpen size={16}/>{readerFocusMode?({ru:"Обычное чтение",uz:"Oddiy oqish",en:"Show controls"} as const)[lang]:({ru:"Только сказка",uz:"Faqat ertak",en:"Focus reading"} as const)[lang]}
          </button>
          {!readerFocusMode&&<button type="button" aria-expanded={readerSettingsOpen} aria-controls="reader-display-options" onClick={()=>setReaderSettingsOpen(v=>!v)}>
            <SlidersHorizontal size={16}/>{({ru:"Настройки",uz:"Sozlamalar",en:"Settings"} as const)[lang]}
          </button>}
        </div>
        {readerSettingsOpen&&!readerFocusMode&&<div id="reader-display-options" className="reader-display-settings" role="group" aria-label={({ru:"Настройки чтения",uz:"Oqiş sozlamalari",en:"Reading settings"} as const)[lang]}>
          <span>{({ru:"Размер текста",uz:"Matn ölçami",en:"Text size"} as const)[lang]}</span>
          <div className="reader-font-controls">
            {(["small","normal","large"] as const).map((size,index)=><button key={size} type="button" className={readerFontScale===size?"active":""} aria-pressed={readerFontScale===size} aria-label={({ru:["Мелкий текст","Обычный текст","Крупный текст"],uz:["Kiçik matn","Oddiy matn","Katta matn"],en:["Small text","Normal text","Large text"]} as const)[lang][index]} onClick={()=>setReaderFontScale(size)}>A<span aria-hidden="true">{index===0?"−":index===2?"+":""}</span></button>)}
          </div>
          <fieldset className="reader-book-variants" aria-label={({ru:"Выбор оформления книги",uz:"Kitob ko'rinishini tanlash",en:"Choose book layout"} as const)[lang]}>
            <legend>{({ru:"Вид книги",uz:"Kitob ko'rinishi",en:"Book layout"} as const)[lang]}</legend>
            <div className="reader-book-variant-grid">
              {(["spread","classic","storybook","simple"] as const).map((variant,index)=><button type="button" key={variant} className={"reader-book-variant"+(readerBookStyle===variant?" selected":"")} aria-pressed={readerBookStyle===variant} onClick={()=>setReaderBookStyle(variant)}>
                <span className={"reader-variant-preview reader-variant-preview-"+variant} aria-hidden="true"><i/><i/><i/></span>
                <strong>{({ru:["Разворот","Классическая","Современная","Без украшений"],uz:["Kitob yoyilmasi","Klassik kitob","Zamonaviy","Oddiy"],en:["Open book","Classic","Modern","Minimal"]} as const)[lang][index]}</strong>
                {readerBookStyle===variant&&<CheckCircle2 size={15} className="reader-book-selected-icon" aria-hidden="true"/>}
              </button>)}
            </div>
            <small>{({ru:"Оформление меняется сразу. Текст и прогресс чтения сохраняются.",uz:"Ko'rinish darhol o'zgaradi. Matn va o'qish davomiyligi saqlanadi.",en:"Appearance changes instantly. Text and reading progress stay the same."} as const)[lang]}</small>
          </fieldset>
          <div className="wt-art-motion-toggle" role="group" aria-label={({ru:"Живые иллюстрации",uz:"Jonli rasmlar",en:"Living illustrations"} as const)[lang]}>
            <span><Sparkles size={14} aria-hidden="true"/> {({ru:"Живые иллюстрации",uz:"Jonli rasmlar",en:"Living illustrations"} as const)[lang]}</span>
            {(["off","gentle","magic"] as const).map((motion,index)=><button key={motion} type="button" aria-pressed={readerArtMotion===motion} onClick={()=>setReaderArtMotion(motion)}>
              {({ru:["Выкл.","Плавно","Волшебно"],uz:["O'chirilgan","Mayin","Sehrli"],en:["Off","Gentle","Magic"]} as const)[lang][index]}
            </button>)}
          </div>
          <small className="wt-art-motion-hint">{({ru:"Плавное движение картинки и света, без загрузки видео. При уменьшении движения в настройках телефона эффект отключается.",uz:"Rasm va yorug'lik mayin harakatlanadi. Video yuklanmaydi. Telefon animatsiyani cheklasa, effekt o'chadi.",en:"Gentle image and light movement, no video downloads. Reduced Motion on your phone turns effects off."} as const)[lang]}</small>
          <button type="button" className={"reader-warm-toggle"+(readerWarmMode&&!readerNightMode?" active":"")} aria-pressed={readerWarmMode&&!readerNightMode} onClick={()=>{setReaderWarmMode(value=>!value);setReaderNightMode(false);}}><BookOpen size={15}/>{({ru:"Тёплый фон",uz:"Iliq fon",en:"Warm background"} as const)[lang]}</button>
          <button type="button" className={"reader-night-toggle"+(readerNightMode?" active":"")} aria-pressed={readerNightMode} onClick={()=>{setReaderNightMode(v=>!v);setReaderWarmMode(false);}}><MoonStar size={15}/>{({ru:"Ночной режим",uz:"Tungi rejim",en:"Night mode"} as const)[lang]}</button>
        </div>}
        {!readerFocusMode&&<details className="reader-bedtime-disclosure">
          <summary><MoonStar size={16} aria-hidden="true"/><span>{({ru:"Режим перед сном",uz:"Uyqu oldidan",en:"Bedtime mode"} as const)[lang]}</span>{bedtimeUntil!==null&&<span className="reader-bedtime-active">{({ru:"Таймер включён",uz:"Taymer yoqilgan",en:"Timer active"} as const)[lang]}</span>}<ChevronDown size={16} className="reader-bedtime-chevron" aria-hidden="true"/></summary>
          <div className="bedtime-controls" role="group" aria-label={({ru:"Таймер перед сном",uz:"Uxlash taymeri",en:"Bedtime timer"} as const)[lang]}>
            <span>{({ru:"Остановить озвучку через",uz:"Ovozni to'xtatish",en:"Stop narration after"} as const)[lang]}</span>
            {([10,20] as const).map(minutes=><button type="button" key={minutes} aria-pressed={bedtimeUntil!==null&&Math.abs(bedtimeUntil-Date.now()-minutes*60000)<60000} onClick={()=>{setReaderNightMode(true);setReaderWarmMode(false);setBedtimeUntil(Date.now()+minutes*60000);}}>{minutes} {({ru:"мин",uz:"daq",en:"min"} as const)[lang]}</button>)}
            {bedtimeUntil!==null&&<button type="button" onClick={()=>setBedtimeUntil(null)}>{({ru:"Отменить",uz:"Bekor qilish",en:"Cancel"} as const)[lang]}</button>}
          </div>
        </details>}
        <div className="reader-title"><div className="reader-book-meta"><span className="reader-crown"><Crown size={16}/></span><span className="reader-child-label">{t.forChild} {active.name}</span>{isDemoBook(active)&&(active as import("./demo").DemoBook).savedOnDevice&&<span className="reader-saved-tag"><CheckCircle2 size={14}/>{t.savedOnDevice}</span>}</div><h2>{active.title}</h2><p>{t.page} {page+1} {t.of} {active.pages.length} · {Math.round(((page+1)/Math.max(1,active.pages.length))*100)}%</p><div className="reader-progress-track" role="progressbar" aria-label={t.page+" "+(page+1)+" "+t.of+" "+active.pages.length} aria-valuemin={0} aria-valuemax={active.pages.length} aria-valuenow={page+1}><span style={{width:((page+1)/Math.max(1,active.pages.length)*100)+"%"}}/></div></div>
        <div className="reader-audio-toolbar"><button type="button" onClick={speakPage}><Volume2 size={17}/>{speaking?(speechPaused?t.resumeAudio:t.pauseAudio):t.listen}{speaking?(speechPaused?<Play size={16}/>:<PauseCircle size={16}/>):null}</button>{speaking&&<button type="button" onClick={stopSpeech}><Square size={15}/>{t.stopAudio}</button>}</div>
        {!readerNightMode&&bedtimeUntil===null&&<button type="button" className={"reader-ambience-button"+(ambienceOn?" active":"")} aria-pressed={ambienceOn} onClick={toggleAmbience}>
          <Music2 size={16} aria-hidden="true"/>
          {ambienceOn
            ?({ru:"Выключить звуки сказки",uz:"Ertak tovushlarini o'chirish",en:"Stop story sounds"} as const)[lang]
            :({ru:"Звуки сказки",uz:"Ertak tovushlari",en:"Story sounds"} as const)[lang]}
        </button>}
        <div className={"story-page reader-font-"+readerFontScale+" book-style-"+readerBookStyle+(readerNightMode?" reader-night":readerWarmMode?" reader-warm":"")} ref={storyPageRef} onTouchStart={onReaderTouchStart} onTouchMove={onReaderTouchMove} onTouchEnd={onReaderTouchEnd} onTouchCancel={onReaderTouchCancel} aria-label={({ru:"Страница сказки. Листайте влево или вправо.",uz:"Ertak sahifasi. Chapga yoki öngga suring.",en:"Story page. Swipe left or right to turn pages."} as const)[lang]}><div key={active.id+":"+page+":image"} className={"story-page-image reader-turn-image wt-living-art wt-motion-"+(readerNightMode||bedtimeUntil!==null?"off":readerArtMotion)+" wt-art-"+(isDemoBook(active as DemoBook)&&["three-pigs","bremen","puss-boots"].includes((active as DemoBook).classicId||"")?"village":isDemoBook(active as DemoBook)&&["cinderella","rapunzel","sleeping-beauty","snow-white"].includes((active as DemoBook).classicId||"")?"palace":"forest")}>{active.mode==="private-account"&&privateToken&&API
          ?<PrivateReaderIllustration api={API} session={privateToken} bookId={active.id} pageNumber={page+1}
             alt={t.illustration+" "+(page+1)}
             fallback={<StoryIllustration url={classicReaderImage(isDemoBook(active as DemoBook)?(active as DemoBook).classicId:undefined,active.pages[page].image_url,page)} alt={t.illustration+" "+(page+1)} readerFullWidth animatedUrl={readerArtMotion==="magic"&&!reduceArtMotion&&!readerNightMode&&bedtimeUntil===null&&isDemoBook(active as DemoBook)?classicAnimatedPage((active as DemoBook).classicId,classicReaderImage((active as DemoBook).classicId,active.pages[page].image_url,page),page):null}/>}/>
          :<StoryIllustration url={classicReaderImage(isDemoBook(active as DemoBook)?(active as DemoBook).classicId:undefined,active.pages[page].image_url,page)} alt={t.illustration+" "+(page+1)} readerFullWidth animatedUrl={readerArtMotion==="magic"&&!reduceArtMotion&&!readerNightMode&&bedtimeUntil===null&&isDemoBook(active as DemoBook)?classicAnimatedPage((active as DemoBook).classicId,classicReaderImage((active as DemoBook).classicId,active.pages[page].image_url,page),page):null}/>}
{isDemoBook(active as DemoBook)&&classicAnimatedPage((active as DemoBook).classicId,classicReaderImage((active as DemoBook).classicId,active.pages[page].image_url,page),page)&&!reduceArtMotion&&!readerNightMode&&bedtimeUntil===null&&
  <button type="button" className="wt-character-motion-control" aria-pressed={readerArtMotion==="magic"} onClick={()=>setReaderArtMotion(current=>current==="magic"?"off":"magic")}>
    <Sparkles size={16} aria-hidden="true"/>
    {readerArtMotion==="magic"
      ?({ru:"Остановить героев",uz:"Qahramonlarni to'xtatish",en:"Pause characters"} as const)[lang]
      :({ru:"Оживить героев",uz:"Qahramonlarni jonlantirish",en:"Animate characters"} as const)[lang]}
  </button>}
<div className="wt-art-effects" aria-hidden="true">{readerArtMotion!=="off"&&!readerNightMode&&bedtimeUntil===null&&Array.from({length:6},(_,i)=><span className="wt-art-particle" key={i} style={{"--wt-x":(14+i*13)+"%","--wt-y":(18+i%3*22)+"%","--wt-dur":(9+i%4*2)+"s","--wt-delay":(-i*1.8)+"s"} as React.CSSProperties}/>)}</div></div><div key={active.id+":"+page+":text"} className="story-text reader-turn-text" aria-live="polite" aria-atomic="true"><span className="dropcap-star" aria-hidden="true">✦</span>{active.pages[page].text}</div></div>
        {isDemoBook(active)&&canRefreshClassicDemoStory(active as DemoBook)&&<div className="story-edit-zone"><button type="button" onClick={upgradeClassicStory}><WandSparkles size={15}/>{({ru:"Обновить сюжет сказки",uz:"Ertak hikoyasini yangilash",en:"Update story scenes"} as const)[lang]}</button></div>}
        {isDemoBook(active)&&<div className="story-edit-zone">
          {!editingPage?<button type="button" onClick={beginPageEdit}><WandSparkles size={15}/>{t.editPage}</button>:
            <div className="story-page-editor"><textarea autoFocus value={pageDraft} onChange={e=>setPageDraft(e.target.value)} minLength={12} maxLength={1500} rows={7} aria-label={t.editPage}/>
              <div><button type="button" onClick={savePageEdit}>{t.savePage}</button><button type="button" onClick={()=>setEditingPage(false)}>{t.cancelEdit}</button></div>
            </div>}
        </div>}
        {page===active.pages.length-1&&<section className="reader-finale" aria-label={({ru:"После сказки",uz:"Ertakdan keyin",en:"After the story"} as const)[lang]}>
          <div className="reader-finale-heading">
            <strong>{({ru:"История закончилась. Что дальше?",uz:"Ertak tugadi. Keyin nima?",en:"The story is finished. What's next?"} as const)[lang]}</strong>
            <span>{({ru:"Выберите одно занятие",uz:"Bitta mashgulotni tanlang",en:"Choose one activity"} as const)[lang]}</span>
          </div>
          <div className="reader-finale-options" role="group" aria-label={({ru:"Занятия после сказки",uz:"Ertakdan keyingi mashgulotlar",en:"After-story activities"} as const)[lang]}>
            {isDemoBook(active)&&<button type="button" aria-pressed={readerEndActivity==="ending"} onClick={()=>setReaderEndActivity(current=>current==="ending"?null:"ending")}>{({ru:"Изменить финал",uz:"Yakunini tanlash",en:"Choose an ending"} as const)[lang]}</button>}
            <button type="button" aria-pressed={readerEndActivity==="adventure"} onClick={()=>setReaderEndActivity(current=>current==="adventure"?null:"adventure")}>{({ru:"Новое приключение",uz:"Yangi sarguzasht",en:"Bonus adventure"} as const)[lang]}</button>
            <button type="button" aria-pressed={readerEndActivity==="game"} onClick={()=>setReaderEndActivity(current=>current==="game"?null:"game")}>{({ru:"Игра со словами",uz:"Soz oyini",en:"Word game"} as const)[lang]}</button>
          </div>
        {isDemoBook(active)&&readerEndActivity==="ending"&&<div className="interactive-endings"><strong>{t.interactiveEnding}</strong>
          <div role="group" aria-label={t.interactiveEnding}>{(["friendship","discovery"] as const).map(id=><button type="button" key={id} className={active.endingChoice===id?"active":""} aria-pressed={active.endingChoice===id} onClick={()=>selectEnding(id)}>{endings[active.language||storyLang][id].title}</button>)}</div>
        </div>}
        {readerEndActivity==="adventure"&&<StoryBranchQuest key={active.id} lang={active.language||lang}/>}
        {readerEndActivity==="game"&&<section className="reading-word-game" aria-label={({ru:"Игра после сказки",uz:"Ertakdan keyingi o'yin",en:"After-story game"} as const)[lang]}>
          <strong>{({ru:"Игра: найди слово из сказки",uz:"O'yin: ertakdagi so'zni top",en:"Game: find a word from the story"} as const)[lang]}</strong>
          {(()=>{
            const storyWords=Array.from(new Set(active.pages.flatMap(item=>item.text.match(/[\p{L}]{5,}/gu)||[]).map(word=>word.toLocaleLowerCase()))).filter(word=>word.length>=5);
            const answer=storyWords[0];
            if(!answer)return <p>{({ru:"Для этой сказки пока нет словесной игры.",uz:"Bu ertak uchun so'z o'yini hali yo'q.",en:"No word game for this story yet."} as const)[lang]}</p>;
            const candidates=({ru:["радуга","корабль","солнышко","дракон","пианино","планета","волшебство","приключение","карандаш","путешествие"],uz:["kamalak","kemalar","quyosh","ajdarho","musiqa","sayyora","sehrgar","sarguzasht","qalamlar","sayohat"],en:["rainbow","spaceship","sunshine","dragon","piano","planet","magical","adventure","pencils","journey"]} as const)[active.language||lang].filter(word=>!storyWords.includes(word)&&word!==answer);
            const choices=[answer,...candidates.slice(0,2)].sort((a,b)=>a.localeCompare(b));
            return <><p>{({ru:"Какое слово встречалось в истории?",uz:"Qaysi so'z hikoyada uchradi?",en:"Which word appeared in the story?"} as const)[lang]}</p>
              <div className="reading-word-choices">{choices.map(word=><button type="button" key={word} disabled={wordGameAnswer!==null} aria-pressed={wordGameAnswer===word} onClick={()=>setWordGameAnswer(word)}>{word}</button>)}</div>
              {wordGameAnswer!==null&&<p role="status">{wordGameAnswer===answer?({ru:"Верно! Ты внимательно читал сказку.",uz:"To'g'ri! Ertakni diqqat bilan o'qiding.",en:"Correct! You read carefully."} as const)[lang]:({ru:"Попробуй ещё раз: правильное слово",uz:"Yana urinib ko'r: to'g'ri so'z",en:"Try again: the correct word is"} as const)[lang]+" «"+answer+"»"}</p>}
              {wordGameAnswer!==null&&<button type="button" className="word-game-retry" onClick={()=>setWordGameAnswer(null)}>{({ru:"Играть снова",uz:"Qayta o'ynash",en:"Play again"} as const)[lang]}</button>}
            </>;
          })()}
        </section>}
        {isDemoBook(active)&&<button type="button" className="sequel-action" onClick={continueAdventure}><BookOpen size={17}/>{t.sequel}<ArrowRight size={17}/></button>}
        </section>}
        {<article className="print-book" aria-hidden="true">
          <div className="print-book-cover"><StoryIllustration url={classicReaderImage(isDemoBook(active as DemoBook)?(active as DemoBook).classicId:undefined,active.pages[0].image_url,0)} alt={t.cover}/><h1>{active.title}</h1><p>{t.forChild} {active.name}</p><small>WonderTale AI</small></div>
          {active.pages.map((item,index)=><section className="print-book-page" key={item.number}><div className="print-book-page-head"><span>WonderTale AI</span><span>{t.page} {index+1} {t.of} {active.pages.length}</span></div><StoryIllustration url={classicReaderImage(isDemoBook(active as DemoBook)?(active as DemoBook).classicId:undefined,item.image_url,index)} alt={t.illustration+" "+(index+1)}/><p>{item.text}</p></section>)}
        </article>}
        <div className="pager"><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ArrowLeft size={18}/> {t.back}</button><span className="pager-indicators" aria-label={t.page+" "+(page+1)+" "+t.of+" "+active.pages.length}><span className="pager-mobile-current" aria-live="polite">{page+1} / {active.pages.length}</span>{active.pages.length<=7?active.pages.map((_,i)=><button type="button" key={i} className={"dot "+(i===page?"active":"")} onClick={()=>setPage(i)} aria-label={t.page+" "+(i+1)} aria-current={i===page?"page":undefined}/>):<><button type="button" className="pager-jump" disabled={page===0} onClick={()=>setPage(0)} aria-label={t.page+" 1"}>1</button><span className="pager-current" aria-live="polite">{page+1} / {active.pages.length}</span><button type="button" className="pager-jump" disabled={page===active.pages.length-1} onClick={()=>setPage(active.pages.length-1)} aria-label={t.page+" "+active.pages.length}>{active.pages.length}</button></>}</span><button disabled={page===active.pages.length-1} onClick={()=>setPage(p=>Math.min(active.pages.length-1,p+1))}>{t.next} <ArrowRight size={18}/></button></div>
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
      <nav className="mobile-tabbar" aria-label="WonderTale"><button type="button" aria-current={tab==="home"?"page":undefined} className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Home size={20}/><span>{t.backHome}</span></button><button type="button" aria-current={tab==="library"||tab==="reader"?"page":undefined} className={tab==="library"||tab==="reader"?"active":""} onClick={()=>setTab("library")}><Library size={20}/><span>{t.library}</span></button><button type="button" aria-current={tab==="create"?"page":undefined} className={tab==="create"?"active":""} onClick={()=>openCreate()}><Plus size={21}/><span>{t.create}</span></button><button type="button" aria-current={tab==="account"?"page":undefined} className={tab==="account"?"active":""} onClick={()=>setTab("account")}><UserRound size={20}/><span>{({ru:"Профиль",uz:"Profil",en:"Profile"} as const)[lang]}</span></button></nav>
    </main>
    <footer className="site-legal-footer">
      <span>© {new Date().getFullYear()} WonderTale AI · Komron Giyosov</span>
    </footer>
  </div>;
}
function StoryIllustration({url,alt,lazy=false,readerFullWidth=false,animatedUrl=null}:{url:string;alt:string;lazy?:boolean;readerFullWidth?:boolean;animatedUrl?:string|null}){
 const zoomCopy=readerZoomLabels(document.documentElement.lang);
 const [failed,setFailed]=useState(0);
 const [zoomOpen,setZoomOpen]=useState(false);
 const [zoomScale,setZoomScale]=useState(1);
 const [zoomPan,setZoomPan]=useState({x:0,y:0});
 const pinch=useRef<{distance:number;scale:number}|null>(null);
 const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const lastSingleTap=useRef(0);
  const usedPinch=useRef(false);
 const startZoomTouch=(event:React.TouchEvent<HTMLDivElement>)=>{
   event.stopPropagation();
   if(event.touches.length===2){
     pinch.current={distance:readerFingerDistance(event.touches[0],event.touches[1]),scale:zoomScale};
     usedPinch.current=true;
     drag.current=null;
   }else if(event.touches.length===1){
     drag.current={x:event.touches[0].clientX,y:event.touches[0].clientY,panX:zoomPan.x,panY:zoomPan.y};
   }
 };
 const moveZoomTouch=(event:React.TouchEvent<HTMLDivElement>)=>{
   event.stopPropagation();
   if(event.touches.length===2&&pinch.current?.distance){
     setZoomScale(clampReaderZoom(pinch.current.scale*readerFingerDistance(event.touches[0],event.touches[1])/pinch.current.distance));
   }else if(event.touches.length===1&&drag.current&&zoomScale>1){
     const limitX=(window.innerWidth*(zoomScale-1))/2;
     const limitY=(window.innerHeight*(zoomScale-1))/2;
     setZoomPan({
       x:Math.max(-limitX,Math.min(limitX,drag.current.panX+event.touches[0].clientX-drag.current.x)),
       y:Math.max(-limitY,Math.min(limitY,drag.current.panY+event.touches[0].clientY-drag.current.y))
     });
   }
 };
 const endZoomTouch=(event:React.TouchEvent<HTMLDivElement>)=>{
   event.stopPropagation();
   if(event.touches.length===0){
     if(!usedPinch.current && drag.current && event.changedTouches.length===1){
       const finger=event.changedTouches[0];
       const movement=Math.hypot(finger.clientX-drag.current.x,finger.clientY-drag.current.y);
       if(movement<12){
         const now=Date.now();
         if(now-lastSingleTap.current<325){
           toggleDoubleTapZoom();
           lastSingleTap.current=0;
         }else lastSingleTap.current=now;
       }
     }
     usedPinch.current=false;
     pinch.current=null;
     drag.current=null;
     if(zoomScale<=1)setZoomPan({x:0,y:0});
   }else if(event.touches.length<2)pinch.current=null;
 };
 const toggleDoubleTapZoom=()=>{setZoomScale(current=>current>1?1:2);setZoomPan({x:0,y:0});};
 const openButtonRef=useRef<HTMLButtonElement|null>(null);
 const closeButtonRef=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
   if(!zoomOpen)return;
   const previousOverflow=document.body.style.overflow;
   document.body.style.overflow="hidden";
   const onKey=(event:KeyboardEvent)=>{
     if(event.key==="Escape"){event.preventDefault();setZoomOpen(false);return;}
     if(event.key==="Tab"){
       const controls=[...document.querySelectorAll<HTMLButtonElement>(".wt-reader-image-lightbox button:not(:disabled)")];
       if(!controls.length)return;
       const first=controls[0],last=controls[controls.length-1];
       if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
       else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
     }
   };
   document.addEventListener("keydown",onKey);
   closeButtonRef.current?.focus();
   return ()=>{
     document.body.style.overflow=previousOverflow;
     document.removeEventListener("keydown",onKey);
     openButtonRef.current?.focus();
   };
 },[zoomOpen]);
 useEffect(()=>{setZoomOpen(false);setZoomScale(1);setZoomPan({x:0,y:0});},[url,animatedUrl]);
 const originalSrc=bookImage(url);
 const offlineFallback=classicPngFallback(originalSrc);
 // Frame GIF -> original PNG -> built-in offline SVG. Never animate private photos.
 const src=animatedUrl&&failed===0?animatedUrl:failed<=(animatedUrl?1:0)?originalSrc:offlineFallback||originalSrc;
 useEffect(()=>setFailed(0),[originalSrc,animatedUrl]);
 if(failed>=(animatedUrl?3:2)||(failed===(animatedUrl?2:1)&&!offlineFallback))return <svg className="story-image-fallback" viewBox="0 0 640 420" role="img" aria-label={alt} xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="story-fallback-sky" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eadcff"/><stop offset="1" stopColor="#ffe9c9"/></linearGradient></defs>
   <rect width="640" height="420" fill="url(#story-fallback-sky)"/>
   <circle cx="490" cy="105" r="53" fill="#fff8dc"/>
   <path d="M0 285 Q120 180 255 287 Q390 180 640 278 V420 H0Z" fill="#a6a0cf"/>
   <path d="M0 355 Q165 265 340 352 Q480 285 640 335 V420 H0Z" fill="#7e78b3"/>
   <path d="M190 320 Q320 230 450 320 L450 378 Q320 310 190 378Z" fill="#fff9ef" stroke="#7757aa" strokeWidth="10"/>
   <path d="M320 275 V355" stroke="#7757aa" strokeWidth="9"/>
   <g fill="#fff8dc"><circle cx="108" cy="95" r="7"/><circle cx="175" cy="150" r="5"/><circle cx="360" cy="77" r="6"/><circle cx="565" cy="185" r="5"/></g>
 </svg>;
 const image=<img src={src} alt={alt} className={(readerFullWidth?"wt-reader-picture ":"")+(animatedUrl&&failed===0?"wt-character-gif":"")} loading={lazy?"lazy":"eager"} decoding="async" fetchPriority={lazy?"low":"auto"} onError={()=>setFailed(value=>value+1)}/>;
 if(!readerFullWidth)return image;
 return <>
   <button type="button" ref={openButtonRef} className="wt-reader-image-open" onClick={()=>{setZoomScale(1);setZoomPan({x:0,y:0});setZoomOpen(true);}} aria-label={zoomCopy.open+": "+alt} title={zoomCopy.open}>
     {image}
     
   </button>
   {zoomOpen&&createPortal(
     <div className="wt-reader-image-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={event=>{event.stopPropagation();setZoomOpen(false);}} onTouchStart={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}>
       <div className="wt-reader-image-lightbox-toolbar">
         <button type="button" ref={closeButtonRef} className="wt-reader-lightbox-close" onClick={()=>setZoomOpen(false)} aria-label={zoomCopy.close}><X size={24}/></button>
       </div>
       <div className="wt-reader-image-lightbox-scroll" onClick={event=>event.stopPropagation()} onTouchStart={startZoomTouch} onTouchMove={moveZoomTouch} onTouchEnd={endZoomTouch} onTouchCancel={endZoomTouch} onDoubleClick={()=>{if(!window.matchMedia("(pointer:coarse)").matches)toggleDoubleTapZoom();}}>
         <img src={src} alt={alt} className="wt-reader-image-lightbox-img" style={{transform:"translate("+zoomPan.x+"px,"+zoomPan.y+"px) scale("+zoomScale+")"}} onError={()=>setFailed(value=>value+1)}/>
       </div>
       <div className="wt-reader-lightbox-zoom" onClick={event=>event.stopPropagation()}>
         <button type="button" onClick={()=>setZoomScale(value=>Math.max(1,Number((value-.25).toFixed(2))))} disabled={zoomScale<=1} aria-label={zoomCopy.decrease}><ZoomOut size={21}/></button>
         <span aria-live="polite">{Math.round(zoomScale*100)}%</span>
         <button type="button" onClick={()=>setZoomScale(value=>Math.min(3,Number((value+.25).toFixed(2))))} disabled={zoomScale>=3} aria-label={zoomCopy.increase}><ZoomIn size={21}/></button>
       </div>
     </div>,
     document.body
   )}
 </>;
}
function ClassicTile({item,lang,onPick,action}:{item:Classic;lang:Lang;onPick:()=>void;action:string}){
 const [coverFailed,setCoverFailed]=useState(false);
 const imageExtension=["red-hood","cinderella","three-pigs","snow-white","ugly-duckling","bremen"].includes(item.id)?".svg":".webp";
 return <button type="button" className={"classic-card classic-"+item.color} onClick={onPick} aria-label={action+": "+item.title[lang]+" · "+(item.minAge??5)+"+"}>
   <span className="classic-cover">{coverFailed
     ? <ClassicCover item={item}/>
     : <img className="classic-generated-image"
         src={"/images/classics/"+item.id+imageExtension}
         alt={item.title[lang]} loading="lazy" decoding="async" fetchPriority="low" onError={()=>setCoverFailed(true)}/>}<span className="classic-age-badge" aria-hidden="true">{item.minAge??5}+</span></span>
   <span className="classic-info"><strong>{item.title[lang]}</strong><small>{item.summary[lang]}</small><span className="classic-link">{action} <ArrowRight size={15}/></span></span>
 </button>;
}
function BookTile({book,open,lang}:{book:Book;open:()=>void;lang:Lang}){
  const finished=book.pages.length>1&&(book.lastPage??0)>=book.pages.length-1;
  const reading=(book.lastPage??0)>0;
  const progress=finished
    ?({ru:"Дочитано",uz:"Oqib tugatildi",en:"Finished"} as const)[lang]
    :labels[lang].continueReading+": "+labels[lang].page+" "+((book.lastPage??0)+1);
  return <button type="button" className="book-tile" onClick={open} aria-label={book.title+" · "+book.name+(reading?" · "+progress:"")}>
    <span className="book-cover-art"><StoryIllustration url={book.pages[0]?.image_url||""} alt={book.title+" · "+labels[lang].cover} lazy/><span className="book-cover-age" aria-hidden="true">{book.age}+</span></span>
    <span className="book-caption"><strong>{book.title}</strong><small>{book.name} · {book.pages.length} {labels[lang].pages}</small>
      {reading&&<><small className="read-progress">{progress}</small><span className="book-progress-track" role="progressbar" aria-label={labels[lang].page+" "+Math.min((book.lastPage??0)+1,book.pages.length)+" "+labels[lang].of+" "+book.pages.length} aria-valuemin={0} aria-valuemax={book.pages.length} aria-valuenow={Math.min((book.lastPage??0)+1,book.pages.length)}><span style={{width:(Math.min((book.lastPage??0)+1,book.pages.length)/Math.max(1,book.pages.length)*100)+"%"}}/></span></>}
      {book.favorite&&<span className="book-favorite-badge" aria-label={({ru:"В избранном",uz:"Sevimlilarda",en:"Favorite"} as const)[lang]}><Heart size={14} fill="currentColor"/></span>}
    </span>
  </button>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA remains usable online */});});}
