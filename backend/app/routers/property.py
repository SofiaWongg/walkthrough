import uuid
from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from app.firebase import get_db
from app.models.base_checklist import BaseChecklist
from app.models.checklist_item import ChecklistItemCreate
from app.models.property import Property, PropertyCreate, PropertyDetail
from app.models.walkthrough import WalkthroughSummary
from app.services.property import doc_to_property, doc_to_base_checklist

router = APIRouter(prefix="/properties", tags=["properties"])


def _doc_to_walkthrough_summary(doc) -> WalkthroughSummary:
    data = doc.to_dict()
    return WalkthroughSummary(
        id=doc.id,
        status=data["status"],
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


@router.post("/", response_model=Property, status_code=201)
def create_property(body: PropertyCreate):
    db = get_db()
    existing = db.collection("properties").where("name", "==", body.name).limit(1).get()
    if existing:
        raise HTTPException(status_code=409, detail="A property with that name already exists")
    _, doc_ref = db.collection("properties").add({
        "name": body.name,
        "base_checklist_id": None,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_property(doc_ref.get())


@router.get("/", response_model=list[Property])
def list_properties():
    db = get_db()
    docs = db.collection("properties").stream()
    return [doc_to_property(doc) for doc in docs]


@router.get("/{property_id}", response_model=PropertyDetail)
def get_property(property_id: str):
    db = get_db()

    doc = db.collection("properties").document(property_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Property not found")

    prop = doc_to_property(doc)
    data = doc.to_dict()

    base_checklist = None
    if data.get("base_checklist_id"):
        bc_doc = db.collection("base_checklists").document(data["base_checklist_id"]).get()
        if bc_doc.exists:
            base_checklist = doc_to_base_checklist(bc_doc)

    wt_docs = (
        db.collection("walkthroughs")
        .where("property_id", "==", property_id)
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .stream()
    )
    walkthroughs = [_doc_to_walkthrough_summary(doc) for doc in wt_docs]

    return PropertyDetail(
        **prop.model_dump(),
        walkthroughs=walkthroughs,
        base_checklist=base_checklist,
    )


@router.delete("/{property_id}")
def delete_property(property_id: str):
    db = get_db()
    doc_ref = db.collection("properties").document(property_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Property not found")
    doc_ref.delete()
    return {"message": f"Property {property_id} deleted successfully"}


@router.put("/{property_id}/base_checklist", response_model=BaseChecklist)
def upsert_base_checklist(property_id: str, items: list[ChecklistItemCreate]):
    db = get_db()
    prop_ref = db.collection("properties").document(property_id)
    prop_doc = prop_ref.get()
    if not prop_doc.exists:
        raise HTTPException(status_code=404, detail="Property not found")

    item_list = [{"id": str(uuid.uuid4()), "name": item.name} for item in items]

    existing_id = prop_doc.to_dict().get("base_checklist_id")
    if existing_id:
        bc_ref = db.collection("base_checklists").document(existing_id)
        bc_ref.update({"item_list": item_list, "updated_at": firestore.SERVER_TIMESTAMP})
        return doc_to_base_checklist(bc_ref.get())
    else:
        bc_ref = db.collection("base_checklists").document()
        bc_ref.set({
            "property_id": property_id,
            "item_list": item_list,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        prop_ref.update({"base_checklist_id": bc_ref.id})
        return doc_to_base_checklist(bc_ref.get())


@router.get("/{property_id}/walkthroughs", response_model=list[WalkthroughSummary])
def get_walkthroughs(property_id: str):
    if not property_id:
        raise HTTPException(status_code=400, detail="Property ID is required")
    db = get_db()
    docs = db.collection("walkthroughs").where("property_id", "==", property_id).stream()
    return [_doc_to_walkthrough_summary(doc) for doc in docs]
