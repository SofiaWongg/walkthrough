# Walkthrough App

Property inspection app with voice transcription and AI-powered checklist tracking.

## Prerequisites

- Python 3.10+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/)
- Chrome (speech recognition requires the Web Speech API)

## Backend

```bash
cd backend
cp .env.example .env   # set FIREBASE_CREDENTIALS_PATH and OPENAI_API_KEY
uv sync
uv run fastapi dev main.py
```

Runs at **http://127.0.0.1:8000**. API docs at **/docs**.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:5173**. API calls are proxied to the backend automatically — start the backend first.

> **Note:** Speech recognition only works in Chrome (Web Speech API).
