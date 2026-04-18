from app.models.property import Property
from app.models.base_checklist import BaseChecklist
from app.models.checklist_item import ChecklistItem


def doc_to_property(doc) -> Property:
    data = doc.to_dict()
    return Property(
        id=doc.id,
        name=data["name"],
        base_checklist_id=data.get("base_checklist_id"),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


def doc_to_base_checklist(doc) -> BaseChecklist:
    data = doc.to_dict()
    items = [
        ChecklistItem(id=i["id"], checklist_id=doc.id, name=i["name"])
        for i in data.get("item_list", [])
    ]
    return BaseChecklist(
        id=doc.id,
        property_id=data["property_id"],
        item_list=items,
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )