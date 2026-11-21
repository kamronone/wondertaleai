-- WonderTale AI: persistent idempotency for paid AI story generation.
-- Safe to apply repeatedly to a dedicated WonderTale database only.
-- A pending claim fails closed after a worker crash; it is never silently
-- deleted or replayed because the paid request may have reached the provider.
BEGIN;
CREATE TABLE IF NOT EXISTS ai_idempotency (
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, request_key)
);
COMMIT;
