-- WonderTale private parent email verification and recovery.
-- Run ONLY in dedicated WonderTale PostgreSQL after migrations 001 and 002.
BEGIN;
CREATE TABLE IF NOT EXISTS parent_email_status(
 owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE,
 verified_at TEXT
);
CREATE TABLE IF NOT EXISTS email_action_tokens(
 token_digest TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK (purpose IN ('verify','recover')),
 expires_at BIGINT NOT NULL,
 used_at BIGINT,
 issued_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS wondertale_email_action_owner_idx ON email_action_tokens(owner_id,purpose,issued_at);
COMMIT;
