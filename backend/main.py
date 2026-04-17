from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.firebase import initialize_firebase, get_db
from app.routers import properties, walkthroughs


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield


app = FastAPI(title="Walkthrough App API", version="1.0.0", lifespan=lifespan)

app.include_router(properties.router, prefix="/api")
app.include_router(walkthroughs.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Walkthrough App API"}


@app.get("/health")
async def health():
    try:
        db = get_db()
        db.collection("_health")
        return {"status": "ok", "firestore": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
