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

### Build

In the backend repo use the command `docker build --platform linux/amd64 -t walkthrough-backend .` to build a new image. Must be amd64 because GCP Cloud Run doesn't allow arm compilers. This bilds a docker container locally.

docker tag walkthrough-backend:latest us-east1-docker.pkg.dev/walkthrough-3bd02/walkthrough/walkthrough-backend:latest. This points to the place we have images stored in the artifact registry. 

Then push to artifact registry with `docker push pkg.dev/walkthrough-3bd02/walkthrough/walkthrough-backend:latest`

After checking to make sure it is in the artifact registry go to google cloud run, to service details, and click 'edit & depploy new revision' -> Deploy


#### Troubleshooting 
Trouble authenticating?
Run `gcloud auth login`

