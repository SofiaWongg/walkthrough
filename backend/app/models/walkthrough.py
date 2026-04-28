from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from app.models.walkthrough_item import WalkthroughItem


class TranscriptChunk(BaseModel):
    chunk: str


class WalkthroughImage(BaseModel):
    id: str
    timestamp_taken: datetime
    transcript_index: int  # number of transcript chunks at upload time, used to find surrounding context
    walkthrough_item_id: str | None = None
    storage_url: str
    vision_description: str | None = None


class WalkthroughStatus(str, Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Walkthrough(BaseModel):
    id: str
    property_id: str
    item_list: list[WalkthroughItem] = []
    images: dict[str, WalkthroughImage] = {}
    status: WalkthroughStatus = WalkthroughStatus.active
    transcript: list[TranscriptChunk] = []
    created_at: datetime
    updated_at: datetime


class WalkthroughCreate(BaseModel):
    property_id: str


class WalkthroughSummary(BaseModel):
    id: str
    status: WalkthroughStatus
    created_at: datetime
    updated_at: datetime
