from app.firebase import get_db
from app.models.todo_item import TodoItem, TodoItemPriority


def doc_to_todo_item(doc) -> TodoItem:
    data = doc.to_dict()
    return TodoItem(
        id=doc.id,
        text=data["text"],
        is_completed=data["is_completed"],
        property_id=data.get("property_id"),
        walkthrough_item_id=data.get("walkthrough_item_id"),
        priority=TodoItemPriority(data["priority"]) if data.get("priority") else None,
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )
