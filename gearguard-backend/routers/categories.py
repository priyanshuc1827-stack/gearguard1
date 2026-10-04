from fastapi import APIRouter, HTTPException, status, Query
from models import Category
from schemas import CategoryResponse, CategoryCreate
from beanie import PydanticObjectId
from audit_helper import log_audit

router = APIRouter()

@router.get("/", response_model=list[CategoryResponse])
async def get_categories():
    try:
        categories = await Category.find_all().sort("name").to_list()
        return [
            CategoryResponse(id=str(c.id), name=c.name, description=c.description)
            for c in categories
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load categories")

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate):
    if not body.name:
        raise HTTPException(status_code=400, detail="Category name is required")

    existing = await Category.find_one(Category.name == body.name)
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    try:
        new_cat = Category(name=body.name, description=body.description)
        await new_cat.insert()

        if body.adminUserId:
            await log_audit(body.adminUserId, "Create Category", f"Created asset category: {body.name}")

        return CategoryResponse(id=str(new_cat.id), name=new_cat.name, description=new_cat.description)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create category")

@router.delete("/{id}")
async def delete_category(id: str, adminUserId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Category not found")

    cat = await Category.get(oid)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    try:
        await cat.delete()
        if adminUserId:
            await log_audit(adminUserId, "Delete Category", f"Deleted asset category: {cat.name}")
        return {"message": "Category deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete category")
