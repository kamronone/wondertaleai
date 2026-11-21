-- Minimal private audit log for illustration job state transitions.
-- Event rows contain no child profile, prompt, media or provider secret.
-- Deleting the job/book/parent cascades and deletes its audit events.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES illustration_jobs(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK(event IN ('queued','processing','completed','failed','needs_review')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS illustration_events_job_created_idx
  ON illustration_job_events(job_id,created_at);
COMMIT;
