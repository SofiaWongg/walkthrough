import json
import uuid
from fastapi import APIRouter, HTTPException
from firebase_admin import firestore
from openai import OpenAI
from app.firebase import get_db
from app.config import get_settings
from app.models.walkthrough import Walkthrough, WalkthroughCreate, TranscriptChunk, WalkthroughStatus
from app.models.walkthrough_item import WalkthroughItemStatus
from app.services.walkthrough import save_walkthrough_as_base_checklist, doc_to_walkthrough

router = APIRouter(prefix="/walkthroughs", tags=["walkthroughs"])


def _get_openai_client() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)



@router.post("/", response_model=Walkthrough, status_code=201)
def start_walkthrough(body: WalkthroughCreate):
    db = get_db()

    prop_doc = db.collection("properties").document(body.property_id).get()
    if not prop_doc.exists:
        raise HTTPException(status_code=404, detail="Property not found")

    # Make sure that the property does not have an active walkthrough
    active_walkthrough = db.collection("walkthroughs").where("property_id", "==", body.property_id).where("status", "==", WalkthroughStatus.active).limit(1).get()
    if active_walkthrough:
        raise HTTPException(status_code=409, detail="A walkthrough is already active for this property")

    prop_data = prop_doc.to_dict()

    item_list = []
    if prop_data.get("base_checklist_id"):
        bc_doc = db.collection("base_checklists").document(prop_data["base_checklist_id"]).get()
        if bc_doc.exists:
            for item in bc_doc.to_dict().get("item_list", []):
                item_list.append({
                    "id": str(uuid.uuid4()),
                    "checklist_item_id": item["id"],
                    "name": item["name"],
                    "status": WalkthroughItemStatus.unchecked,
                    "notes": None,
                    "is_from_base": True,
                })

    _, doc_ref = db.collection("walkthroughs").add({
        "property_id": body.property_id,
        "status": WalkthroughStatus.active,
        "transcript": [],
        "item_list": item_list,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_walkthrough(doc_ref.get())


@router.get("/{walkthrough_id}", response_model=Walkthrough)
def get_walkthrough(walkthrough_id: str) -> Walkthrough:
    db = get_db()
    doc = db.collection("walkthroughs").document(walkthrough_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Walkthrough not found")
    return doc_to_walkthrough(doc)


@router.post("/{walkthrough_id}/transcript_chunk", response_model=Walkthrough)
def add_transcript_chunk(walkthrough_id: str, body: TranscriptChunk) -> Walkthrough:
    db = get_db()

    doc_ref = db.collection("walkthroughs").document(walkthrough_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    data = doc.to_dict()
    if data["status"] == WalkthroughStatus.completed:
        raise HTTPException(status_code=409, detail="Walkthrough already completed")

    updated_transcript = data.get("transcript", []) + [body.model_dump()]
    current_item_list = data.get("item_list", [])

    # Build a map of checklist_item_id -> name from the base checklist. This will be passed to the llm 
    base_items_map: dict[str, str] = {}
    prop_data = db.collection("properties").document(data["property_id"]).get().to_dict()
    if prop_data.get("base_checklist_id"):
        bc_doc = db.collection("base_checklists").document(prop_data["base_checklist_id"]).get()
        if bc_doc.exists:
            for item in bc_doc.to_dict().get("item_list", []):
                base_items_map[item["id"]] = item["name"]

    llm_result = _evaluate_transcript(updated_transcript, base_items_map)

    # Update statuses for base checklist items
    base_status_updates = {r["id"]: r["status"] for r in llm_result.get("base_items", [])}
    for item in current_item_list:
        if item.get("checklist_item_id") in base_status_updates:
            item["status"] = base_status_updates[item["checklist_item_id"]]

    # Upsert action items by name (case-insensitive) to avoid duplicates across chunks
    existing_names = {i["name"].lower() for i in current_item_list}
    for action_item in llm_result.get("action_items", []):
        if action_item["name"].lower() not in existing_names:
            current_item_list.append({
                "id": str(uuid.uuid4()),
                "checklist_item_id": None,
                "name": action_item["name"],
                "status": WalkthroughItemStatus.checked,
                "notes": action_item.get("todo"),
                "is_from_base": False,
            })
            existing_names.add(action_item["name"].lower())

    doc_ref.update({
        "transcript": updated_transcript,
        "item_list": current_item_list,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_walkthrough(doc_ref.get())


def _evaluate_transcript(transcript: list[TranscriptChunk], base_items: dict[str, str]) -> dict:
    client = _get_openai_client()

    transcript_text = "\n".join([chunk["chunk"] for chunk in transcript])
    if base_items:
        items_text = "\n".join(f"- id: {id}, name: {name}" for id, name in base_items.items())
        checklist_section = f"Base checklist:\n{items_text}"
    else:
        checklist_section = "Base checklist: none"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a property inspection assistant. Given an inspector's transcript (and optionally a base checklist), "
                    "extract all observed items and their action items.\n"
                    "Return a JSON object with:\n"
                    "- base_items: array of {\"id\": \"<checklist_item_id>\", \"status\": \"checked\" or \"unchecked\"} "
                    "for items in the base checklist. Empty array if no base checklist was provided.\n"
                    "- action_items: array of {\"name\": \"<item name>\", \"todo\": \"<short action description or null if no issue>\"} "
                    "for every item observed in the transcript that is NOT already in the base checklist. "
                    "Include items with no issues (set todo to null). All action items are considered checked."
                ),
            },
            {
                "role": "user",
                "content": f"{checklist_section}\n\nTranscript:\n{transcript_text}",
            },
        ],
    )
    return json.loads(response.choices[0].message.content)


@router.post("/{walkthrough_id}/validate_checklist", status_code=200)
def validate_checklist(walkthrough_id: str):
    pass


# This endpoint takes in a walkthrough object with the users final edits
@router.post("/{walkthrough_id}/end", response_model=Walkthrough)       
def end_walkthrough(walkthrough_id: str, walkthrough: Walkthrough):
    db = get_db()

    doc_ref = db.collection("walkthroughs").document(walkthrough_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Walkthrough not found")

    doc_ref.update({
        "status": WalkthroughStatus.completed,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "item_list": [item.model_dump() for item in walkthrough.item_list],
    })

    # If user has no base checklist add this walkthrough as the base checklist
    property_doc = db.collection("properties").document(walkthrough.property_id).get()
    if property_doc.exists and not property_doc.to_dict().get("base_checklist_id"):
        save_walkthrough_as_base_checklist(walkthrough)

    return doc_to_walkthrough(doc_ref.get())
