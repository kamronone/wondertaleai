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
