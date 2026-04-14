# Backend

FastAPI service for the walkthrough app.

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended; this repo includes `uv.lock`)

## Configuration

1. Copy the example env file and set your Firebase service account JSON path:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set `FIREBASE_CREDENTIALS_PATH` to the absolute path of your Firebase credentials file.

## Run locally

From this directory (`backend/`):

```bash
uv sync
uv run fastapi dev main.py
```

The API defaults to **http://127.0.0.1:8000**. Open **http://127.0.0.1:8000/docs** for the interactive OpenAPI UI.

### Alternative (without `fastapi` CLI)

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
