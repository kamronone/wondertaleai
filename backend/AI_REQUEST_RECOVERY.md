# WonderTale AI: Recoverable AI requests

The existing `POST /api/books/generate` remains a **synchronous, authenticated**
request. It is **not a background queue**, and no Vercel serverless function
should be assumed to keep working after its request times out.

## Client request contract

- The parent sends a random `Idempotency-Key` of 16–128 safe ASCII characters.
- Keys are scoped by the authenticated database owner ID and hash of the
  normalized story request; never derive a key from child names, email or prompts.
- A successful generation commits the private book and the key's book reference
  in one database transaction. Replaying the same key and request returns the
  saved book without another model call.
- A conflicting payload is rejected with HTTP 409. A currently pending key
  fails closed rather than dispatching another potentially billable request.
- `GET /api/books/generation-requests/{request_key}` is authenticated and
  owner-scoped. It returns `completed` with `book_id`, `processing` for a
  recent unfinished request, `needs_review` after 180 seconds, or
  `unavailable` if a previously generated book was deleted.
- Unknown keys return HTTP 404. Billing and generation endpoints send
  `Cache-Control: private, no-store`. Never place request keys in public
  analytics or logs.

## Recovery safety

A process can crash after sending a paid provider request but before committing
its book. Its pending key then stays unresolved. This is deliberate: the server
cannot know whether the provider charged for or completed the request. It must
**not automatically delete the key, refund quotas, or retry the provider** based
only on elapsed time. Mark the state `needs_review`, investigate usage and
logs, and reconcile it explicitly. Never infer provider billing status from
the presence of a local database row.

The current client holds its retry key only in volatile memory and loses it
after a browser restart. Durable, privacy-preserving recovery across device
restarts remains a separate feature.

## Real background queue still to implement

A separate durable job worker is required before claiming asynchronous AI
generation support. Minimum requirements:

1. Store an owner-scoped, validated job with a random opaque ID and explicit
   `queued → claimed → completed/failed/needs_review` states.
2. Serialize reservation and worker claim in PostgreSQL. Use a separate short
   lease and a stable provider idempotency strategy before allowing reclaims.
3. Store only the data the job needs; encrypt sensitive payloads, restrict
   access, define retention and delete/cancel semantics for parent data.
4. Run the worker in a supported non-request-bound execution environment with
   secret authentication, fixed provider deadlines and rate/cost ceilings.
5. Persist the book and mark job complete atomically; never credit a failed
   or uncertain provider call without reconciliation evidence.
6. Test SIGKILL, restart during API request, two workers, quota exhaustion,
   lost response, account deletion, cross-owner isolation, and key rotation.
7. Test on the isolated Preview database before enabling any live worker.
   Image/video generation requires its own media-storage and consent review.

Current GitHub CI uses mock provider responses and a throwaway PostgreSQL
container; no real AI provider or production account is accessed.
