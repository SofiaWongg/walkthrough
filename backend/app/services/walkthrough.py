import uuid
from fastapi import HTTPException
from google.cloud.firestore import DocumentReference
from app.firebase import get_db
from app.models.walkthrough import Walkthrough, WalkthroughImage, WalkthroughStatus
from app.models.walkthrough_item import WalkthroughItem, WalkthroughItemStatus
from app.models.checklist_item import ChecklistItem
from app.models.base_checklist import BaseChecklist


def get_active_walkthrough(walkthrough_id: str) -> tuple[DocumentReference, dict]:
    db = get_db()
    doc_ref = db.collection("walkthroughs").document(walkthrough_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    data = doc.to_dict()
    if data["status"] == WalkthroughStatus.completed:
        raise HTTPException(status_code=409, detail="Walkthrough already completed")
    if data["status"] == WalkthroughStatus.cancelled:
        raise HTTPException(status_code=409, detail="Walkthrough has been cancelled")
    return doc_ref, data


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
    images = {
        img_id: WalkthroughImage(**img_data)
        for img_id, img_data in data.get("images", {}).items()
    }
    return Walkthrough(
        id=doc.id,
        property_id=data["property_id"],
        item_list=items,
        images=images,
        status=WalkthroughStatus(data["status"]),
        transcript=transcript,
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )