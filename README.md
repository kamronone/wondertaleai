# WonderTale AI

Personalized children's storybooks. Mobile-first React + TypeScript and FastAPI.

## Start locally

Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (another terminal):
```bash
cd frontend
npm install
npm run dev
```

The default is **demo mode**, requiring no paid API key. Set `GENERATION_MODE=ai` and `OPENAI_API_KEY` on the backend to generate actual AI stories and image illustrations.

## Features

- Create personalized eight-page fairy tales with name, age, theme and parent prompt
- Photo-based personalized heroes are currently **unavailable** in the public wizard; no child image uploads are accepted by the secure API.
- Reader, local book library, downloadable PDF
- Demo art is decorative only and is not based on the child photograph
- Backend ready for replacing local SQLite with PostgreSQL and implementing a queued animation pipeline

**Not ready for public deployment**: This initial single-user demo has no authentication or per-parent authorization. Do not publish the backend or expose children's books over the internet until access controls, private media storage and data retention controls are implemented.

## Environment

Backend: `GENERATION_MODE=demo`, optional `OPENAI_API_KEY`, `CORS_ORIGINS=http://localhost:5173`, `DATA_DIR=./data`.
Frontend: `VITE_API_BASE=http://localhost:8000`.

Never put an API key in frontend code or commit an `.env` file.


## Secure parent-account preview (development branch)

The current React UI uses JSON endpoints from `backend/secure_main.py`, **not** the old multipart `backend/main.py` demo API. The old API's book routes are guarded by `BOOKS_ACCESS_TOKEN` as a temporary single-parent fail-closed protection, not multi-user authorization.

Required for a private preview of `secure_main.py`:

- `AUTH_SECRET`: random secret at least 32 characters long; never ship it in frontend variables.
- `DATABASE_URL`: dedicated PostgreSQL connection; `APP_ENV=preview`.
- `CORS_ORIGINS`: explicit trusted frontend origin(s).
- `VITE_API_BASE`: public API hostname, set in the frontend build environment only.
- `ENABLE_REGISTRATION`: enable only after verifying the email delivery configuration, account safety, and rate limits.
- `ENABLE_TEXT_AI=true`, `OPENAI_API_KEY`, `AI_ALLOWED_EMAILS`, and `MAX_AI_STORIES_PER_DAY`: optional, strictly limited AI pilot. Without these, AI mode must fail closed.

The secure backend also has a separate, **parent-authenticated** photo-reference permission: `GET/POST /api/photos/consent` with policy `photo-reference-v1`. This permission is distinct from illustration consent, defaults to false, can be revoked, and is deleted with the parent account. Responses explicitly set `photo_upload_enabled: false`. Granting consent **does not** upload, store, transform, or transmit photographs and does not enable photo generation. A **development-only** test endpoint `POST /api/photos/reference` is now available exclusively when `APP_ENV=development` and `ENABLE_DEV_PHOTO_UPLOAD=true`; it accepts raw `image/jpeg`, `image/png` or `image/webp` request bodies only after parent authentication and photo-specific consent. Its one-per-parent, normalized JPEG record expires after 15 minutes, is cleared on revocation or account deletion and can be removed with `DELETE /api/photos/reference`. `GET /api/photos/reference` returns metadata only, never image bytes. Expired records are deleted on access, not by a background scheduler. The endpoint is disabled in preview, staging and production even if the environment flag is accidentally set. It does not trigger image generation or send photos to AI. It additionally exposes `GET /api/photos/reference/preview` under exactly the same development-only gate and active parent consent. This endpoint renders an **offline visual filter preview** from the normalized reference JPEG and streams a private, uncached PNG to the same parent. It neither writes a preview to storage nor calls any external provider. **This is not AI image generation, character matching, or per-page storybook artwork.** The same strictly local photo gate also exposes `GET /api/photos/reference/pages/{page_number}?page_count=8` (or 12 or 20). It creates a temporary, uncached page mock-up: the exact same sanitized portrait appears inside an illustrated frame while backgrounds vary by page. Neither the portrait nor generated mock-ups are persisted or passed to a provider. **This is a photographic storyboard prototype, not a likeness-preserving AI character and not actual scene-aware illustration.**

Private book pages can now be previewed with `GET /api/photos/books/{book_id}/pages/{page_number}/preview`, available **only** in explicitly enabled local development. The backend verifies book ownership, current parent consent, an unexpired sanitized photo and image integrity. Local chapter matching selects from pre-reviewed scenes; the same portrait is shown in every page frame and scene backgrounds vary. Outputs are in-memory, uncached PNGs, never public assets. This is a scene-matched photographic mock-up, **not** an AI-edited likeness; it does not call any model, persist page images, or change frontend SVG fallback behavior. Other users cannot access a private book even when they have their own valid photo and consent.

A standalone, **internal-only** portrait preprocessor now lives at `backend/private_photo_reference.py`. It validates JPEG/PNG/WebP inputs, applies EXIF orientation, strips EXIF/GPS/ICC metadata, resizes oversized images and returns a newly encoded JPEG **in memory only**. There is deliberately no public photo-upload API, image-provider call, facial identification, saved child portrait or enabled photo-based story generation. The preprocessor does not replace the required photo-specific parental consent, retention/deletion controls, rate limits, safety reviews or isolated image worker.

A separate authenticated and revocable parent permission now exists for **potential external AI transfer of a child's photo**, at `GET/POST /api/photos/external-transfer-consent` (`photo-external-ai-v1`). An opt-in requires already-active local photo consent and `acknowledged_provider_transfer: true`; a revocation deletes the temporary portrait, and revoking local consent also revokes external consent. Responses explicitly state `external_photo_processing_enabled: false`. No photo-upload or model-call route reads this consent yet, and granting it alone never sends a photo to a provider. Parent-facing disclosure must still explain the actual provider, processing and retention before real activation.

A separate **disabled-by-default photo-edit budget reservation ledger** (`backend/photo_illustration_budget.py`) now tracks integer micro-USD estimates for a potential attempt, with independent per-parent and global daily ceilings. Explicit operator configuration requires `ENABLE_DEV_PHOTO_UPLOAD=true`, `ENABLE_PHOTO_BUDGET_RESERVATIONS=true`, `PHOTO_EDIT_ESTIMATE_MICRO_USD`, `PHOTO_EDIT_DAILY_PARENT_MICRO_USD` and `PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD`; it is restricted to local development. Reservation is atomic in SQLite/PostgreSQL, can happen at most once per request, rechecks current consents/reference/integrity and the persistent emergency stop, and never automatically refunds after cancellation. The global day total remains even after account deletion, preventing a deleted account from resetting the cap. **It is a conservative reservation estimate, not actual provider spend, payment authorization, approval to send child photographs, nor an AI invocation.** No route or worker calls it automatically, and the default configuration reserves nothing.

An additional **operator-only local mock-PNG worker** (`backend/photo_illustration_mock_worker.py`) exercises an entire no-provider pipeline: current owner/photo/consent checks, three injected independent local moderation functions, deterministic story-page mock rendering, and a final transactional permission recheck before storing a scrubbed PNG in a separate `photo_mock_assets` table. The authenticated `GET /api/photos/illustration-requests/{request_id}/mock-image` endpoint is available **only** with the existing local-development photo gate. Images expire with the reference, require current permissions and parent ownership, and are deleted when consent is revoked or the photo is replaced/deleted. The mock worker additionally requires `ENABLE_PHOTO_REVIEW_DRY_RUN=true` and `ENABLE_PHOTO_MOCK_STORAGE=true`; it never imports a provider SDK, calls an AI model, incurs charges, or writes to real `illustration_assets`. These are photographic scene mock-ups, not real personalized AI illustrations, and the public reader remains unaffected. Do not set these flags on shared servers.

An operator-invoked, **read-only dry-run checker** is available as `backend/photo_illustration_review.py`. It is not an HTTP endpoint or a running worker and requires `APP_ENV=development`, `ENABLE_DEV_PHOTO_UPLOAD=true`, and `ENABLE_PHOTO_REVIEW_DRY_RUN=true`. It re-reads the owner-scoped request, both active parental consents, correct book, unexpired image and matching SHA-256, uses local curated scene prompts, and requires independent injected local portrait/prompt moderation callbacks. It rechecks permissions and reference identity after moderation to detect revocation. It returns only a minimal boolean-style pass record, never photo bytes or the prompt. **No AI provider, payment, persistence, or background job is involved.** A passing dry run does not clear a request for production, certify a child image, or make an external image call safe. The next true worker will still require separately approved content moderation, a dedicated billable reservation ledger, transactional lifecycle, provider processing/retention review and proof of output safety.

A separate **development-only, review-only photo illustration queue** now has authenticated `POST/GET /api/photos/illustration-requests` and `DELETE /api/photos/illustration-requests/{request_id}` endpoints. It is unavailable unless the existing local photo-development gate is enabled, and it requires ownership of a valid 8/12/20-page book, both parental photo consents and a current sanitized portrait. At most two pending requests per parent are allowed. Records store only book/page/hero mode/style, a portrait digest and expiration, never image bytes, child names or story text. Revoking consent, replacing/deleting the portrait, or reaching expiration cancels pending requests. **No worker consumes these review records; no provider is called, no artwork is created, and no charge can occur.** The real AI pipeline must get independent moderation, quotas, consent checks at execution, and worker isolation before activation.

An isolated **image-edit prototype adapter** (`backend/private_reference_image_edits.py`) now supports the OpenAI image-edit API contract using a normalized reference photograph and fixed, non-personal scene and costume prompts. It is **not wired to any web route or illustration worker** and makes no calls during normal app use. The adapter requires local development mode, three explicit feature gates, an approved model (`gpt-image-2`) and a separate external-photo-transfer consent assertion from an operator. That assertion is not a substitute for a documented, persisted parental opt-in; the current `photo-reference-v1` consent must **not** be treated as permission to send children's pictures to an outside AI. No provider requests were sent as part of this implementation, and no image editing is enabled on Netlify Preview or Production. Offline tests inject fake provider responses and verify metadata removal and no charge retries. These controls still require a properly recorded, revocable external transfer consent, independent moderation and cost quota before real use.

The AI pilot currently generates **text only**; it never uploads children's photos or creates custom illustrations. It requires parent login and explicit mode selection. Generated stories are saved to owner-scoped PostgreSQL rows, in the private library's JSON page format. Story image references use a static fallback until private media storage is implemented.

Run local tests from the backend directory (with dependencies installed):

```bash
python -m pytest -q test_private_books_access.py test_generated_book_library.py
```

**Do not treat passing Vercel deployment status as security validation.** Before exposing the API to parents, run the full test suite, verify cross-account access on the deployed API, validate email verification flows, and confirm the actual Preview environment configuration. The frontend and backend deployment must remain separate from Production until those gates pass.
