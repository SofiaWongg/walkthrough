from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class TodoItemPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TodoItem(BaseModel):
    id: str
    text: str
    is_completed: bool = False
    property_id: Optional[str] = None
    walkthrough_item_id: Optional[str] = None
    priority: Optional[TodoItemPriority] = None
    created_at: datetime
    updated_at: datetime


class TodoItemCreate(BaseModel):
    text: str
    property_id: Optional[str] = None
    walkthrough_item_id: Optional[str] = None
    priority: Optional[TodoItemPriority] = None


class TodoItemUpdate(BaseModel):
    text: Optional[str] = None
    is_completed: Optional[bool] = None
    priority: Optional[TodoItemPriority] = None


class BulkAddFromWalkthroughRequest(BaseModel):
    walkthrough_id: str
    walkthrough_item_ids: Optional[list[str]] = None  # if None, imports all items
