import type { Lang } from "./i18n";

export type LegalDocument = "terms" | "privacy" | "copyright" | "parents";
type Section = {heading:string; paragraphs:string[]};
type DocumentText={title:string; intro:string; sections:Section[]};
const laws = [
  {label:"Uzbekistan: Personal Data Act, ZRU-547",url:"https://lex.uz/ru/docs/4396428"},
  {label:"Uzbekistan: Copyright Act, ZRU-42",url:"https://lex.uz/ru/acts/1023494"},
  {label:"Uzbekistan: Consumer Protection Act, 221-I",url:"https://lex.uz/ru/acts/14643"},
  {label:"Uzbekistan: E-commerce Act, ZRU-792",url:"https://lex.uz/ru/docs/6213428"}
];
const docs:Record<Lang,Record<LegalDocument,DocumentText>>={
ru:{
terms:{title:"Условия использования",intro:"Предварительная редакция для бесплатного демонстрационного режима WonderTale AI. До запуска платных услуг документы и реквизиты владельца должны быть проверены и дополнены.",sections:[
{heading:"1. Назначение сервиса",paragraphs:["WonderTale AI помогает взрослым создавать и читать детские сказки. Деморежим может работать локально в браузере. AI-функции и семейный аккаунт доступны только при технической готовности соответствующих сервисов.","Сервис не является образовательным, медицинским или консультационным учреждением. Взрослый проверяет содержание сказки перед показом ребёнку."]},
{heading:"2. Кто может пользоваться",paragraphs:["Аккаунт и загрузку данных ребёнка должен контролировать родитель либо законный представитель. Не вводите чужие персональные данные без законного основания и не предоставляйте ребёнку доступ к управлению чужим аккаунтом."]},
{heading:"3. Пользовательские материалы",paragraphs:["Вы должны иметь права на загружаемые сюжеты, изображения и другие материалы. Не загружайте чужие фотографии и тексты без разрешения, конфиденциальные сведения, незаконные и опасные материалы.","Для обработки выбранной функции вы разрешаете сервису технически обрабатывать переданные материалы в объёме, необходимом для её выполнения. Это не означает передачу сервису исключительных прав на ваши исходные материалы."]},
{heading:"4. Генерация сказок",paragraphs:["AI-результаты могут быть неточными, повторяться или случайно содержать нежелательные выражения. Проверяйте текст до чтения ребёнку. Права на результат зависят от применимого законодательства, исходных материалов и договоров с поставщиками технологий.","Классические сюжеты и сторонние иллюстрации могут охраняться отдельно. Пользование сервисом не передаёт права на сторонние произведения."]},
{heading:"5. Доступность и сохранение",paragraphs:["Демонстрационные книги, сохранённые на устройстве, могут исчезнуть при очистке браузера или удалении его данных. Не рассматривайте этот способ как единственную резервную копию.","Мы не гарантируем непрерывную доступность пилотной AI-функции и не ограничиваем законные права потребителя."]},
{heading:"6. Оплата и споры",paragraphs:["Данные условия не вводят платную подписку. Цены, платёжный оператор, возвраты, реквизиты продавца и оферта должны быть опубликованы и согласованы до приёма настоящих платежей.","Заявления об ошибках, доступе к данным или правах на материалы рассматриваются в порядке применимого законодательства Республики Узбекистан."]},
{heading:"7. Владелец и обновления",paragraphs:["Разработка обозначена как kamronone. Это имя автора проекта, а не подтверждённые регистрационные данные оператора. Полное юридическое имя, адрес и канал для обращений должны быть опубликованы до публичного коммерческого запуска.","При существенном изменении условий пользователям потребуется доступ к новой редакции до продолжения использования соответствующих функций."]}
]},
privacy:{title:"Политика конфиденциальности",intro:"Проект политики для WonderTale AI. Фактические серверы, подрядчики, сроки хранения и реквизиты оператора требуют проверки до коммерческого запуска.",sections:[
{heading:"1. Какие данные используются",paragraphs:["В локальном деморежиме могут сохраняться имя персонажа или ребёнка, возраст, выбранные сюжеты, текст сказки, избранное и прогресс чтения в браузере данного устройства.","При работе семейного аккаунта могут обрабатываться адрес электронной почты родителя, сведения об аккаунте, имена и возраст детей, сюжеты, AI-запросы, созданные книги и технические события, необходимые для работы сервиса."]},
{heading:"2. Фото детей",paragraphs:["В текущем AI-режиме отправка фотографии ребёнка не поддерживается. Файл, выбранный в демонстрационном интерфейсе, нельзя считать опубликованным или переданным для AI-генерации. Перед включением серверной обработки фото потребуется отдельное явное информирование и надлежащее согласие законного представителя.","Не загружайте чужие или чувствительные фотографии."]},
{heading:"3. Цели и основания",paragraphs:["Данные могут понадобиться для создания и отображения сказок, входа в семейный аккаунт, синхронизации по вашему запросу, восстановления доступа и защиты сервиса.","Обработка детских персональных данных должна иметь действительное законное основание и согласие законного представителя в форме, требуемой законодательством. Простая отметка в интерфейсе сама по себе не заменяет всю обязательную процедуру."]},
{heading:"4. Хранение и передача",paragraphs:["Локальные данные хранятся в браузере до их удаления пользователем или браузером. Серверное местоположение, список подрядчиков, механизмы передачи и сроки удаления должны быть подтверждены отдельно.","Авторизованные запросы не должны кешироваться общим PWA Service Worker. Политика не утверждает, что вся инфраструктура уже соответствует требованиям локализации данных Узбекистана; это обязательный пункт проверки перед запуском."]},
{heading:"5. Права пользователя",paragraphs:["Родитель или законный представитель вправе запрашивать сведения об обработке, исправление, удаление данных и отзыв согласия в пределах и порядке, предусмотренных законом.","Порядок подачи обращений и рабочий контакт оператора должны быть опубликованы до коммерческого запуска. Удаление локальных книг возможно через средства приложения или браузера."]},
{heading:"6. Безопасность и изменения",paragraphs:["Для защиты семейных книг необходимы проверенные ограничения доступа между аккаунтами, управление сессиями, безопасная передача и контроль доступа к данным. Ни один способ передачи или хранения не даёт абсолютной гарантии безопасности.","О существенных изменениях политики необходимо сообщать до начала соответствующей новой обработки."]}
]},
copyright:{title:"Авторские права",intro:"Правила использования произведений, кода и контента WonderTale AI.",sections:[
{heading:"1. Проект и оформление",paragraphs:["Название WonderTale AI используется для обозначения сервиса. Разработчик проекта: kamronone. Исходный код, оригинальные тексты интерфейса, авторские иллюстрации и элементы дизайна защищаются только в той мере, в какой права на них действительно принадлежат соответствующему правообладателю.","Отметка © сама по себе не создаёт исключительных прав и не доказывает регистрацию товарного знака."]},
{heading:"2. Пользовательские сказки",paragraphs:["Исходные истории, имена персонажей и загруженные материалы принадлежат их законным правообладателям. Отправка материала не означает отчуждения авторских прав.","Правовой режим автоматически созданных AI-частей не должен описываться как безусловная исключительная собственность пользователя или сервиса. Он определяется применимым правом и фактическим творческим вкладом."]},
{heading:"3. Классические произведения",paragraphs:["Сюжеты из общественного достояния могут использоваться с соблюдением закона. При этом современные переводы, адаптации, иллюстрации, аудиозаписи и конкретные издания могут иметь самостоятельных правообладателей.","Не следует распространять материалы третьих лиц под видом собственных."]},
{heading:"4. Разрешённое использование и претензии",paragraphs:["Вы можете читать и сохранять доступные сказки в рамках предусмотренных возможностей сервиса и прав на соответствующий контент. Копирование брендинга, интерфейса и чужих произведений для перепродажи без надлежащих прав не разрешено.","Для заявления о нарушении прав необходимо предоставить сведения о произведении, подтверждение полномочий, ссылку на спорный материал и контактные данные. Канал приёма претензий должен быть опубликован до коммерческого запуска."]}
]},
parents:{title:"Правила для родителей и детей",intro:"WonderTale AI предназначен для семейного использования под наблюдением взрослых.",sections:[
{heading:"1. Контроль взрослого",paragraphs:["Создание аккаунта, ввод реальных детских данных, синхронизация и удаление семейных книг должны выполняться родителем или законным представителем.","Взрослый проверяет сгенерированные сказки перед чтением ребёнку. Возрастные рекомендации и таймеры не являются технической блокировкой доступа."]},
{heading:"2. Минимум данных",paragraphs:["Лучше использовать вымышленные имена и не указывать фамилию, адрес, школу, номер телефона, диагнозы и другую лишнюю информацию о ребёнке.","Не используйте фотографии других детей без необходимого разрешения. Текущая AI-генерация персональные фотографии не принимает."]},
{heading:"3. Согласие и отзыв",paragraphs:["Перед передачей детских персональных данных необходима надлежащая форма согласия родителя или другого законного представителя. Для предусмотренных законом случаев требуется письменная форма, в том числе допустимый электронный документ.","Пользователь должен иметь понятный способ обращения по поводу данных ребёнка и отзыва согласия. Такой канал и процедура должны быть проверены до массового запуска."]},
{heading:"4. Безопасное чтение",paragraphs:["Чередуйте чтение с перерывами, используйте подходящий размер текста и помогайте ребёнку отличать выдумку от фактов. При неприятном содержании прекратите чтение и сообщите владельцу сервиса."]}
]}
},
uz:{
terms:{title:"Foydalanish shartlari",intro:"WonderTale AI bepul demo rejimi uchun dastlabki hujjat. Tijorat ishga tushirishidan oldin egasi haqidagi rasmiy malumotlar tekshirilishi kerak.",sections:[
{heading:"1. Xizmat haqida",paragraphs:["WonderTale AI ota-onalarga bolalar uchun ertak yaratish va oqishga yordam beradi. Demo ertaklar brauzerda saqlanishi mumkin. AI va oilaviy akkaunt faqat mavjud bolgan funksiyalar doirasida ishlaydi.","Ota-ona bolaga oqishdan oldin matnni tekshirishi kerak."]},
{heading:"2. Foydalanuvchi javobgarligi",paragraphs:["Bola malumotlarini faqat ota-ona yoki qonuniy vakil kiritadi. Begona fotosurat, matn yoki shaxsiy malumotni tegishli ruxsatsiz joylamang.","Taqiqlangan, xavfli yoki boshqa shaxs huquqlarini buzuvchi materiallardan foydalanmang."]},
{heading:"3. Kontent huquqlari",paragraphs:["Siz kiritgan asl materiallarga egalik huquqi avtomatik ravishda xizmatga otmaydi. Xizmat vazifani bajarish uchun zarur texnik qayta ishlashga ruxsat oladi.","AI natijalarining huquqiy maqomi amaldagi qonun, asl materiallar va ijodiy hissaga bogliq. Uchinchi tomon asarlari va tarjimalari alohida himoyalanishi mumkin."]},
{heading:"4. Saqlash va mavjudlik",paragraphs:["Brauzer malumotlari tozalansa, qurilmada saqlangan ertaklar yoqolishi mumkin. AI funksiyasi doimiy ishlashi kafolatlanmaydi.","Bepul demo uchun ushbu hujjat tolov majburiyatini yaratmaydi. Pullik xizmatlar uchun narx, qaytarish qoidalari va sotuvchi rekvizitlari alohida elon qilinishi kerak."]},
{heading:"5. Huquqiy malumot",paragraphs:["Loyiha ishlab chiquvchisi: kamronone. Bu rasmiy operator rekvizitlari emas. Tijorat boshlanishidan oldin yuridik nom, manzil va murojaat aloqasi kiritilishi kerak.","Nizolar Ozbekiston Respublikasining amaldagi qonunchiligiga muvofiq korib chiqiladi."]}
]},
privacy:{title:"Maxfiylik siyosati",intro:"WonderTale AI uchun dastlabki maxfiylik matni. Server joylashuvi va operator rekvizitlari hali tekshirilishi kerak.",sections:[
{heading:"1. Malumot turlari",paragraphs:["Demo rejimida brauzerda bola yoki qahramon ismi, yosh, ertak matni, tanlovlar va oqish jarayoni saqlanishi mumkin.","Oilaviy akkauntda ota-ona emaili, profil, bolalar haqidagi kiritilgan malumotlar, AI sorovlar va kitoblar serverda qayta ishlanishi mumkin."]},
{heading:"2. Bolalar fotosuratlari",paragraphs:["Hozirgi AI rejimi bola suratini qabul qilmaydi. Suratni server orqali qayta ishlashdan oldin alohida xabarnoma va qonuniy vakilning tegishli roziligi kerak.","Begona yoki maxfiy suratlarni yuklamang."]},
{heading:"3. Maqsad va rozilik",paragraphs:["Malumotlar ertak yaratish, akkauntga kirish, ota-ona soroviga binoan sinxronlash va xavfsizlik uchun kerak bolishi mumkin.","Bolalar shaxsiy malumotlarini qayta ishlashda qonun talab qilgan shakldagi ota-ona yoki qonuniy vakil roziligi zarur. Oddiy belgilash bu tartibning ornini har doim ham bosmaydi."]},
{heading:"4. Saqlash va uzatish",paragraphs:["Demo malumotlar brauzer tozalanguncha turishi mumkin. Serverlarning joylashuvi, pudratchilar, saqlash muddati va ochirish tartibi tijorat ishga tushirishidan oldin tekshirilishi kerak.","Xizmat hozircha barcha malumotlarni Ozbekistonda saqlash talablari bajarilganini kafolatlamaydi."]},
{heading:"5. Sizning huquqlaringiz",paragraphs:["Qonunga muvofiq malumotlarni bilish, tuzatish, ochirish va rozilikni qaytarib olish uchun murojaat qilish mumkin.","Operatorning murojaat uchun aniq aloqa kanali ishga tushirishdan oldin elon qilinishi kerak."]}
]},
copyright:{title:"Mualliflik huquqi",intro:"WonderTale AI materiali va ertaklaridan foydalanish qoidalari.",sections:[
{heading:"1. Loyiha muallifi",paragraphs:["WonderTale AI loyihasini ishlab chiquvchi: kamronone. Asl kod, dizayn va illyustratsiyalar faqat tegishli huquq egasiga qonuniy tegishli bolgan qismida himoyalanadi.","© belgisi alohida mualliflik yoki tovar belgisini royxatdan otkazish ornini bosmaydi."]},
{heading:"2. Ertaklar va AI",paragraphs:["Foydalanuvchi kiritgan asl materiallar huquqlari qonuniy egasida qoladi. AI yaratgan qismlarning huquqiy maqomi qonun va ijodiy hissaga bogliq.","Klassik ertakning zamonaviy tarjimasi, rasmlari va audio yozuvi alohida himoyalangan bolishi mumkin."]},
{heading:"3. Ruxsat va shikoyatlar",paragraphs:["Kitoblarni faqat xizmatdagi imkoniyatlar va material huquqlari doirasida oqish yoki saqlash mumkin. Begona kontentni ruxsatsiz sotish mumkin emas.","Huquq buzilishi haqidagi murojaat uchun asar, havola va huquq dalilini tayyorlang. Rasmiy aloqa kanali tijoratdan oldin beriladi."]}
]},
parents:{title:"Ota-onalar uchun qoidalar",intro:"WonderTale AI bolalar tomonidan kattalar nazoratida foydalanish uchun moljallangan.",sections:[
{heading:"1. Kattalar nazorati",paragraphs:["Akkaunt yaratish, bolaning malumotlarini yuborish, sinxronlash va ochirishni ota-ona yoki qonuniy vakil bajaradi.","AI ertagini bolaga oqishdan avval tekshiring. Yosh tavsiyalari va taymerlar haqiqiy bloklash tizimi emas."]},
{heading:"2. Kamroq shaxsiy malumot",paragraphs:["Haqiqiy ism orniga taxallus ishlating. Familiya, manzil, maktab, telefon va boshqa ortiqcha malumotlarni kiritmang.","Boshqa bolaning suratidan ruxsatsiz foydalanmang. AI hozircha bola fotosuratini olmaydi."]},
{heading:"3. Rozilik va yordam",paragraphs:["Bola malumotlarini qayta ishlashdan oldin qonunda nazarda tutilgan shakldagi qonuniy vakil roziligi kerak.","Rozilikni qaytarish va malumotlarni ochirish uchun ishlaydigan aloqa tartibi ommaviy ishga tushirishdan oldin joriy etilishi shart."]},
{heading:"4. Oqish xavfsizligi",paragraphs:["Dam olish uchun tanaffus qiling, qulay matn olchamini tanlang va ertakdagi tasavvur bilan haqiqiy hayotni farqlashga yordam bering."]}
]}
},
en:{
terms:{title:"Terms of use",intro:"Draft terms for the free WonderTale AI demonstration. Operator identity and commercial details require review before paid launch.",sections:[
{heading:"1. Service",paragraphs:["WonderTale AI helps adults create and read children's stories. Demo stories may be stored in the browser. AI and family accounts work only when the related services are available.","An adult must review generated content before showing it to a child."]},
{heading:"2. Responsible use",paragraphs:["A parent or legal guardian must supervise child data and account use. Do not submit another person's personal data, photos or copyrighted materials without appropriate permission.","Do not submit illegal, unsafe or infringing material."]},
{heading:"3. Submitted content and AI",paragraphs:["You retain any rights you lawfully hold in your original submissions. You allow the service to process submitted material as needed for the selected feature.","Rights in AI-assisted outputs depend on applicable law, source material and human creative contributions. Classic stories, modern adaptations and third-party illustrations may have separate owners."]},
{heading:"4. Storage and availability",paragraphs:["Stories stored only in the browser may be lost if browser data is cleared. Pilot AI availability is not guaranteed.","These demo terms create no payment obligation. Prices, seller details, refunds and a separate offer must be published before actual payments are accepted."]},
{heading:"5. Operator and complaints",paragraphs:["Project developer: kamronone. This is not a verified legal operator identity. Legal name, address and a working complaints contact must be added before commercial launch.","Applicable consumer protection laws and statutory rights are not excluded by these terms."]}
]},
privacy:{title:"Privacy policy",intro:"Draft policy. Server location, subprocessors, retention periods and the legal operator's identity must be verified before commercial launch.",sections:[
{heading:"1. Data processed",paragraphs:["Demo mode may store a child or character name, age, story prompts, books, favorites and reading progress in the current browser.","A parent account may process parent email, account details, child names and ages, AI prompts, generated books and technical security events."]},
{heading:"2. Children's photos",paragraphs:["The current AI generator does not accept child photos. A future photo-processing feature would require fresh notice and appropriate guardian consent.","Do not submit photos of others without permission."]},
{heading:"3. Purpose and consent",paragraphs:["Data may be used to create and show stories, sign in, sync on explicit request, recover access and secure the service.","Children's personal data requires a lawful basis and guardian consent in the legally prescribed form. A simple checkbox may not meet every legal formality."]},
{heading:"4. Storage and transfers",paragraphs:["Local demo data can remain until deleted by the user or browser. Server location, subprocessors, transfer mechanisms and retention periods must be verified before launch.","Authenticated book responses must not be cached in the shared PWA service worker. This draft does not claim that Uzbekistan's data-localization rules have already been satisfied."]},
{heading:"5. Your rights",paragraphs:["Parents and legal guardians may exercise applicable rights of access, correction, deletion and withdrawal of consent.","A working operator contact and request procedure must be published before commercial launch."]}
]},
copyright:{title:"Copyright and intellectual property",intro:"How rights in WonderTale AI and its stories are handled.",sections:[
{heading:"1. Site materials",paragraphs:["Project developer: kamronone. Original code, visual design and illustrations are protected only to the extent that their rights actually belong to the relevant owner.","A © notice alone does not establish ownership or trademark registration."]},
{heading:"2. Stories and AI",paragraphs:["You retain lawful rights in original materials you submit. AI-generated portions are not automatically the exclusive property of the service or user.","Modern translations, illustrations and recordings of classic tales may be separately copyrighted."]},
{heading:"3. Use and complaints",paragraphs:["You may read and save content through the available functions subject to applicable rights. Do not resell third-party works without authorization.","Infringement reports should identify the work, relevant URL and evidence of ownership. A formal contact route must be added before commercial launch."]}
]},
parents:{title:"Parents and child safety",intro:"WonderTale AI is intended for family use under adult supervision.",sections:[
{heading:"1. Adult supervision",paragraphs:["A parent or guardian must manage accounts, child data submissions, sync and book deletion.","Review AI-assisted stories before reading them to a child. Age suggestions and timers are not technical access restrictions."]},
{heading:"2. Data minimization",paragraphs:["Prefer nicknames and avoid unnecessary surnames, addresses, schools, phone numbers or sensitive information.","Do not upload photos of other children without permission. Current AI generation does not accept child photos."]},
{heading:"3. Consent",paragraphs:["Processing children's personal data requires guardian consent in the form prescribed by applicable law.","An accessible contact and withdrawal/deletion process must be verified before public launch."]},
{heading:"4. Safe reading",paragraphs:["Take breaks, select a readable font size and help children distinguish fiction from facts."]}
]}
}
};
const navigation:Record<Lang,Record<LegalDocument,string>>={
ru:{terms:"Условия",privacy:"Конфиденциальность",copyright:"Авторские права",parents:"Для родителей"},
uz:{terms:"Shartlar",privacy:"Maxfiylik",copyright:"Mualliflik huquqi",parents:"Ota-onalar"},
en:{terms:"Terms",privacy:"Privacy",copyright:"Copyright",parents:"Parents"}
};

export function LegalCenter({lang,document,onSelect,onBack}:{lang:Lang;document:LegalDocument;onSelect:(doc:LegalDocument)=>void;onBack:()=>void}){
 const t=docs[lang][document];
 return <section className="legal-center" aria-label={t.title}>
  <button className="legal-back" type="button" onClick={onBack}>{({ru:"Назад",uz:"Orqaga",en:"Back"} as const)[lang]}</button>
  <header><h1>{t.title}</h1><p>{t.intro}</p><small>{({ru:"Проект редакции: 20.11.2026",uz:"Loyiha sanasi: 20.11.2026",en:"Draft date: 20 Nov 2026"} as const)[lang]}</small></header>
  <nav className="legal-tabs" aria-label={({ru:"Юридические документы",uz:"Huquqiy hujjatlar",en:"Legal documents"} as const)[lang]}>
   {(["terms","privacy","copyright","parents"] as const).map(id=><button key={id} type="button" aria-current={document===id?"page":undefined} onClick={()=>onSelect(id)}>{navigation[lang][id]}</button>)}
  </nav>
  <div className="legal-sections">{t.sections.map(section=><section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</section>)}</div>
  <aside className="legal-laws"><strong>{({ru:"Законодательные источники",uz:"Qonun manbalari",en:"Legal references"} as const)[lang]}</strong>
   <ul>{laws.map(law=><li key={law.url}><a href={law.url} target="_blank" rel="noopener noreferrer">{law.label}</a></li>)}</ul>
  </aside>
 </section>;
}
