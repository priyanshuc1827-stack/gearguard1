"""app/routers/locations.py"""
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from app.core.security import require, TokenData
from app.models.location import Location
from app.models.user import User
from app.services.audit import audit

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationIn(BaseModel):
    name: str
    address: Optional[str] = None


class LocationOut(BaseModel):
    id: str
    name: str
    address: Optional[str] = None


def _out(l: Location) -> LocationOut:
    return LocationOut(id=str(l.id), name=l.name, address=l.address)


@router.get("/", response_model=List[LocationOut])
async def list_locations(current: TokenData = Depends(require("admin", "manager", "technician", "user", "auditor"))):
    return [_out(l) for l in await Location.find_all().sort("name").to_list()]


@router.post("/", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(body: LocationIn, current: TokenData = Depends(require("admin", "manager"))):
    if await Location.find_one(Location.name == body.name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Location already exists")
    loc = Location(name=body.name, address=body.address)
    await loc.insert()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="location.created", entity_type="location",
                entity_id=str(loc.id), entity_label=loc.name)
    return _out(loc)


@router.delete("/{loc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(loc_id: str, current: TokenData = Depends(require("admin", "manager"))):
    loc = await Location.get(PydanticObjectId(loc_id))
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="location.deleted", entity_type="location",
                entity_id=str(loc.id), entity_label=loc.name)
    await loc.delete()
