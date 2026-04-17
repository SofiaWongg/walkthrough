from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from app.firebase import get_db
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

    # Fetch base checklist if one exists
    base_checklist = None
    if data.get("base_checklist_id"):
        bc_doc = db.collection("base_checklists").document(data["base_checklist_id"]).get()
        if bc_doc.exists:
            base_checklist = doc_to_base_checklist(bc_doc)

    # Fetch walkthroughs ordered by most recently updated
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


@router.get("/{property_id}/walkthroughs", response_model=list[WalkthroughSummary])
def get_walkthroughs(property_id: str):
    if not property_id:
        raise HTTPException(status_code=400, detail="Property ID is required")
    if not isinstance(property_id, str):
        raise HTTPException(status_code=400, detail="Property ID must be a string")
    db = get_db()
    docs = db.collection("walkthroughs").where("property_id", "==", property_id).stream()
    if not docs:
        raise HTTPException(status_code=404, detail="No walkthroughs found for this property")
    return [_doc_to_walkthrough_summary(doc) for doc in docs]


