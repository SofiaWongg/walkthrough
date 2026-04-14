from pydantic import BaseModel


class ChecklistItem(BaseModel):
    id: str
    checklist_id: str
    name: str


class ChecklistItemCreate(BaseModel):
    name: str
