export type ReadingBook = {
  id: string;
  pages: readonly unknown[];
  lastPage?: number;
  favorite?: boolean;
  theme: string;
  savedOnDevice?: boolean;
  mode: string;
};

export type AchievementKey = "books" | "reading" | "finished" | "favorites" | "explorer" | "collection";

const goals: Record<AchievementKey, number> = {
  books: 3,
  reading: 3,
  finished: 3,
  favorites: 3,
  explorer: 3,
  collection: 5
};

/** Derive progress from the active account's visible library; never use a shared global counter. */
export function getReadingAchievements(books: readonly ReadingBook[]) {
  const counts: Record<AchievementKey, number> = {
    books: books.length,
    reading: books.filter(book => (book.lastPage ?? 0) > 0).length,
    finished: books.filter(book => book.pages.length > 1 && (book.lastPage ?? 0) >= book.pages.length - 1).length,
    favorites: books.filter(book => book.favorite === true).length,
    explorer: new Set(books.filter(book => (book.lastPage ?? 0) > 0).map(book => book.theme || "other")).size,
    collection: books.filter(book => book.savedOnDevice || book.mode === "private-account").length
  };
  const entries = (Object.keys(goals) as AchievementKey[]).map(id => ({
    id,
    count: counts[id],
    goal: goals[id],
    unlocked: counts[id] >= goals[id]
  }));
  return { entries, unlocked: entries.filter(entry => entry.unlocked).length, total: entries.length };
}
