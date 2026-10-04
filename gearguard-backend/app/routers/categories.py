"""app/routers/categories.py"""
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from app.core.security import require, TokenData
from app.models.category import Category
from app.models.user import User
from app.services.audit import audit

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


def _out(c: Category) -> CategoryOut:
    return CategoryOut(id=str(c.id), name=c.name, description=c.description)


@router.get("/", response_model=List[CategoryOut])
async def list_categories(current: TokenData = Depends(require("admin", "manager", "technician", "user", "auditor"))):
    return [_out(c) for c in await Category.find_all().sort("name").to_list()]


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryIn, current: TokenData = Depends(require("admin", "manager"))):
    if await Category.find_one(Category.name == body.name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Category already exists")
    cat = Category(name=body.name, description=body.description)
    await cat.insert()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="category.created", entity_type="category",
                entity_id=str(cat.id), entity_label=cat.name)
    return _out(cat)


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(cat_id: str, current: TokenData = Depends(require("admin", "manager"))):
    cat = await Category.get(PydanticObjectId(cat_id))
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="category.deleted", entity_type="category",
                entity_id=str(cat.id), entity_label=cat.name)
    await cat.delete()
