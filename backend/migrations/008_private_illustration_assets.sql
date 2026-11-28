-- Small sanitized PNG assets stored privately in WonderTale PostgreSQL.
-- For a limited pilot only: object storage will be needed for scale.
-- Assets cascade on job, book or parent deletion. No public media URLs.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_assets (
  job_id TEXT PRIMARY KEY REFERENCES illustration_jobs(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  png_bytes BYTEA NOT NULL,
  sha256 TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length > 0 AND byte_length <= 3000000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS illustration_assets_owner_book_idx
  ON illustration_assets(owner_id,book_id);
COMMIT;
