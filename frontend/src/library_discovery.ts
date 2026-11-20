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
      const progress=Number(b.lastPage||0)-Number(a.lastPage||0);
      if(progress)return progress;
    }
    return b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id);
  });
}
