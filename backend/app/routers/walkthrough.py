import json
import uuid
from datetime import datetime
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from firebase_admin import firestore, storage
from openai import OpenAI
from app.firebase import get_db
from app.config import get_settings
from app.models.walkthrough import Walkthrough, WalkthroughCreate, WalkthroughImage, TranscriptChunk, WalkthroughStatus
from app.models.walkthrough_item import WalkthroughItemStatus
from app.services.walkthrough import get_active_walkthrough, save_walkthrough_as_base_checklist, doc_to_walkthrough

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
    doc_ref, data = get_active_walkthrough(walkthrough_id)
    db = get_db()

    updated_transcript = data.get("transcript", []) + [body.model_dump()]
    current_item_list = data.get("item_list", [])
    current_images = data.get("images", {})

    # Describe any images uploaded since the last chunk, using surrounding transcript as context
    current_images = _process_unprocessed_images(current_images, updated_transcript)

    # Build a map of checklist_item_id -> name from the base checklist
    base_items_map: dict[str, str] = {}
    prop_data = db.collection("properties").document(data["property_id"]).get().to_dict()
    if prop_data.get("base_checklist_id"):
        bc_doc = db.collection("base_checklists").document(prop_data["base_checklist_id"]).get()
        if bc_doc.exists:
            for item in bc_doc.to_dict().get("item_list", []):
                base_items_map[item["id"]] = item["name"]

    image_notes = [
        img["vision_description"]
        for img in current_images.values()
        if img.get("vision_description")
    ]

    llm_result = _evaluate_transcript(updated_transcript, base_items_map, image_notes)

    base_updates = {r["id"]: r for r in llm_result.get("base_items", [])}
    for item in current_item_list:
        if item.get("checklist_item_id") in base_updates:
            update = base_updates[item["checklist_item_id"]]
            item["status"] = update["status"]
            item["notes"] = update.get("notes")

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

    # Link any unlinked images to the best-matching walkthrough item
    image_links = _link_images_to_items(current_images, current_item_list)
    for img_id, item_id in image_links.items():
        if img_id in current_images:
            current_images[img_id]["walkthrough_item_id"] = item_id

    doc_ref.update({
        "transcript": updated_transcript,
        "item_list": current_item_list,
        "images": current_images,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_walkthrough(doc_ref.get())


@router.post("/{walkthrough_id}/images", response_model=Walkthrough)
async def upload_image(
    walkthrough_id: str,
    image: UploadFile = File(...),
    timestamp_taken: str = Form(...),
) -> Walkthrough:
    doc_ref, data = get_active_walkthrough(walkthrough_id)

    image_bytes = await image.read()
    image_id = str(uuid.uuid4())
    transcript = data.get("transcript", [])

    bucket = storage.bucket()
    blob = bucket.blob(f"walkthroughs/{walkthrough_id}/images/{image_id}")
    blob.upload_from_string(image_bytes, content_type=image.content_type or "image/jpeg")
    blob.make_public()

    image_obj = WalkthroughImage(
        id=image_id,
        timestamp_taken=datetime.fromisoformat(timestamp_taken),
        transcript_index=len(transcript),
        storage_url=blob.public_url,
    )

    current_images = data.get("images", {})
    current_images[image_id] = image_obj.model_dump(mode="json")

    doc_ref.update({
        "images": current_images,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_walkthrough(doc_ref.get())


def _process_unprocessed_images(images: dict[str, dict], transcript: list[dict]) -> dict[str, dict]:
    """Describe any images that haven't been processed yet, using surrounding transcript chunks as context."""
    for img in images.values():
        if img.get("vision_description"):
            continue
        idx = img.get("transcript_index", 0)
        surrounding = transcript[max(0, idx - 3):idx + 3]
        related_text = _extract_related_transcript_text(img["storage_url"], surrounding)
        img["vision_description"] = _describe_image(img["storage_url"], related_text)
    return images


def _extract_related_transcript_text(image_url: str, surrounding_chunks: list[dict]) -> str | None:
    if not surrounding_chunks:
        return None
    client = _get_openai_client()
    chunks_text = "\n".join(f"{i + 1}. {c['chunk']}" for i, c in enumerate(surrounding_chunks))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Here are transcript chunks from a property inspection:\n\n{chunks_text}\n\n"
                            "Which parts of this text relate to what is shown in this image? "
                            "Extract and return only the relevant text verbatim. "
                            "If nothing relates, return an empty string."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url},
                    },
                ],
            }
        ],
        max_tokens=300,
    )
    result = response.choices[0].message.content.strip()
    return result or None


def _describe_image(image_url: str, related_text: str | None) -> str:
    client = _get_openai_client()
    prompt = (
        "You are a property inspector. Describe what you see in this image in terms of "
        "property condition. Focus on any issues, damage, or items that need attention. "
        "Be concise and factual, as if narrating an inspection."
    )
    if related_text:
        prompt += f"\n\nThe following text from the inspection transcript may provide context:\n{related_text}"
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        max_tokens=300,
    )
    return response.choices[0].message.content


def _link_images_to_items(
    images: dict[str, dict],
    item_list: list[dict],
) -> dict[str, str | None]:
    """For each image without a manually set walkthrough_item_id, determine the best-matching item."""
    unlinked = {
        img_id: img
        for img_id, img in images.items()
        if not img.get("walkthrough_item_id")
    }
    if not unlinked or not item_list:
        return {}

    client = _get_openai_client()
    items_text = "\n".join(f"- id: {item['id']}, name: {item['name']}" for item in item_list)
    images_text = "\n".join(
        f"- image_id: {img_id}, description: {img.get('vision_description') or ''}"
        for img_id, img in unlinked.items()
        if img.get("vision_description")
    )
    if not images_text:
        return {}

    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": f"""You are a property inspector assistant. Match each image to the walkthrough item it most likely depicts using semantic matching.

Walkthrough items:
{items_text}

Return a JSON object mapping each image_id to the most relevant walkthrough item id, or null if no clear match exists:
{{"<image_id>": "<walkthrough_item_id_or_null>"}}

Only include image IDs that were provided.""",
            },
            {
                "role": "user",
                "content": f"Images:\n{images_text}",
            },
        ],
    )
    return json.loads(response.choices[0].message.content)


def _evaluate_transcript(transcript: list[TranscriptChunk], base_items: dict[str, str], image_notes: list[str]) -> dict:
    client = _get_openai_client()

    transcript_text = "\n".join([chunk["chunk"] for chunk in transcript])
    if image_notes:
        transcript_text += "\n\nImage observations:\n" + "\n".join(f"- {note}" for note in image_notes)
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
                    '''You are a property inspector. Given a transcript you need to sort out items have gotten inspected and their action items if any. If there are no action items you should just use the word "checked"

                        Example:
                        Transcript: "OK Checking the windows here they look good the fridge has a little dent let's fix that the deck looks good the lights needle new lightbulb and the washer dryer needs to be replaced also the AC unit unit needs a new air filter"

                        Would result in:
                        Windows: checked
                        Fridge: take care of little dent
                        Deck: checked
                        Lights: need new lightbulb
                        Washer/Dryer: replace
                        AC: new air filter

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
                        "base_items": [{{"id": "<checklist_item_id>", "status": "checked or unchecked", "notes": "<action description or null>"}}],
                        "action_items": [{{"name": "<item name>", "todo": "<action description or null>"}}]
                    }}

                    Rules:
                    - base_items: include ALL base checklist items using their exact id. Use semantic/fuzzy matching — transcript items like "ac", "air conditioning", or "air conditioning unit" should all match a base item named "ac unit". Set status to "checked" if found in transcript items, otherwise "unchecked". Set notes to the action description if there is one, otherwise null.
                    - action_items: only include transcript items that do NOT semantically match any base checklist item. Set todo to the action description, or null if the item was just checked.
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


@router.post("/{walkthrough_id}/cancel", response_model=Walkthrough)
def cancel_walkthrough(walkthrough_id: str):
    doc_ref, _ = get_active_walkthrough(walkthrough_id)

    doc_ref.update({
        "status": WalkthroughStatus.cancelled,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    return doc_to_walkthrough(doc_ref.get())


# This endpoint takes in a walkthrough object with the users final edits
@router.post("/{walkthrough_id}/end", response_model=Walkthrough)
def end_walkthrough(walkthrough_id: str, walkthrough: Walkthrough):
    doc_ref, data = get_active_walkthrough(walkthrough_id)
    db = get_db()

    current_images = _process_unprocessed_images(
        data.get("images", {}),
        data.get("transcript", []),
    )

    doc_ref.update({
        "status": WalkthroughStatus.completed,
        "item_list": [item.model_dump() for item in walkthrough.item_list],
        "images": current_images,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })

    # If user has no base checklist add this walkthrough as the base checklist
    property_doc = db.collection("properties").document(walkthrough.property_id).get()
    if property_doc.exists and not property_doc.to_dict().get("base_checklist_id"):
        save_walkthrough_as_base_checklist(walkthrough)

    return doc_to_walkthrough(doc_ref.get())
