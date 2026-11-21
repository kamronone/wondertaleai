-- WonderTale AI: durable queue for a separate trusted worker.
-- Create ONLY on a dedicated WonderTale database. Idempotent PostgreSQL 15+.
-- Text payloads may contain child nicknames, so restrict DB access and set
-- a retention/deletion policy before production use.
BEGIN;
CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS ai_jobs_status_created_idx ON ai_jobs(status,created_at);
COMMIT;
