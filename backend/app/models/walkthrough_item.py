from enum import Enum
from pydantic import BaseModel


class WalkthroughItemStatus(str, Enum):
    unchecked = "unchecked"
    checked = "checked"


class WalkthroughItem(BaseModel):
    id: str
    walkthrough_id: str
    name: str
    status: WalkthroughItemStatus = WalkthroughItemStatus.unchecked
    notes: str | None = None
    is_from_base: bool


class WalkthroughItemCreate(BaseModel):
    name: str
    is_from_base: bool = False
