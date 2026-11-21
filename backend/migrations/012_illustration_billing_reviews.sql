-- Manual billing reconciliation by trusted operators only.
-- No public endpoints, credentials, child names, prompts, or payment records.
-- Charge status and estimated/verified amount are independent of job status.
-- A review is immutable. Parent/book deletion cascades through the job.
BEGIN;
CREATE TABLE IF NOT EXISTS illustration_billing_reviews (
    job_id TEXT PRIMARY KEY REFERENCES illustration_jobs(id) ON DELETE CASCADE,
    charge_status TEXT NOT NULL CHECK(charge_status IN ('charged','not_charged','unknown')),
    amount_micro_usd INTEGER CHECK(amount_micro_usd>=0 AND amount_micro_usd<=100000000),
    evidence_sha256 TEXT NOT NULL,
    reviewed_at TEXT NOT NULL
);
COMMIT;
