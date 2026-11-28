-- Private illustration jobs for owned story pages.
-- No raw child prompts or external URLs are stored in this ledger.
-- Requires a dedicated WonderTale PostgreSQL database.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 20),
  style TEXT NOT NULL CHECK (style IN ('watercolor','storybook','pencil')),
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  storage_key TEXT,
  UNIQUE(owner_id,book_id,page_number,style)
);
CREATE INDEX IF NOT EXISTS illustration_jobs_owner_created_idx
  ON illustration_jobs(owner_id,created_at DESC);
COMMIT;
