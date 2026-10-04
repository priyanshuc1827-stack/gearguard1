from fastapi import APIRouter, HTTPException, status, Query
from models import Location
from schemas import LocationResponse, LocationCreate
from beanie import PydanticObjectId
from audit_helper import log_audit

router = APIRouter()

@router.get("/", response_model=list[LocationResponse])
async def get_locations():
    try:
        locations = await Location.find_all().sort("name").to_list()
        return [
            LocationResponse(id=str(loc.id), name=loc.name, address=loc.address)
            for loc in locations
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load locations")

@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(body: LocationCreate):
    if not body.name:
        raise HTTPException(status_code=400, detail="Location name is required")

    existing = await Location.find_one(Location.name == body.name)
    if existing:
        raise HTTPException(status_code=400, detail="Location name already exists")

    try:
        new_loc = Location(name=body.name, address=body.address)
        await new_loc.insert()

        if body.adminUserId:
            await log_audit(body.adminUserId, "Create Location", f"Created facility location: {body.name}")

        return LocationResponse(id=str(new_loc.id), name=new_loc.name, address=new_loc.address)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create location")

@router.delete("/{id}")
async def delete_location(id: str, adminUserId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Location not found")

    loc = await Location.get(oid)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    try:
        await loc.delete()
        if adminUserId:
            await log_audit(adminUserId, "Delete Location", f"Deleted facility location: {loc.name}")
        return {"message": "Location deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete location")
