from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from app.firebase import get_db
from app.models.todo_item import (
    TodoItem,
    TodoItemCreate,
    TodoItemUpdate,
    BulkAddFromWalkthroughRequest,
)
from app.services.todo_item import doc_to_todo_item

router = APIRouter(prefix="/todo_items", tags=["todo_items"])


@router.get("/", response_model=list[TodoItem])
def get_todo_items():
    db = get_db()
    docs = db.collection("todo_items").get()
    return [doc_to_todo_item(doc) for doc in docs]


@router.post("/", response_model=TodoItem, status_code=201)
def create_todo_item(body: TodoItemCreate):
    db = get_db()

    if body.property_id is not None:
        if not db.collection("properties").document(body.property_id).get().exists:
            raise HTTPException(status_code=404, detail="Property not found")

    _, doc_ref = db.collection("todo_items").add({
        "text": body.text,
        "is_completed": False,
        "property_id": body.property_id,
        "walkthrough_item_id": body.walkthrough_item_id,
        "priority": body.priority,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_todo_item(doc_ref.get())


@router.post("/bulk_from_walkthrough", response_model=list[TodoItem], status_code=201)
def bulk_add_from_walkthrough(body: BulkAddFromWalkthroughRequest):
    db = get_db()

    walkthrough_doc = db.collection("walkthroughs").document(body.walkthrough_id).get()
    if not walkthrough_doc.exists:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    walkthrough_data = walkthrough_doc.to_dict()
    items = walkthrough_data.get("item_list", [])

    if body.walkthrough_item_ids is not None:
        id_set = set(body.walkthrough_item_ids)
        items = [i for i in items if i["id"] in id_set]

    # Find walkthrough_item_ids already imported to avoid duplicates
    # Firestore "in" queries support up to 30 values; chunk if needed
    item_ids = [i["id"] for i in items]
    already_imported: set[str] = set()
    for chunk_start in range(0, len(item_ids), 30):
        chunk = item_ids[chunk_start:chunk_start + 30]
        existing = db.collection("todo_items").where("walkthrough_item_id", "in", chunk).get()
        already_imported.update(doc.to_dict()["walkthrough_item_id"] for doc in existing)

    created = []
    for item in items:
        if item["id"] in already_imported:
            continue
        _, doc_ref = db.collection("todo_items").add({
            "text": item["name"],
            "is_completed": False,
            "property_id": walkthrough_data.get("property_id"),
            "walkthrough_item_id": item["id"],
            "priority": None,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        created.append(doc_to_todo_item(doc_ref.get()))

    return created


@router.patch("/{item_id}", response_model=TodoItem)
def update_todo_item(item_id: str, body: TodoItemUpdate):
    db = get_db()

    doc_ref = db.collection("todo_items").document(item_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Todo item not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = firestore.SERVER_TIMESTAMP

    doc_ref.update(updates)
    return doc_to_todo_item(doc_ref.get())


@router.delete("/{item_id}", response_model=TodoItem)
def delete_todo_item(item_id: str):
    db = get_db()

    doc_ref = db.collection("todo_items").document(item_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Todo item not found")

    item = doc_to_todo_item(doc)
    doc_ref.delete()
    return item
