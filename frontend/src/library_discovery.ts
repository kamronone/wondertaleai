export type LibrarySort = "newest" | "title" | "continue";

export type DiscoverableBook = {
  id: string;
  title: string;
  name: string;
  theme: string;
  created_at: string;
  favorite?: boolean;
  lastPage?: number;
  pages: readonly unknown[];
};

/** Filters only the books supplied by the current active parent/session. */
export function discoverBooks<T extends DiscoverableBook>(
  books: readonly T[],
  query: string,
  favoritesOnly: boolean,
  sort: LibrarySort
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  const filtered = books.filter(book => {
    if(favoritesOnly && !book.favorite)return false;
    if(!needle)return true;
    return [book.title,book.name,book.theme].some(value=>
      value.toLocaleLowerCase().includes(needle)
    );
  });
  return [...filtered].sort((a,b)=>{
    if(sort==="title"){
      const title=a.title.localeCompare(b.title);
      return title || a.id.localeCompare(b.id);
    }
    if(sort==="continue"){
      // Relative progress is comparable across books with different page counts.
      // A book on page 4 of 5 is further along than page 5 of 20.
      const fraction=(book:T)=>{
        const last=Math.max(0,book.pages.length-1);
        return last===0?0:Math.min(last,Math.max(0,Number(book.lastPage)||0))/last;
      };
      const progress=fraction(b)-fraction(a);
      if(progress)return progress;
    }
    return b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id);
  });
}
