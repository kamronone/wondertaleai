-- WonderTale AI private foundation schema.
-- Apply ONLY to a dedicated, empty WonderTale database, never to another project.
-- Non-destructive and idempotent on PostgreSQL 15+.
BEGIN;

CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  child_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 2 AND 14),
  story TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wondertale_books_owner_created_idx ON books(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS wondertale_sessions_owner_idx ON sessions(owner_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  email_key TEXT PRIMARY KEY,
  window_started BIGINT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS generation_quota (
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(owner_id, day)
);
CREATE TABLE IF NOT EXISTS generation_global_quota (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0
);
COMMIT;
