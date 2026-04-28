import json
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client
from app.config import get_settings

_db: Client | None = None


def initialize_firebase() -> None:
    settings = get_settings()
    if not firebase_admin._apps:
        if settings.firebase_credentials_json:
            cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
        elif settings.firebase_credentials_path:
            cred = credentials.Certificate(settings.firebase_credentials_path)
        else:
            raise ValueError("Either FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH must be set")
        options = {}
        if settings.firebase_storage_bucket:
            options["storageBucket"] = settings.firebase_storage_bucket
        firebase_admin.initialize_app(cred, options or None)
    global _db
    _db = firestore.client()


def get_db() -> Client:
    if _db is None:
        initialize_firebase()
    return _db
