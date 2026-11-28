/** Reader page navigation with strict bounds and vertical-scroll protection. */
export function nextReaderPage(current: number, total: number, direction: -1 | 1): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const last = Math.max(0, Math.floor(total) - 1);
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.min(last, Math.floor(current))) : 0;
  return Math.max(0, Math.min(last, safeCurrent + direction));
}

export function swipeDirection(dx: number, dy: number): -1 | 1 | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  // Only deliberate horizontal gestures should turn pages.
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}

/** Restore a saved page safely even after a book was shortened or sync returned invalid progress. */
export function resumeReaderPage(saved: number | null | undefined, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const last = Math.max(0, Math.floor(total) - 1);
  if (typeof saved !== "number" || !Number.isFinite(saved)) return 0;
  return Math.max(0, Math.min(last, Math.floor(saved)));
}
