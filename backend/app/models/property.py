from datetime import datetime
from pydantic import BaseModel


class Property(BaseModel):
    id: str
    name: str
    base_checklist_id: str | None = None
    created_at: datetime
    updated_at: datetime


class PropertyCreate(BaseModel):
    name: str
