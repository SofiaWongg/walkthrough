from datetime import datetime
from pydantic import BaseModel
from app.models.base_checklist import BaseChecklist
from app.models.walkthrough import WalkthroughSummary


class Property(BaseModel):
    id: str
    name: str
    base_checklist_id: str | None = None
    created_at: datetime
    updated_at: datetime


class PropertyCreate(BaseModel):
    name: str

# This avoids multiple firebase calls
class PropertyDetail(Property):
    walkthroughs: list[WalkthroughSummary] = []
    base_checklist: BaseChecklist | None = None
