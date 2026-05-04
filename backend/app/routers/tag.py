from fastapi import APIRouter, HTTPException
from app.firebase import get_db
from app.models.tag import TagCreate
from app.services.tag import get_tag_list, set_tag_list, remove_tag_everywhere

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=list[str])
def list_tags():
    return get_tag_list()


@router.post("/", response_model=list[str], status_code=201)
def create_tag(body: TagCreate):
    db = get_db()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")
    tags = get_tag_list(db)
    if name in tags:
        raise HTTPException(status_code=409, detail="Tag already exists")
    tags.append(name)
    set_tag_list(tags, db)
    return tags


@router.delete("/{tag_name}", response_model=list[str])
def delete_tag(tag_name: str):
    tags = get_tag_list()
    if tag_name not in tags:
        raise HTTPException(status_code=404, detail="Tag not found")
    remove_tag_everywhere(tag_name)
    return get_tag_list()
