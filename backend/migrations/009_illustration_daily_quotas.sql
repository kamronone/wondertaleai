-- Separate non-refundable illustration call quotas. Never infer provider billing
-- from this ledger; it tracks locally reserved attempts, including uncertain
-- calls after a worker crash. Apply to a dedicated WonderTale PostgreSQL DB.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_daily_quota (
  day TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0)
);
CREATE TABLE IF NOT EXISTS illustration_parent_quota (
  owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY(owner_id,day)
);
COMMIT;
