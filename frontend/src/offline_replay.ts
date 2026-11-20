/**
 * Replay only metadata belonging to the active parent session.
 * Keep unsent edits in their existing account-scoped queue. No credentials,
 * story content, or personal information are stored by this module.
 */
export type ReplayOptions = {
  progress: Map<string, number>;
  favorites: Map<string, boolean>;
  isActive: () => boolean;
  isMissingBook: (error: unknown) => boolean;
  waitForProgress: (id: string) => Promise<unknown>;
  sendProgress: (id: string, page: number) => Promise<void>;
  sendFavorite: (id: string, favorite: boolean) => Promise<void>;
  persist: () => void;
};

export async function replayPendingChanges(options: ReplayOptions): Promise<void> {
  const {progress, favorites, isActive, isMissingBook, waitForProgress,
    sendProgress, sendFavorite, persist} = options;
  for (const [id, page] of [...progress]) {
    if (!isActive()) return;
    // Never overtake an in-flight update for the same story.
    try { await waitForProgress(id); } catch { /* The current queued value still needs a retry. */ }
    if (!isActive()) return;
    if (progress.get(id) !== page) continue;
    try {
      await sendProgress(id, page);
      if (!isActive()) return;
      if (progress.get(id) === page) {
        progress.delete(id);
        persist();
      }
    } catch (error) {
      if (!isActive()) return;
      // 404 can mean replica lag. It must not starve other books.
      if (isMissingBook(error)) continue;
      // A real network or authorization failure must end this entire replay
      // attempt. Otherwise favorites would issue doomed requests immediately.
      return;
    }
  }
  for (const [id, favorite] of [...favorites]) {
    if (!isActive()) return;
    if (favorites.get(id) !== favorite) continue;
    try {
      await sendFavorite(id, favorite);
      if (!isActive()) return;
      if (favorites.get(id) === favorite) {
        favorites.delete(id);
        persist();
      }
    } catch (error) {
      if (!isActive()) return;
      if (isMissingBook(error)) continue;
      break;
    }
  }
}
