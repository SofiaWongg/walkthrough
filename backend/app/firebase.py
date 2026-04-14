import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client
from app.config import get_settings

_db: Client | None = None


def initialize_firebase() -> None:
    settings = get_settings()
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.firebase_credentials_path)
        firebase_admin.initialize_app(cred)
    global _db
    _db = firestore.client()


def get_db() -> Client:
    if _db is None:
        initialize_firebase()
    return _db
