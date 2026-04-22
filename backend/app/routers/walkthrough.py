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
from app.services.todo_item import create_todos_from_walkthrough

router = APIRouter(prefix="/walkthroughs", tags=["walkthroughs"])
MODEL = "gpt-5.4-mini"


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

    # Update statuses and notes for base checklist items
    base_updates = {r["id"]: r for r in llm_result.get("base_items", [])}
    for item in current_item_list:
        if item.get("checklist_item_id") in base_updates:
            update = base_updates[item["checklist_item_id"]]
            item["status"] = update["status"]
            item["notes"] = update.get("notes")

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
    
    # Step 1: Extract items from transcript 
    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content":
                    '''You are a property inspector. Given a transcript you need to sort out items have gotten inspected and their action items if any. If there are no action items you should just use the word "checked". If there are multiple action items for the same thing, list them comma-separated.

                        Example:
                        Transcript: "OK Checking the windows here they look good the fridge has a little dent let's fix that the deck looks good the lights needle new lightbulb and the washer dryer needs to be replaced also the AC unit unit needs a new air filter"

                        Would result in:
                        Windows: checked
                        Fridge: take care of little dent
                        Deck: checked
                        Lights: need new lightbulb
                        Washer/Dryer: replace
                        AC: new air filter

                        Example with multiple actions:
                        Transcript: "The windows need to be repainted and also need insulation. The deck needs re-staining and some boards replaced."

                        Would result in:
                        Windows: re-paint, insulate
                        Deck: re-stain, replace boards

                        Return the results in a JSON object with the following format:
                        {
                            "windows": "checked",
                            "fridge": "take care of little dent",
                            "deck": "checked",
                            "lights": "need new lightbulb",
                            "washer/dryer": "replace",
                            "ac": "new air filter"
                        }
                        ''',
            },
            {
                "role": "user",
                "content": f"Transcript:\n{transcript_text}",
            },
        ],
    )

    transcript_items = json.loads(response.choices[0].message.content)

    # Step 2: compare items to base and return structured result
    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": f'''{checklist_section}

                    You will be given inspected items from a transcript. Match them against the base checklist and return a JSON object with this exact format:
                    {{
                        "base_items": [{{"id": "<checklist_item_id>", "status": "checked or unchecked", "notes": "<comma-separated action descriptions or null>"}}],
                        "action_items": [{{"name": "<item name>", "todo": "<comma-separated action descriptions or null>"}}]
                    }}

                    Rules:
                    - base_items: include ALL base checklist items using their exact id. Use semantic/fuzzy matching — transcript items like "ac", "air conditioning", or "air conditioning unit" should all match a base item named "ac unit". Set status to "checked" if found in transcript items, otherwise "unchecked". Set notes to a comma-separated list of action descriptions if there are any, otherwise null.
                    - action_items: only include transcript items that do NOT semantically match any base checklist item. Set todo to a comma-separated list of action descriptions, or null if the item was just checked.
                    ''',
            },
            {
                "role": "user",
                "content": f"Transcript items:\n{json.dumps(transcript_items, indent=2)}",
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

    create_todos_from_walkthrough(walkthrough_id, db)

    return doc_to_walkthrough(doc_ref.get())
