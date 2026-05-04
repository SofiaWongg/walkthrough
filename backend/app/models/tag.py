from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
