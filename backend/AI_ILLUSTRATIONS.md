# Private AI illustration foundation

**Status: isolated code only. A provider adapter exists, but no live model
calls, automatic worker, deployment or production image generation is enabled.**

The feature is gated by `ENABLE_AI_ILLUSTRATIONS=true`, which is **false
by default**. Do not enable it for real families until a consent, storage,
moderation and cost review has been completed. This flag only allows creating
database entries, not rendering images.

## Owner-scoped API

- `POST /api/illustrations/jobs` with `{book_id,page_number,style}`, using
  an authenticated parent token. The book and requested page must exist under
  that exact parent. Styles: `watercolor`, `storybook`, `pencil`.
- Identical page/style requests return the same queued job. At most two
  queued/processing illustration jobs exist per parent.
- `GET /api/illustrations/jobs` returns at most 20 owner-scoped statuses,
  page numbers, and opaque IDs, never story text, child names or image URLs.
- `DELETE /api/illustrations/jobs/{job_id}` cancels a job only while queued.
- Responses are `private, no-store`. On parent or book deletion, related
  records disappear via foreign key cascades.

Migration: `backend/migrations/007_private_illustration_jobs.sql`. Use a
**dedicated WonderTale test PostgreSQL database**, never a shared project DB.

## Visual continuity prototype

`illustration_planning.py` can construct deterministic, safe, original
visual briefs. For the same book ID, every page has the same fictional
character outfit and appearance. It uses curated scenes and does not include
the child's name, photos, story text or parent identifiers in the prompt.
The briefs are **generic**, not yet scene-accurate illustrations of the story.
No prompt is transmitted externally.

## Private PNG pilot storage (code only)

A limited, **database-backed** image asset path is now implemented.
`backend/private_illustration_media.py` accepts decoded PNG/JPEG/WebP input
from an internal trusted caller, checks the file size and pixel dimensions,
and re-encodes pixels as a metadata-free PNG (at most 3 MB, 2048 pixels per
edge, 4 million pixels total). It does not call an image provider or perform
content moderation.

The trusted worker-only Python function
`save_private_illustration_asset(job_id, image_bytes)` accepts media
**only for an already-claimed `processing` illustration job**. It stores
sanitized bytes and a SHA-256 checksum in the database in the same transaction
as marking the job completed. There is **no public upload route**.

`GET /api/illustrations/media/{job_id}` requires the parent's bearer token
and verifies both the completed job and exact book ownership before returning
PNG bytes with `Cache-Control: private, no-store`. A wrong owner gets 404.
On book or account deletion, database foreign-key cascades delete the image
bytes. Migration: `008_private_illustration_assets.sql`.

This is a **small-pilot engineering foundation**, not a scalable media
service. The private database must be encrypted, access controlled and
backed up appropriately. Larger workloads should move binary data into
private object storage with short-lived, owner-validated access. The
actual image generation worker, content safety/moderation, spending
limits, parental consent review and production delivery remain unfinished.

## Quota-gated worker foundation (not active)

`illustration_worker.process_one_illustration_job` can claim **one** queued
illustration from the private DB. This Python function is not called by any
HTTP route or scheduled task and has **no real provider adapter**.

It runs only if **both** `ENABLE_AI_ILLUSTRATIONS=true` and
`ENABLE_AI_ILLUSTRATIONS_WORKER=true` are configured. Without positive
integer caps in `MAX_ILLUSTRATIONS_PER_DAY` and
`MAX_PARENT_ILLUSTRATIONS_PER_DAY` it refuses to start. Caps are clamped
to at most 10 for this pilot foundation and default to **zero**.

The worker requires three explicitly injected, trusted callbacks:
`moderator(prompt)->bool`, `renderer(prompt)->bytes`, and
`image_moderator(bytes)->bool`. It checks both the pilot email allowlist and
book ownership *again at claim time*, atomically reserves the daily global
and per-parent count, and calls the callbacks only after committing the claim.
The prompt is an **original generic fictional scene**, with no page text,
child name, email or other personally identifying information. A failed
moderation result never publishes an image. Renderer errors and uncertain
attempts are terminal; no automatic paid retries or quota refunds.

This is **not verified provider-side billing protection** or a production
content safety system. Actual text and image moderation services must be
implemented, evaluated and monitored independently; any uncertain provider
call requires human reconciliation before a deliberate new attempt. Quota
rows are persistent and consume quota even if a renderer crashes.

Migration: `009_illustration_daily_quotas.sql`. Tests inject synthetic PNG
bytes and mock moderation, and never contact an AI provider.

## OpenAI Images adapter (isolated, not deployed)

`backend/openai_illustration_provider.py` now contains a validated adapter for
OpenAI Images API using the pilot model `gpt-image-1.5`, 1024×1024 PNG,
one output per invocation, no automatic retries, and a 90-second client
deadline. It accepts only the original curated fictional briefs from
`illustration_planning.py`. Provider output is a single base64-encoded image,
decoded with strict size/type checks, sanitized and metadata-stripped before
the caller may persist it. The adapter does **not** log a child's name,
private story text, API key, prompts, provider outputs or decoded images.

Three environment switches must all be enabled:
`ENABLE_AI_ILLUSTRATIONS=true`,
`ENABLE_AI_ILLUSTRATIONS_WORKER=true`, and
`ENABLE_OPENAI_IMAGE_PROVIDER=true`. The last flag defaults to **false**
and this adapter refuses `APP_ENV=production`. The pilot model cannot be
changed by simply editing `OPENAI_IMAGE_MODEL` in runtime configuration.
Calls require a server-side `OPENAI_API_KEY`; do not supply that key to Vite.

**The adapter is not attached to an automatic runner, HTTP route or
scheduled job**. A human-reviewed, independently working prompt-safety
reviewer and **output-image safety reviewer** must be connected to the
existing `process_one_illustration_job` worker before a real request is
permitted. A mock callback returning `True` is sufficient for tests
**only**, not live child-facing generation. The adapter does not implement
provider-side content moderation, cost estimation, provider idempotency or
billing reconciliation.

A full live pilot also needs parental consent, approved text/image safety
policy, budget alerts, a controlled worker host, and verification that the
intended model/account permissions are available. No provider requests are
performed by CI or by importing this module.

## Release blockers

1. Review the parental agreement and data-processing obligations for minors.
2. Build a non-public binary/media store with access-controlled delivery,
   provider asset validation, checksums, maximum dimensions/file sizes,
   malware and safety review, and account deletion cleanup.
3. Use a separate trusted worker with explicit spending ceilings and a
   provider-specific idempotency and crash-reconciliation strategy.
4. Decide how a private book's actual scenes can be illustrated without
   unnecessarily transmitting identifying child information.
5. Persist media identifiers only after validation. Never accept arbitrary
   user-provided storage keys or third-party image URLs.
6. Add consent revocation, monitoring, retention windows, and integration
   tests against a disposable isolated database before any Preview rollout.

All existing tests use local databases, and illustration planning tests
run with no provider network calls.
