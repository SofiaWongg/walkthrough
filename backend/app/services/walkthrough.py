import uuid
from fastapi import HTTPException
from app.firebase import get_db
from app.models.walkthrough import Walkthrough, WalkthroughStatus
from app.models.walkthrough_item import WalkthroughItem, WalkthroughItemStatus
from app.models.checklist_item import ChecklistItem
from app.models.base_checklist import BaseChecklist


def save_walkthrough_as_base_checklist(walkthrough: Walkthrough):
    db = get_db()

    property_doc = db.collection("properties").document(walkthrough.property_id).get()
    if not property_doc.exists:
        raise HTTPException(status_code=404, detail="Property not found")

    new_doc_ref = db.collection("base_checklists").document()
    base_checklist = _convert_walkthrough_to_base_checklist(walkthrough, new_doc_ref.id)
    new_doc_ref.set(base_checklist.model_dump())
    property_doc.reference.update({"base_checklist_id": new_doc_ref.id})

def _convert_walkthrough_to_base_checklist(walkthrough: Walkthrough, checklist_id: str) -> BaseChecklist:
    checklist_items = []
    for item in walkthrough.item_list:
        checklist_items.append(ChecklistItem(
            id=str(uuid.uuid4()),
            name=item.name,
            checklist_id=checklist_id,
        ))
    return BaseChecklist(
        id=walkthrough.id,
        property_id=walkthrough.property_id,
        item_list=checklist_items,
        created_at=walkthrough.created_at,
        updated_at=walkthrough.updated_at,
    )


def doc_to_walkthrough(doc) -> Walkthrough:
    data = doc.to_dict()
    items = [
        WalkthroughItem(
            id=i["id"],
            walkthrough_id=doc.id,
            checklist_item_id=i.get("checklist_item_id"),
            name=i["name"],
            status=WalkthroughItemStatus(i["status"]),
            notes=i.get("notes"),
            is_from_base=i["is_from_base"],
        )
        for i in data.get("item_list", [])
    ]
    raw_transcript = data.get("transcript", [])
    transcript = [
        c if isinstance(c, dict) else {"chunk": c}
        for c in raw_transcript
    ]
    return Walkthrough(
        id=doc.id,
        property_id=data["property_id"],
        item_list=items,
        status=WalkthroughStatus(data["status"]),
        transcript=transcript,
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )