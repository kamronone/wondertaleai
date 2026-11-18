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
