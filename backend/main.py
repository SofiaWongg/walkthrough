from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.firebase import initialize_firebase, get_db
from app.routers import property, walkthrough
from app.routers import todo_item
from app.routers import tag
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield


app = FastAPI(title="Walkthrough App API", version="1.0.0", lifespan=lifespan)

# This must be added so that we can hit the backend from the frontend. Nobody really understands cors. 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(property.router, prefix="/api")
app.include_router(walkthrough.router, prefix="/api")
app.include_router(todo_item.router, prefix="/api")
app.include_router(tag.router, prefix="/api")


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
