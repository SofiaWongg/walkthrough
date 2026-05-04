from firebase_admin import firestore
from app.firebase import get_db

_COLLECTION = "config"
_DOCUMENT = "tags"


def get_tag_list(db=None) -> list[str]:
    if db is None:
        db = get_db()
    doc = db.collection(_COLLECTION).document(_DOCUMENT).get()
    if not doc.exists:
        return []
    return doc.to_dict().get("tag_list", [])


def set_tag_list(tags: list[str], db=None):
    if db is None:
        db = get_db()
    db.collection(_COLLECTION).document(_DOCUMENT).set({"tag_list": tags})


def remove_tag_everywhere(tag_name: str, db=None):
    """Remove a tag from the global list and from every todo item that has it."""
    if db is None:
        db = get_db()
    tags = get_tag_list(db)
    if tag_name in tags:
        tags.remove(tag_name)
        set_tag_list(tags, db)
    todos = db.collection("todo_items").where("tags", "array_contains", tag_name).get()
    for todo_doc in todos:
        todo_doc.reference.update({
            "tags": firestore.ArrayRemove([tag_name]),
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
