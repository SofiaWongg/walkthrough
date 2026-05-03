from firebase_admin import firestore
from app.firebase import get_db
from app.models.todo_item import TodoItem, TodoItemPriority
from app.models.walkthrough_item import WalkthroughItemStatus


def doc_to_todo_item(doc) -> TodoItem:
    data = doc.to_dict()
    return TodoItem(
        id=doc.id,
        text=data["text"],
        is_completed=data["is_completed"],
        property_id=data.get("property_id"),
        walkthrough_item_id=data.get("walkthrough_item_id"),
        image_urls=data.get("image_urls", []),
        priority=TodoItemPriority(data["priority"]) if data.get("priority") else None,
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


def create_todos_from_walkthrough(walkthrough_id: str, db=None, image_urls_by_item_id: dict[str, list[str]] | None = None) -> list[TodoItem]:
    if db is None:
        db = get_db()
    if image_urls_by_item_id is None:
        image_urls_by_item_id = {}

    walkthrough_doc = db.collection("walkthroughs").document(walkthrough_id).get()
    walkthrough_data = walkthrough_doc.to_dict()
    all_items = walkthrough_data.get("item_list", [])

    items = [
        i for i in all_items
        if i.get("status") == WalkthroughItemStatus.unchecked or i.get("notes")
    ]

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
        actions = _parse_actions(item.get("notes"))
        texts = [f"{item['name']}: {action}" for action in actions] if actions else [item["name"]]
        print(f"image_urls_by_item_id: {image_urls_by_item_id}, ids: {item['id']}")
        urls = image_urls_by_item_id.get(item["id"], [])
        for text in texts:
            _, doc_ref = db.collection("todo_items").add({
                "text": text,
                "is_completed": False,
                "property_id": walkthrough_data.get("property_id"),
                "walkthrough_item_id": item["id"],
                "image_urls": urls,
                "priority": None,
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            })
            created.append(doc_to_todo_item(doc_ref.get()))

    return created


def _parse_actions(notes: str | None) -> list[str]:
    if not notes:
        return []
    return [a.strip() for a in notes.split(",") if a.strip()]
