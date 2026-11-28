-- Keep completed AI request tombstones after a parent deletes a book.
-- An already-paid request must not be mistaken for an in-progress request.
-- Safe to reapply in a dedicated PostgreSQL WonderTale database.
BEGIN;
ALTER TABLE ai_idempotency
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'pending';
UPDATE ai_idempotency
  SET state='completed'
  WHERE book_id IS NOT NULL AND state='pending';
COMMIT;
