# Private AI illustration foundation

**Status: preparation only. No external image model, provider SDK call, media
upload, rendering worker, preview deployment, or billable request is enabled.**

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
