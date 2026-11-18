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
- Optional child photograph with parental consent (not stored)
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

The AI pilot currently generates **text only**; it never uploads children's photos or creates custom illustrations. It requires parent login and explicit mode selection. Generated stories are saved to owner-scoped PostgreSQL rows, in the private library's JSON page format. Story image references use a static fallback until private media storage is implemented.

Run local tests from the backend directory (with dependencies installed):

```bash
python -m pytest -q test_private_books_access.py test_generated_book_library.py
```

**Do not treat passing Vercel deployment status as security validation.** Before exposing the API to parents, run the full test suite, verify cross-account access on the deployed API, validate email verification flows, and confirm the actual Preview environment configuration. The frontend and backend deployment must remain separate from Production until those gates pass.
