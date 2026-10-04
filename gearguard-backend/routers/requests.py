from fastapi import APIRouter, HTTPException, status
from models import Request, Equipment, Team
from schemas import RequestResponse, RequestCreate, TeamResponse
from beanie import PydanticObjectId

router = APIRouter()

@router.post("/", response_model=RequestResponse)
async def create_request_autofill(body: RequestCreate):
    try:
        eq_oid = PydanticObjectId(body.equipmentId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment asset not found"
        )

    asset = await Equipment.get(eq_oid)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment asset not found"
        )

    # Auto-fetch team
    team_obj = None
    if asset.maintenanceTeamId:
        team_doc = await Team.get(asset.maintenanceTeamId)
        if team_doc:
            team_obj = TeamResponse(id=str(team_doc.id), name=team_doc.name)

    try:
        new_request = Request(
            subject=body.subject,
            equipmentId=eq_oid,
            type=body.type or "Corrective"
        )
        await new_request.insert()

        return RequestResponse(
            id=str(new_request.id),
            subject=new_request.subject,
            type=new_request.type,
            status=new_request.status,
            equipmentId=str(new_request.equipmentId),
            duration=new_request.duration,
            created_at=new_request.created_at,
            createdAt=new_request.created_at,
            team=team_obj
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create request and auto-fill information"
        )
