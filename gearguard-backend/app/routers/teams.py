"""app/routers/teams.py"""
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.core.security import get_current_user, require, TokenData
from app.models.team import Team
from app.models.user import User
from app.services.audit import audit

router = APIRouter(prefix="/teams", tags=["teams"])


class TeamCreate:
    def __init__(self, name: str, description: str | None = None):
        self.name = name
        self.description = description


from pydantic import BaseModel
from typing import Optional


class TeamIn(BaseModel):
    name: str
    description: Optional[str] = None


class TeamOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


def _out(t: Team) -> TeamOut:
    return TeamOut(id=str(t.id), name=t.name, description=t.description)


@router.get("/", response_model=List[TeamOut])
async def list_teams(current: TokenData = Depends(require("admin", "manager", "technician", "auditor"))):
    return [_out(t) for t in await Team.find_all().to_list()]


@router.post("/", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(body: TeamIn, current: TokenData = Depends(require("admin", "manager"))):
    if await Team.find_one(Team.name == body.name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Team name already exists")
    team = Team(name=body.name, description=body.description)
    await team.insert()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="team.created", entity_type="team",
                entity_id=str(team.id), entity_label=team.name)
    return _out(team)


@router.patch("/{team_id}", response_model=TeamOut)
async def update_team(team_id: str, body: TeamIn, current: TokenData = Depends(require("admin", "manager"))):
    team = await Team.get(PydanticObjectId(team_id))
    if not team:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    team.name = body.name
    team.description = body.description
    await team.save()
    return _out(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: str, current: TokenData = Depends(require("admin"))):
    team = await Team.get(PydanticObjectId(team_id))
    if not team:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="team.deleted", entity_type="team",
                entity_id=str(team.id), entity_label=team.name)
    await team.delete()
