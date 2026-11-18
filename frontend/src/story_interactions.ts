import type { Lang } from "./i18n";

export type EndingId="friendship"|"discovery";
export const endings:Record<Lang,Record<EndingId,{title:string;addition:string}>>={
 ru:{
  friendship:{title:"Помочь друзьям",addition:"И тогда друзья решили помогать друг другу каждый день. Они устроили настоящий праздник доброты, пригласили всех знакомых и поняли: вместе даже самая трудная дорога превращается в приключение."},
  discovery:{title:"Открыть новую тайну",addition:"Но на последней странице появился загадочный золотой ключ. Он мерцал как звезда, обещая новую встречу и ещё одно невероятное приключение. Герои решили сохранить ключ до следующей сказки."}
 },
 uz:{
  friendship:{title:"Do‘stlarga yordam berish",addition:"Shundan so‘ng do‘stlar har kuni bir-biriga yordam berishga qaror qilishdi. Ular mehr bayramini uyushtirib, hammani taklif etishdi. Birgalikda har qanday qiyinchilikni yengish mumkinligini bilib olishdi."},
  discovery:{title:"Yangi sirni ochish",addition:"Ammo so‘nggi sahifada sirli oltin kalit paydo bo‘ldi. U yulduzdek porlab, yangi uchrashuv va yana bir sarguzashtni va’da qilardi. Qahramonlar kalitni keyingi ertakka asrab qo‘yishdi."}
 },
 en:{
  friendship:{title:"Help your friends",addition:"From that day on, the friends promised to help one another. They held a celebration of kindness and discovered that even the toughest journey becomes easier when everyone works together."},
  discovery:{title:"Explore a new mystery",addition:"On the final page, a mysterious golden key appeared. It shimmered like a star, promising another meeting and a brand-new adventure. The heroes saved it carefully for their next story."}
 }
};

export const storyPresets:Record<Lang,Array<{id:string;title:string;idea:string}>>={
 ru:[
  {id:"birthday",title:"День рождения",idea:"В день рождения добрые волшебники готовят для главного героя сюрприз: торт, поиски спрятанного подарка и праздник вместе с друзьями."},
  {id:"bedtime",title:"Перед сном",idea:"Спокойная история перед сном: путешествие среди мягких облаков, сияющих звёзд и тихого лунного сада. Без волнений и страшных событий."},
  {id:"learning",title:"Учимся играя",idea:"Увлекательное приключение, где герой учит цифры, цвета и новые слова, помогая дружелюбным сказочным животным."},
  {id:"confidence",title:"Смелость и дружба",idea:"Добрая сказка о том, как герой преодолевает робость, находит новых друзей и учится просить о помощи."}
 ],
 uz:[
  {id:"birthday",title:"Tug‘ilgan kun",idea:"Tug‘ilgan kunda mehribon sehrgarlar qahramonga tort, sirli sovg‘a izlash va do‘stlar davrasida bayram tayyorlashadi."},
  {id:"bedtime",title:"Uyqu oldidan",idea:"Uyqu oldidan sokin ertak: yumshoq bulutlar, porloq yulduzlar va oy nuridagi bog‘da sayohat. Qo‘rqinchli hodisalarsiz."},
  {id:"learning",title:"O‘ynab o‘rganamiz",idea:"Qahramon do‘stona ertak hayvonlariga yordam berib, sonlar, ranglar va yangi so‘zlarni o‘rganadigan sarguzasht."},
  {id:"confidence",title:"Jasorat va do‘stlik",idea:"Qahramon tortinchoqlikni yengib, yangi do‘stlar topishi va yordam so‘rashni o‘rganishi haqida mehribon ertak."}
 ],
 en:[
  {id:"birthday",title:"Birthday",idea:"Kind wizards plan a birthday surprise for the hero: a cake, a hidden present, and a celebration with friends."},
  {id:"bedtime",title:"Bedtime",idea:"A calm bedtime adventure through soft clouds, twinkling stars and a peaceful moonlit garden, without scary events."},
  {id:"learning",title:"Learn through play",idea:"A friendly adventure where the hero learns numbers, colors and new words while helping magical animal friends."},
  {id:"confidence",title:"Courage and friendship",idea:"A gentle story about overcoming shyness, making new friends and learning to ask for help."}
 ]
};
