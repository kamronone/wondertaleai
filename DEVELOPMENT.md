# WonderTale AI: development status

## Live private demo

Protected Vercel project: https://wondertaleai-preview-efbeqz82d-kamronones-projects.vercel.app

The deployed frontend is a **browser-only demo**. It generates template stories and decorative stars (not a child's portrait), and stores demo books in sessionStorage. It does not upload child photos or use AI generation. The "Save PDF" control uses the browser print dialog and currently prints the open reader page, not the entire book.

## Repository layout

- `frontend/` React + TypeScript + Vite, responsive book creator and reader
- `backend/main.py` original single-user prototype (unsafe for public exposure)
- `backend/secure_main.py` isolated prototype API with authentication and per-parent book ownership
- `backend/tests/test_secure_api.py` authentication and cross-account access regression tests

## Local frontend

```bash
cd frontend
npm install
npm run dev
```

## Secure backend (development only)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export AUTH_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export DATABASE_URL="sqlite:///./secure_dev.sqlite3"
uvicorn secure_main:app --host 127.0.0.1 --port 8000
```

Run tests from `backend/`:

```bash
pytest -q tests/test_secure_api.py
```

`DATABASE_URL` can point to a dedicated Neon PostgreSQL database. Do not reuse databases from other applications. Do not commit the connection URL or `AUTH_SECRET`.

## Security and production blockers

The secure API is **not production-ready**. Do not deploy it publicly until:
1. Verified parent email accounts and password reset
2. Brute-force / signup rate limiting and abuse monitoring
3. Authenticated media storage with signed, short-lived access
4. Asynchronous generation queue and error recovery
5. Private photo handling, retention limits and automatic deletion
6. Security testing, database migrations and backups
7. Provider safety filtering and spending limits for LLM / image / video generation
8. Legal review of child privacy, parental consent and regional data requirements

The secure API does not accept or persist child photographs; there is no media endpoint yet. It is not connected to the Vercel demo.

## Known deploy behavior

Vercel marked the initial source-file deployment as `production` even though it was requested as a preview. It is a separate isolated project with Vercel Authentication enabled. Do not disable protection.

## Planned video pipeline

Story -> scene script -> consistent character sheet -> keyframes -> approved video provider -> audio -> timeline -> private delivery. Rendering and media operations must be isolated in workers, never run inside request handlers.

## November 18 update — Classic tales, original art and AI foundation

- 30 public-domain-inspired story choices with Russian, Uzbek Latin and English titles.
- The first storybook cards now use original, programmatically drawn vector illustration scenes (SVG). This does not yet mean photo-realistic, AI-rendered artwork for each book.
- Local preview includes longer eight-page original adaptation text. These are *not* full published literary texts, and they should not be represented as exact translations of historical editions.
- `backend/ai_generation.py` adds eight-page structured AI story text validation and opt-in OpenAI Responses API integration.
- `backend/secure_main.py` exposes authenticated `POST /api/books/generate`, with a per-parent database quota of 2 per UTC day **only when** `ENABLE_TEXT_AI=true` and `OPENAI_API_KEY` exist. No image uploads are accepted.
- This backend remains disconnected from the public PWA and has **not** been deployed or live-tested against an AI provider. Frontend remains a local browser demo.
- Next: dedicated Neon DB, verified parental accounts, auth hardening and rate limiting, private child photo retention, secure media storage, async worker jobs, AI illustration consistency, complete PDF export and commercial review.

## November 18 — hardening for a controlled private backend pilot

The public WonderTale site is still a browser-only demo. The secure API is **not deployed**.

Additional controls in `backend/secure_main.py`:
- Account registration disabled by default (`ENABLE_REGISTRATION=false`); still **no verified-email flow**, so never enable open public signup.
- Password login: 5 failed attempts per normalized email per 15-minute window, stored by HMAC-hashed email, and cleared on a successful login.
- Text AI: default-off feature flag, explicit parent email allowlist (`AI_ALLOWED_EMAILS`), 2 successful reservations per parent per UTC day, plus a **global** daily reservation cap (`MAX_AI_STORIES_PER_DAY`, default 10, up to 200). SQLite reserves quotas under `BEGIN IMMEDIATE`; PostgreSQL uses atomic conditional upserts. Reserved quota is not returned on provider failure, deliberately reducing retry-based spending.
- Existing parent/child book isolation continues to use per-owner SQL filtering; account deletion cascades associated quota rows.
- Automated regression scenarios added for registration gating, login throttling, AI allowlist and global budget; **these tests are committed but not yet executed against the full repository in this session**.
- Manually validated the new quota SQL on isolated in-memory SQLite.

Important blockers **remain**: email confirmation and recovery, centralized IP/network abuse controls, account session management, private photo processing, asynchronous generation queue, storage, billing, secure deletion and jurisdictional/legal review for children's personal information. Do not deploy the secure API with `ENABLE_REGISTRATION=true` for the public.

## November 18 — account sessions and Neon preparation

- Added persistent session records for bearer tokens. Newly issued tokens contain a database-backed `sid`; revoked or expired sessions fail authorization. Legacy tokens without `sid` cease to work, intentionally requiring fresh login.
- New account endpoints: `POST /api/auth/logout`, `POST /api/auth/logout-all`, `GET /api/auth/sessions`, and `POST /api/auth/change-password`. Changing passwords revokes all old sessions and creates a new token.
- Added regression tests for session revocation, forged session identifiers and password change. Tests have not yet been run against the complete codebase.
- Added `backend/migrations/001_private_foundation.sql`, a non-destructive, idempotent schema for a **dedicated** WonderTale PostgreSQL database. No existing Neon project has been modified.
- Verified session create/read/revoke SQL on an isolated in-memory SQLite database, not against Neon.
- **Neon provisioning blocker:** the Neon integration returned `action restricted; organization is managed by Vercel` when attempting to create a dedicated `wondertale-ai-private` project. Do not reuse another application's Neon project/database. Create a dedicated database via the owning Vercel-managed integration or attach an independent writable Neon organization before deployment.
- Keep `ENABLE_REGISTRATION=false` and `ENABLE_TEXT_AI=false` until verified-email signup, global network abuse prevention, safe photo handling and private API hosting are validated.
- No change to the public Vercel demo deployment was needed for these backend-only updates.
