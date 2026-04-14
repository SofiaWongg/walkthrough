from datetime import datetime
from pydantic import BaseModel
from app.models.checklist_item import ChecklistItem


class BaseChecklist(BaseModel):
    id: str
    property_id: str
    item_list: list[ChecklistItem] = []
    created_at: datetime
    updated_at: datetime


class BaseChecklistCreate(BaseModel):
    property_id: str
