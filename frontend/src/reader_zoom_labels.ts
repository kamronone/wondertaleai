/** Compact text for accessible illustration zoom controls on RU/UZ/EN pages. */
export function readerZoomLabels(language:string){
  if(language==="uz")return {
    open:"Rasmni kattalashtirish",
    close:"Kattalashtirilgan rasmni yopish",
    increase:"Rasmni kattalashtirish",
    decrease:"Rasmni kichraytirish",
  };
  if(language==="en")return {
    open:"Enlarge picture",
    close:"Close enlarged picture",
    increase:"Zoom in",
    decrease:"Zoom out",
  };
  return {
    open:"Увеличить изображение",
    close:"Закрыть увеличенное изображение",
    increase:"Увеличить изображение",
    decrease:"Уменьшить изображение",
  };
}
