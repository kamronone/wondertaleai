# WonderTale AI: durable AI jobs (isolated pilot)

Status: implemented in the development branch. **Not enabled or deployed** on
Vercel; there is no autonomous worker or configured schedule. The original
`POST /api/books/generate` remains synchronous and unchanged for existing
frontend clients.

## Secure setup

Use a **dedicated, private WonderTale PostgreSQL database** and apply migrations
`004_ai_request_idempotency.sql`, `005_ai_completion_tombstones.sql`, and
`006_durable_ai_jobs.sql` in order. Set these only on the worker and isolated
API Preview (never in frontend or Production):

- `ENABLE_AI_JOBS=true` (default is `false`).
- `ENABLE_TEXT_AI=true`, `AI_ALLOWED_EMAILS`, `OPENAI_API_KEY`.
- `MAX_AI_STORIES_PER_DAY=1` while evaluating cost safety.
- `DATABASE_URL`, `AUTH_SECRET`, `APP_ENV=preview`.

Do not activate until parental consent, hosting location, access controls,
retention, AI-provider handling, and cost monitoring have been reviewed.

## API

All endpoints require a signed parent bearer session, are owner scoped and
carry `Cache-Control: private, no-store`.

- `POST /api/books/jobs` with a validated story JSON body and
  `Idempotency-Key` header (random 16–128 alphanumeric, underscore or hyphen).
  Returns HTTP 202 `{id,status:"queued",book_id:null}`; same key and body
  returns the same job without creating a duplicate.
- `GET /api/ai/jobs` lists the most recent 20 jobs belonging to this parent.
  It returns only opaque IDs, statuses and completed book IDs. No prompt text.
- `GET /api/books/jobs/{job_id}` retrieves one job, returning 404 for
  another parent's job. Possible states: `queued`, `processing`,
  `completed`, `failed`, `needs_review`, `unavailable`.
- `DELETE /api/books/jobs/{job_id}` cancels a job only if still `queued`.
  Processing or completed jobs are not cancellable with this endpoint.

There is a maximum of two outstanding queued/processing jobs per parent.
No credits or paid provider calls are consumed on enqueue.

## Worker

`backend/ai_worker.py` processes at most one job per invocation. It refuses
`APP_ENV=production`; no scheduler or public worker HTTP endpoint is provided.
A separately managed trusted process needs secure access to the same private
database and provider configuration. Never run the worker in a public browser.

Claiming a job is transactional, with PostgreSQL `FOR UPDATE SKIP LOCKED`
or SQLite `BEGIN IMMEDIATE`; multiple workers cannot claim the same job.
The worker uses the existing server-side per-parent and global AI quotas and
idempotent generation routine.

A worker crash after starting a potentially paid provider call results in
an unresolved `processing` job. The API reports `needs_review` after three
minutes. It is **not automatically retried**: the provider may have already
charged. Failed jobs are terminal; repeated UI queries cannot trigger another
provider call. Job text is cleared after a completed or failed attempt.

## Frontend pilot integration

The React client includes an opt-in experimental queue path controlled by
`VITE_ENABLE_AI_JOB_QUEUE=true` at **build time**. The default is disabled,
so existing synchronous AI generation stays unchanged. Do not set the frontend
flag until the Backend Preview has `ENABLE_AI_JOBS=true`, an independent
trusted worker is deployed, and privacy/cost release gates are complete.

When enabled, the existing creation form sends a random per-request
`Idempotency-Key` to `POST /api/books/jobs` and navigates to the parent
profile. The account shows `AiJobsPanel`: reloads the last 20 jobs after login
or page reload, allows cancellation only while queued, and links completed jobs
to the private library. The panel uses authenticated, no-store requests and is
unmounted after logout. Neither access tokens nor child prompts are stored in
browser persistence by the queue client.

## Remaining production work

- A persistent worker host, schedule, operational supervision, heartbeats,
  audit logging and explicit reconciliation of ambiguous provider charges.
- Encrypted job payload at rest, retention policy and secure deletion,
  verified parental consent and legal review for children's data.
- Recover/cancel UI and mobile interaction design, including a queue opt-in
  flag and reloading the user's job list after login.
- End-to-end testing of worker restarts, database outage, model moderation,
  cost monitoring and actual provider output on controlled Preview.
- Private image/video media pipeline, consent and storage remain separate.

CI tests use a mock AI provider plus a throwaway PostgreSQL 16 container.
They never invoke the real OpenAI API.
