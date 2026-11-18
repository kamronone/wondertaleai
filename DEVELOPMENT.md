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


## 18 November 2026 — ordered feature delivery and integration gates

Requested product: private personalized books, familiar classic stories, several child protagonists, narrated bedtime stories, interactive stories, printed books/PDF, child profiles, favorites, family library, daily episodes, gifts, AI video, and paid plans.

Implemented in this working branch:
- Browser-only demos: 30 illustrated classics, original templates in Russian/Uzbek/English; optional local persistence; PDF print of all pages; browser speech-synthesis read-aloud with voice availability depending on device; favorite flag; saved reading position; extra protagonist name; four occasion prompts; page text editing; two predefined ending variants; local sequels with eight new pages.
- Private FastAPI (NOT exposed to public site): parent-bound books and sessions; logout everywhere; password change; login throttling; opt-in bounded AI story requests; dedicated schema/migrations for up to five child nicknames, favorite IDs, reading progress. Parent email verification and full account onboarding are NOT implemented.
- Text-generation adapter now supports 8/12/20 pages and up to three additional named heroes with typed validation. It remains disabled by default and is not connected to the public frontend.
- Only the static frontend has been deployed to the public Vercel preview.

Remaining high-priority requirements, in dependency order:
1. Provision an isolated Neon PostgreSQL database for WonderTale. Direct Neon creation is blocked because the available organization is Vercel-managed. Do not use another app's project or credentials.
2. Authenticated parent onboarding with verified emails, recovery, real account/sync UX, parental approvals, and production abuse controls.
3. Private image/media storage and consent-aware handling of children's photographs; retention/deletion controls, verified parental rights and privacy/legal review. Do NOT upload children's photos to the public PWA's unverified backend.
4. Real child-consistent illustrated pages using a reviewed model/provider and quality/regeneration pipeline, async jobs, moderation and billing limits.
5. Real AI text/story generator integration; backend requires protected `AUTH_SECRET`, `DATABASE_URL`, and `OPENAI_API_KEY` plus explicit flags and pilot allowlist.
6. Better editor/print-grade PDF, natural neural speech synthesis and optionally parent-provided voice with documented consent and revocation. Current speech uses *device speechSynthesis*, not cloud voices.
7. Interactive multi-path story engine and generation jobs, educational stories, birthday campaigns, collaborative sharing and daily scheduled stories. Current interactions are LOCAL templates, not AI.
8. Provider-verified billing for real payments, idempotent webhooks, refunds, plan enforcement and cost dashboards. No real checkout or subscription is connected.
9. Video/storyboard pipeline, provider connection, moderation, asset retention, queue workers, MP4 export and safe playback. AI cartoons remain a coming-soon card.

Testing: Vercel TypeScript / Vite build runs for each frontend deployment. Python regression tests were added for backend paths but have not been executed in this environment. Do not claim backend production readiness without running tests and provider integrations.


## Parent email confirmation and recovery (private API only)

Added `backend/email_auth.py` and migration `backend/migrations/003_verified_email.sql`.

New API routes:
- `POST /api/auth/register` returns `{"status":"verification_sent"}` when `REQUIRE_EMAIL_VERIFICATION=true` and sends a one-time link; no bearer token is granted until verification. Registration remains disabled by `ENABLE_REGISTRATION=false` unless an operator explicitly enables it.
- `POST /api/auth/verify-email` with `{"token":"..."}` confirms the parent's email and consumes the token.
- `POST /api/auth/resend-verification` with `{"email":"..."}` asks for another verification message, with a throttled and non-enumerating response.
- `POST /api/auth/forgot-password` with `{"email":"..."}` requests a recovery message.
- `POST /api/auth/reset-password` with `{"token":"...","new_password":"..."}` changes the password and revokes previous sessions.

Controls: 256-bit tokens; only HMAC-SHA256 token digests stored; 30-minute expiry; single-use database updates; max one message per 120 seconds per parent per action and max ten per day; no tokens returned in HTTP responses. Email content uses an operator-configured HTTPS application origin. SMTP secrets are server-only.

Important integration blockers:
- A dedicated Neon database is not available through the connected Vercel-managed Neon organization; **no migrations were applied to any existing project**.
- SMTP provider/credentials and a verified sending domain have not been configured. The static frontend includes RU/UZ/EN reset/confirmation screens, but VITE_API_BASE is unset. With no backend configured, these screens correctly show an unavailable message.
- Until those prerequisites are met, public registration and text AI must remain disabled.
- Existing test suite uses `REQUIRE_EMAIL_VERIFICATION=false` in its isolated test environment only. Email-specific test cases verify the new token and reset flow without sending actual messages. Tests were committed but not run end-to-end against the repository in this session.
- Do not send children's photos to external AI providers or enable real payment methods until privacy/legal, retention, parental verification and provider reviews are complete.

### Email links and test status
- Email links use `https://<PUBLIC_APP_ORIGIN>/#verify=<token>` or `/#recover=<token>`. The token is in the URL fragment, not an HTTP path/query; React removes the fragment from browser history when it opens the relevant screen.
- `frontend/src/AccountAction.tsx` posts the token to the private API only when `VITE_API_BASE` is explicitly set. No backend secrets belong in Vite. The public static preview remains functional without a backend.
- `backend/tests/test_email_auth.py` mocks SMTP and checks HTTPS-origin validation and token handling. `backend/tests/test_secure_api.py` tests confirmation and password recovery with mocked mail delivery.
- Frontend TypeScript + Vite build passed in Vercel staging. Python tests still require running in a provisioned runtime; no live SMTP delivery was performed.


## Parent account UI and controlled private-library transfer

- New `frontend/src/ParentAccount.tsx` adds a four-tab mobile navigation entry for an accessible parent account page in RU/UZ/EN.
- When `VITE_API_BASE` is empty (current public preview), it shows a truthful unavailable state. It does not pretend to create or authenticate a family account.
- With a reviewed, secured `VITE_API_BASE` configured, the page offers parent login, registration requesting email verification and a recovery-link flow. Bearer tokens are held in React memory, not `localStorage` or the PWA cache; page refresh requires a new login. The existing verification/recovery link screens use URL fragments and explicit POST requests.
- The secure server's existing `GET /api/books` and `POST /api/books` are used by `frontend/src/private_library.ts` for a **parent-initiated** transfer only. It uploads only saved-on-device demo book text and first names, no uploaded photos, browser data URIs or arbitrary external media. Original local book IDs are included as a source identifier for deduplication.
- Remote books appear alongside local books only while authenticated, and are removed from the browser state on logout. This is an initial transfer flow, not real-time bidirectional conflict resolution.
- New public app must continue generating local demo stories until real protected AI endpoints, parent consent and private media storage are ready. `/api/health` must not be interpreted as permission to upload child photos.
- 30 classic covers and the PWA remain present in Vercel staging. No private FastAPI, Neon or SMTP credentials were deployed.

Pending: run Python backend security tests, provision a dedicated database, verified SMTP, secure HTTPS API hosting and complete account synchronization. Do not activate registration or external child-photo upload in this configuration.


## Neon integration verified — 2026-11-18

Vercel project `wondertaleai-preview` (team `kamronone`) is attached to its own Neon marketplace store `neon-fuchsia-xylophone`, Neon project `sparkling-wind-90682745`. Secrets are Vercel-sensitive and prefixed `WONDERTALE_DB_` in Preview and Production; **do not include these values in client-side Vite variables**.

Created isolated Neon branch `wondertale-preview` (id `br-young-darkness-bbiaw8n5`, parent `main`). Successfully applied the 15 idempotent SQL statements from:
- `backend/migrations/001_private_foundation.sql`
- `backend/migrations/002_family_reading.sql`
- `backend/migrations/003_verified_email.sql`

Verified via Neon SQL and schema listing that these eleven tables exist on `wondertale-preview` in schema `public`: `parents`, `sessions`, `books`, `login_attempts`, `generation_quota`, `generation_global_quota`, `children`, `book_favorites`, `reading_progress`, `parent_email_status`, `email_action_tokens`.

**Integration caveats:** The Vercel marketplace variables were created for Preview/Production, but their target Neon branch was not verified or changed. Do not assume their credentials point to `wondertale-preview`. Before deploying the secure FastAPI backend, explicitly select this branch's connection string through the server-side secret manager and set `APP_ENV=preview`. The backend reads `DATABASE_URL`, `WONDERTALE_DB_DATABASE_URL`, or `WONDERTALE_DB_POSTGRES_URL` and refuses a local SQLite fallback outside development. The current Vercel project is still a static Vite frontend; there is no FastAPI service deployment or confirmed SMTP provider. `ENABLE_REGISTRATION` and `ENABLE_TEXT_AI` must remain disabled until live auth, migrations and SMTP are verified.

The default Neon branch `main` and tables under `neon_auth` were not modified. No children's data was migrated from browsers into this database.


## Private FastAPI deployment verified — 2026-11-18

A standalone Vercel project `wondertaleai-api-preview` (Vercel ID `prj_bJm3Fu2CyvN3GyrDsma26kJihRLO`) now hosts `backend/app.py` under the FastAPI framework. Its **Preview deployment** uses the dedicated Neon branch `wondertale-preview` from Neon project `sparkling-wind-90682745`; the branch connection URL is a sensitive Vercel environment variable named `DATABASE_URL`. Additional Preview-only environment settings:
- `APP_ENV=preview`
- `ENABLE_REGISTRATION=false`
- `REQUIRE_EMAIL_VERIFICATION=true`
- `ENABLE_TEXT_AI=false`
- `AUTH_SECRET`: cryptographically generated server-side credential, never put in client-side bundles
- `CORS_ORIGINS`: the WonderTale static frontend's canonical host

The API project has **Vercel Authentication for all deployments**. It was deliberately not connected to the public frontend: protected Preview deployment URLs are not directly consumable by an unauthenticated visitor. The first Vercel deployment of the new project was automatically assigned a Production target despite an attempted staging target. Production has no database or auth secret and remains fail-closed; Vercel Authentication also protects that target. **Do not treat that production deployment as an active backend.**

Verified remotely through authenticated Vercel-fetch:
- `GET /api/health` returned 200 and `{"ok":true}` on the Preview API.
- `GET /api/ready` returned 200 and `{"ok":true,"database":"connected"}` after a real `SELECT 1` against Neon.
- Anonymous `GET /api/books` and `/api/me` couldn't be validated at the FastAPI layer through protected deployment fetch: Vercel Authentication intercepted the requests. Must still test those API routes with HTTP-level integration tests after choosing the release architecture.
- Preview build and deployment reached `READY`. The current Preview URL is `https://wondertaleai-api-preview-g7pk426xb-kamronones-projects.vercel.app`.

Next required prerequisites for enabling parent accounts: configure verified SMTP delivery, run full backend tests, decide backend accessibility (protect the application using its own auth, CORS and rate limiting before removing Vercel Authentication), and configure the static frontend's `VITE_API_BASE` only after those gates pass. Private photo uploads, AI text costs, and real payments remain disabled.


## 2026-11-18 follow-up: private library progress and regression checks

The frontend's authenticated private library now requests `/api/books`, `/api/books/favorites` and `/api/books/progress` together. It displays favorite flags and last-read pages per parent, sends explicit favorite toggles and stores reader progress using the authenticated endpoints. The local browser demo behavior remains unchanged, and no children's photos are synchronized.

Validation performed:
- New frontend staging deployment `dpl_DGRFWybKXZcuwPkBKYWBLg9q6Bfd` passed TypeScript/Vite and returned Vercel `READY`.
- Python sources and tests (`secure_main.py`, `ai_generation.py`, `email_auth.py`, and three pytest modules) were copied to a network-restricted temporary Vercel Sandbox and passed `python -m compileall` (exit 0).
- Full Python pytest execution was attempted, but PyPI dependencies were unavailable due to the Sandbox's outbound DNS/network restrictions. No claims are made that the Python suite passed. Temporary Sandbox was deleted immediately after syntax validation.
- The private FastAPI staging URL remains behind Vercel Authentication; registration remains disabled until verified email/SMTP and a full authenticated route test are completed.
- Do not set `VITE_API_BASE` to the protected API until the secure public-auth deployment architecture has been reviewed and tested.


## API storage quota hardening — 2026-11-18

- `POST /api/books` now rejects blank title, child name, and story, and caps each parent at 100 stored books.
- Concurrent writes are serialized within each parent: PostgreSQL obtains `SELECT ... FOR UPDATE` on the parent's row before counting books and inserting, while SQLite test mode uses `BEGIN IMMEDIATE`. This avoids basic simultaneous-request over-quota races and keeps unrelated parents isolated.
- Added test cases for quota enforcement, validation and independence between two parent identities in `backend/tests/test_secure_api.py`.
- Deployed private FastAPI Preview as `dpl_9L8Ci8KDqLb4MqydrR6YrrKndNVx`. Vercel reported `READY`; `GET /api/ready` returned HTTP 200 and `{"ok":true,"database":"connected"}`.
- No registration, SMTP, external AI provider, or photo uploads were enabled.
- The full Python test suite has **not** passed yet. An earlier restricted Vercel Sandbox could stage source and compile Python, but could not download pip dependencies due to DNS/network restrictions. This deploy validates build/startup/database readiness only, not application-wide correctness.
- Authenticated two-parent isolation, concurrent quota tests, and user-facing sync should be verified against an isolated test database after SMTP/onboarding and a supported backend test runner are configured. The existing public Vite app still operates in demo mode.


## Verified backend pytest run — 18 November 2026

A temporary isolated Vercel Sandbox (`wondertale-pytest-validation`) was created for a real test run; the test source was copied from GitHub `preview/standalone-demo`. Only local SQLite test files and mocked email/AI providers were used, not the live Neon branch or production service. Required test packages were successfully installed in this sandbox.

Command:
```bash
PYTHONPATH=/tmp/wondertale_test python -m pytest -q /tmp/wondertale_test/tests --tb=short
```

Initial run: **31 passed, 2 failed** due to incorrect test expectations (wrong-password login expected 422 instead of correct 401, and favorites cleanup expected a list instead of the API's `{"ids":[]}` response). The contract assertions were corrected in `backend/tests/test_secure_api.py`, not by weakening authentication or changing the API.

Repeated complete test run: **33 passed in 2.62 seconds** (exit code 0). This covers local API auth/session tests, user isolation, email verification/recovery with mocked SMTP, book quotas, and AI text validation with mocked provider. It does **not** establish verified live SMTP, production PostgreSQL test coverage, or real child-photo processing. No AI or registration feature flag was enabled.

The temporary test sandbox is disposable and should be removed after testing to avoid resource usage.


## Live Neon PostgreSQL integration checks — 18 November 2026

Created `backend/tests/test_postgres_integration.py` with explicit safety gates:
- `ALLOW_WONDERTALE_PG_INTEGRATION_TESTS=1`
- `PG_TEST_BRANCH_NAME=wondertale-preview`
- `PG_TEST_DATABASE_URL` provided securely at execution time from the **WonderTale-only** Neon branch `br-young-darkness-bbiaw8n5`, never committed.
- Test login and registration have local process-only flags; deployed Vercel API remains registration-disabled and protected with Vercel Authentication.
- Test data uses random `@example.com` synthetic emails. The module-scoped fixture and additional tests delete created parents in `finally`; database cascading FKs remove dependent books/sessions/children/tokens. Email delivery and AI requests are mocked/off.

Tests executed on real PostgreSQL via a temporary Vercel Sandbox with packages installed from PyPI. The first run revealed that `@example.invalid` addresses were refused by the Pydantic email validator; test names were adjusted to `@example.com`, with no change to production validation.

Final command in isolated sandbox:

```bash
PYTHONPATH=/tmp/wondertale_pg python -m pytest -q /tmp/wondertale_pg/tests/test_postgres_integration.py --tb=short
```

Results: **7 passed in 3.34 seconds** (one non-failing Starlette TestClient/httpx deprecation warning).
The scenarios cover:
1. Live DB health and readiness.
2. Two-parent book, favorites, reading progress and child-profile isolation.
3. Per-parent book quotas and blank text rejection.
4. Session revocation through PostgreSQL.
5. Rejection of verified signup without SMTP.
6. Single-use email verification and recovery token lifecycle, session revocation (SMTP mocked).
7. Two parallel book inserts with a parent quota of one: expected HTTP 201 and 409.

Neon SQL counts verified after the tests: `parents=0`, `books=0`, `sessions=0`, `children=0`, `book_favorites=0`, `reading_progress=0`, `email_action_tokens=0`. No real users or children's photos participated.

Backend tests are now verified across SQLite (33 passed) and dedicated Neon PostgreSQL (7 passed), but no live SMTP or real account frontend E2E test was performed. Remaining release gate: configure a verified email delivery provider, integrate protected API access with the public app, and test the full user flow.


## Email onboarding polish — 2026-11-18

- SMTP delivery supports **TLS-only** modes: port `465` via `smtplib.SMTP_SSL` and port `587` via `SMTP.starttls()` *before* authenticating. Port 25 and invalid values fail closed; no unencrypted fallback was added.
- `frontend/src/ParentAccount.tsx` now distinguishes unverified login (`403`) and presents a localized **resend confirmation email** action in RU/UZ/EN. Following registration, the parent can request another link. Server-side limits still apply: no more than one email per 120 seconds for a known parent/purpose and no more than ten in a day; unknown addresses receive the same generic acknowledgement.
- Regression coverage was extended for SMTP STARTTLS, plaintext port rejection, invalid SMTP configuration, and email-verification resend throttling.
- Vercel Sandbox pytest: **37 passed, one non-failing deprecation warning** (`pytest -q tests` on local SQLite + mocks).
- Updated protected FastAPI Preview: `dpl_GetiYohKTgJpj27rZCyoKDn3Zsa6`, `READY`, and `GET /api/ready` returned `200 {"ok":true,"database":"connected"}` against the isolated WonderTale Neon branch.
- Updated public static Vite Preview: `dpl_FVx2pXx4kdRCjcmeNXegeRHSHDHM`, `READY`, TypeScript/Vite build passed; existing demo app and 30 classic covers remain.
- No SMTP host, username, password, sender domain, or verified delivery service is configured on `wondertaleai-api-preview`. `ENABLE_REGISTRATION=false`, `ENABLE_TEXT_AI=false`, and full Vercel Authentication remain enforced. Do **not** expose signup to the public frontend until a sending provider, abuse-protection review, and actual email delivery checks are completed.
