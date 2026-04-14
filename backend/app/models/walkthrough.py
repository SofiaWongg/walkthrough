from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from app.models.walkthrough_item import WalkthroughItem


class WalkthroughStatus(str, Enum):
    active = "active"
    completed = "completed"


class Walkthrough(BaseModel):
    id: str
    property_id: str
    item_list: list[WalkthroughItem] = []
    status: WalkthroughStatus = WalkthroughStatus.active
    created_at: datetime
    updated_at: datetime


class WalkthroughCreate(BaseModel):
    property_id: str


class WalkthroughSummary(BaseModel):
    id: str
    status: WalkthroughStatus
    created_at: datetime
    updated_at: datetime
