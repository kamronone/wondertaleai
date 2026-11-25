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

A standalone, **internal-only** portrait preprocessor now lives at `backend/private_photo_reference.py`. It validates JPEG/PNG/WebP inputs, applies EXIF orientation, strips EXIF/GPS/ICC metadata, resizes oversized images and returns a newly encoded JPEG **in memory only**. There is deliberately no public photo-upload API, image-provider call, facial identification, saved child portrait or enabled photo-based story generation. The preprocessor does not replace the required photo-specific parental consent, retention/deletion controls, rate limits, safety reviews or isolated image worker.

An isolated **image-edit prototype adapter** (`backend/private_reference_image_edits.py`) now supports the OpenAI image-edit API contract using a normalized reference photograph and fixed, non-personal scene and costume prompts. It is **not wired to any web route or illustration worker** and makes no calls during normal app use. The adapter requires local development mode, three explicit feature gates, an approved model (`gpt-image-2`) and a separate external-photo-transfer consent assertion from an operator. That assertion is not a substitute for a documented, persisted parental opt-in; the current `photo-reference-v1` consent must **not** be treated as permission to send children's pictures to an outside AI. No provider requests were sent as part of this implementation, and no image editing is enabled on Netlify Preview or Production. Offline tests inject fake provider responses and verify metadata removal and no charge retries. These controls still require a properly recorded, revocable external transfer consent, independent moderation and cost quota before real use.

The AI pilot currently generates **text only**; it never uploads children's photos or creates custom illustrations. It requires parent login and explicit mode selection. Generated stories are saved to owner-scoped PostgreSQL rows, in the private library's JSON page format. Story image references use a static fallback until private media storage is implemented.

Run local tests from the backend directory (with dependencies installed):

```bash
python -m pytest -q test_private_books_access.py test_generated_book_library.py
```

**Do not treat passing Vercel deployment status as security validation.** Before exposing the API to parents, run the full test suite, verify cross-account access on the deployed API, validate email verification flows, and confirm the actual Preview environment configuration. The frontend and backend deployment must remain separate from Production until those gates pass.
