-- Explicit, versioned opt-in for an authenticated parent.
-- Never infer consent from creating an account or choosing AI features.
-- Parent deletion cascades consent rows. Revocation happens through the API,
-- which additionally stops queued and in-flight illustration jobs.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_parent_consent (
  owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  granted_at TEXT,
  revoked_at TEXT,
  CHECK (NOT (granted_at IS NOT NULL AND revoked_at IS NOT NULL))
);
COMMIT;
