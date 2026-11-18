export type Lang = "ru" | "uz" | "en";
export const languages: {id:Lang;label:string}[] = [{id:"ru",label:"Русский"},{id:"uz",label:"O‘zbekcha"},{id:"en",label:"English"}];
export const labels = {
 ru:{
 library:"Мои сказки", badge:"Чудеса начинаются здесь", hero1:"Сказка, в которой", hero2:"главный герой",hero3:"— ваш ребёнок",
 heroDesc:"Создавайте тёплые, волшебные истории с именем ребёнка, его фотографией и самым необычным сюжетом.",
 create:"Создать свою сказку", recognizable:"Узнаваемый герой",recognizableDesc:"В AI-режиме иллюстрации создаются по фотографии малыша.",
 anyStory:"Любой сюжет",anyStoryDesc:"Космос, драконы или удивительные друзья. Вы решаете!",
 realBook:"Настоящая книга",realBookDesc:"Листайте страницы и сохраняйте истории.",
 shelf:"Ваша волшебная полка",seeAll:"Посмотреть все",quiet:"Пока здесь тихо",quietDesc:"Первая сказка уже ждёт своего главного героя.",firstBook:"Создать первую книгу",
 backHome:"На главную",magic:"Создадим немного волшебства",magicDesc:"Расскажите нам про маленького героя и его приключение.",
 heroStep:"Наш главный герой",heroStepDesc:"Кто отправится навстречу приключениям?",childName:"Имя ребёнка",nameExample:"Например, Амир",age:"Возраст",years:"лет",photo:"Добавить фотографию ребёнка",photoHint:"По желанию · JPG, PNG или WebP · до 8 МБ",
 storyStep:"Придумаем историю",storyStepDesc:"Выберите тему или создайте свою.",world:"Мир приключений",about:"О чём будет ваша сказка?",promptExample:"Например: Амир отправляется на Луну и помогает маленькой звезде найти дорогу домой...",style:"Стиль иллюстраций",storyLanguage:"Язык сказки",interfaceLanguage:"Язык интерфейса",
 consent:"Я родитель или законный представитель ребёнка и согласен(на) использовать предоставленную фотографию для создания сказки.",
 demo:"Это демоверсия: история создаётся по шаблону, а иллюстрации декоративные и не похожи на ребёнка.",creating:"Создаём волшебство...",createBook:"Создать мою сказку",
 libraryTitle:"Моя библиотека",libraryDesc:"Ваши тёплые истории хранятся здесь.",newStory:"Новая сказка",empty:"Книжная полка пуста",emptyDesc:"Создайте первую семейную историю.",
 backLibrary:"Библиотека",forChild:"Сказка для",page:"Страница",of:"из",back:"Назад",next:"Далее",illustration:"Иллюстрация страницы",cover:"Обложка сказки",pages:"страниц",
 installTitle:"Сказки всегда под рукой",installDesc:"На iPhone откройте сайт в Safari → «Поделиться» → «На экран Домой». На Android откройте меню браузера → «Установить приложение».",
 cartoons:"AI-мультфильмы",cartoonsDesc:"Следующая глава WonderTale: истории будут оживать.",soon:"Скоро",footer:"для маленьких мечтателей",deleteConfirm:"Удалить эту сказку?",deleteError:"Не удалось удалить сказку",generateError:"Не получилось создать книгу",genericError:"Ошибка генерации",savePdf:"Сохранить PDF через печать",downloadPdf:"Скачать PDF",delete:"Удалить",themeOptions:["Волшебство","Космос","Динозавры","Морские приключения","Дружба","Перед сном"],styleOptions:["Акварель","3D мультфильм","Книжная иллюстрация","Нежная пастель"]
 },
 uz:{
 library:"Ertaklarim",badge:"Mo‘jizalar shu yerda boshlanadi",hero1:"Bu ertakning",hero2:"bosh qahramoni",hero3:"— farzandingiz",
 heroDesc:"Farzandingizning ismi, surati va ajoyib sarguzashtlari asosida sehrli ertaklar yarating.",
 create:"Ertak yaratish",recognizable:"Tanish qahramon",recognizableDesc:"AI rejimida rasmlar bolaning suratiga asoslanadi.",
 anyStory:"Istalgan syujet",anyStoryDesc:"Koinot, ajdarlar yoki yangi do‘stlar. Tanlov sizniki!",
 realBook:"Haqiqiy kitob",realBookDesc:"Sahifalarni varaqlang va ertaklarni saqlang.",
 shelf:"Sehrli kutubxonangiz",seeAll:"Barchasini ko‘rish",quiet:"Hali ertaklar yo‘q",quietDesc:"Birinchi ertak o‘z qahramonini kutmoqda.",firstBook:"Birinchi ertakni yaratish",
 backHome:"Bosh sahifa",magic:"Keling, mo‘jiza yarataylik",magicDesc:"Kichik qahramon va uning sarguzashtlari haqida ayting.",
 heroStep:"Bosh qahramonimiz",heroStepDesc:"Sarguzashtga kim yo‘l oladi?",childName:"Bolaning ismi",nameExample:"Masalan, Amir",age:"Yoshi",years:"yosh",photo:"Bolaning suratini qo‘shish",photoHint:"Ixtiyoriy · JPG, PNG yoki WebP · 8 MB gacha",
 storyStep:"Ertak o‘ylab topamiz",storyStepDesc:"Mavzuni tanlang yoki o‘zingiz yozing.",world:"Sarguzasht olami",about:"Ertagingiz nima haqida bo‘ladi?",promptExample:"Masalan: Amir Oyga uchib, kichkina yulduzga uyiga qaytishda yordam beradi...",style:"Rasmlar uslubi",storyLanguage:"Ertak tili",interfaceLanguage:"Ilova tili",
 consent:"Men bolaning ota-onasi yoki qonuniy vakiliman va taqdim etilgan suratdan ertak yaratish uchun foydalanishga roziman.",
 demo:"Bu demo versiya: ertak qolip asosida tuziladi, rasmlar bezak uchun va bolaga o‘xshamaydi.",creating:"Mo‘jiza yaratilmoqda...",createBook:"Ertagimni yaratish",
 libraryTitle:"Kutubxonam",libraryDesc:"Sevimli ertaklaringiz shu yerda saqlanadi.",newStory:"Yangi ertak",empty:"Kutubxona bo‘sh",emptyDesc:"Birinchi oilaviy ertagingizni yarating.",
 backLibrary:"Kutubxona",forChild:"Ertak qahramoni:",page:"Sahifa",of:"/",back:"Orqaga",next:"Keyingi",illustration:"Sahifa rasmi",cover:"Ertak muqovasi",pages:"sahifa",
 installTitle:"Ertaklar doim yoningizda",installDesc:"iPhone: Safari → Ulashish → Bosh ekranga qo‘shish. Android: brauzer menyusi → Ilovani o‘rnatish.",
 cartoons:"AI multfilmlar",cartoonsDesc:"WonderTale'ning keyingi bosqichi: ertaklar jonlanadi.",soon:"Tez orada",footer:"kichik xayolparastlar uchun",deleteConfirm:"Bu ertak o‘chirilsinmi?",deleteError:"Ertakni o‘chirib bo‘lmadi",generateError:"Ertak yaratilmadi",genericError:"Yaratishda xatolik",savePdf:"Chop etish orqali PDF saqlash",downloadPdf:"PDF yuklab olish",delete:"O‘chirish",themeOptions:["Sehrli olam","Koinot","Dinozavrlar","Dengiz sarguzashtlari","Do‘stlik","Uyqu oldidan"],styleOptions:["Akvarel","3D multfilm","Kitob illyustratsiyasi","Mayin pastel"]
 },
 en:{
 library:"My stories",badge:"Where magic begins",hero1:"A story where",hero2:"the main character",hero3:"is your child",
 heroDesc:"Create heartwarming adventures starring your child, inspired by their name, photo, and imagination.",
 create:"Create a story",recognizable:"Familiar hero",recognizableDesc:"In AI mode, pictures are inspired by your child's photo.",
 anyStory:"Any adventure",anyStoryDesc:"Space, dragons, or wonderful friends. You decide!",
 realBook:"A real storybook",realBookDesc:"Turn pages and save your favorite stories.",
 shelf:"Your magical shelf",seeAll:"View all",quiet:"It's quiet here",quietDesc:"Your first story is waiting for its hero.",firstBook:"Create your first book",
 backHome:"Home",magic:"Let's make some magic",magicDesc:"Tell us about your little hero and their adventure.",
 heroStep:"Our main character",heroStepDesc:"Who is going on this adventure?",childName:"Child's name",nameExample:"For example, Amir",age:"Age",years:"years old",photo:"Add your child's photo",photoHint:"Optional · JPG, PNG or WebP · up to 8 MB",
 storyStep:"Let's imagine a story",storyStepDesc:"Choose a theme or write your own.",world:"Adventure world",about:"What should your story be about?",promptExample:"For example: Amir travels to the Moon and helps a little star find its way home...",style:"Illustration style",storyLanguage:"Story language",interfaceLanguage:"App language",
 consent:"I am the child's parent or legal guardian and consent to using the provided photo to create this story.",
 demo:"This is a demo: stories are template-based and decorative illustrations do not resemble your child.",creating:"Making magic...",createBook:"Create my story",
 libraryTitle:"My library",libraryDesc:"Your favorite stories are saved here.",newStory:"New story",empty:"Your bookshelf is empty",emptyDesc:"Create your first family story.",
 backLibrary:"Library",forChild:"A story for",page:"Page",of:"of",back:"Back",next:"Next",illustration:"Page illustration",cover:"Story cover",pages:"pages",
 installTitle:"Stories at your fingertips",installDesc:"iPhone: open in Safari → Share → Add to Home Screen. Android: browser menu → Install app.",
 cartoons:"AI cartoons",cartoonsDesc:"The next chapter of WonderTale: your stories come to life.",soon:"Coming soon",footer:"for little dreamers",deleteConfirm:"Delete this story?",deleteError:"Couldn't delete the story",generateError:"Couldn't create the story",genericError:"Generation failed",savePdf:"Save PDF via Print",downloadPdf:"Download PDF",delete:"Delete",themeOptions:["Magic","Space","Dinosaurs","Ocean adventures","Friendship","Bedtime"],styleOptions:["Watercolor","3D cartoon","Storybook illustration","Soft pastel"]
 }
} as const;
export const getSavedLanguage=():Lang=>{try{const saved=localStorage.getItem("wondertale-ui-lang");return saved==="ru"||saved==="uz"||saved==="en"?saved:"ru"}catch{return "ru"}};
export const saveLanguage=(lang:Lang)=>{try{localStorage.setItem("wondertale-ui-lang",lang)}catch{/* storage can be unavailable */}};
