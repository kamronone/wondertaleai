-- Persistent emergency pause for private illustration generation.
-- No public write endpoint. Operators must use a secured DB session.
-- Environment flags still default to disabled; database pause is additional.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_runtime_control (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
  updated_at TEXT NOT NULL
);
INSERT INTO illustration_runtime_control(singleton,paused,updated_at)
VALUES(1,0,'2026-11-21T00:00:00+00:00')
ON CONFLICT(singleton) DO NOTHING;
COMMIT;
