-- WonderTale family profiles, favorites and reading progress.
-- Run only on a dedicated WonderTale PostgreSQL database.
BEGIN;
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 2 AND 14),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wondertale_children_owner_idx ON children(owner_id);
CREATE TABLE IF NOT EXISTS book_favorites (
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,book_id)
);
CREATE TABLE IF NOT EXISTS reading_progress (
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL CHECK(page BETWEEN 0 AND 99),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,book_id)
);
COMMIT;
