from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from app.firebase import get_db
from app.models.base_checklist import BaseChecklist
from app.services.property import doc_to_base_checklist

router = APIRouter(prefix="/checklists", tags=["checklists"])


@router.put("/{base_checklist_id}", response_model=BaseChecklist)
def update_checklist(base_checklist_id: str, new_base_checklist: BaseChecklist):
    db = get_db()
    doc_ref = db.collection("base_checklists").document(base_checklist_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Base checklist not found")

    doc_ref.update({
        "item_list": [item.model_dump() for item in new_base_checklist.item_list],
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_base_checklist(doc_ref.get())
