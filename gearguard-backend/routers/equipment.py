from fastapi import APIRouter, HTTPException, status
from models import Equipment, Request as MaintenanceRequest, Team
from schemas import EquipmentResponse, EquipmentCreate, EquipmentUpdate, TeamResponse, RequestResponse
from beanie import PydanticObjectId

router = APIRouter()

@router.get("/", response_model=list[EquipmentResponse])
async def get_all_equipment():
    try:
        all_equipment = await Equipment.find_all().to_list()
        enriched = []
        for asset in all_equipment:
            # Query count of active requests
            active_count = await MaintenanceRequest.find(
                MaintenanceRequest.equipmentId == asset.id,
                MaintenanceRequest.status != "Repaired",
                MaintenanceRequest.status != "Scrap"
            ).count()

            # Fetch populated team
            team_obj = None
            if asset.maintenanceTeamId:
                team_doc = await Team.get(asset.maintenanceTeamId)
                if team_doc:
                    team_obj = TeamResponse(id=str(team_doc.id), name=team_doc.name)

            enriched.append(
                EquipmentResponse(
                    id=str(asset.id),
                    name=asset.name,
                    serialNumber=asset.serialNumber,
                    category=asset.category,
                    location=asset.location,
                    department=asset.department,
                    assignedEmployee=asset.assignedEmployee,
                    lastServiceDate=asset.lastServiceDate,
                    isUsable=asset.isUsable,
                    maintenanceTeamId=str(asset.maintenanceTeamId) if asset.maintenanceTeamId else None,
                    assignedTechnicianId=str(asset.assignedTechnicianId) if asset.assignedTechnicianId else None,
                    team=team_obj,
                    requestCount=active_count
                )
            )
        return enriched
    except Exception as e:
        print(f"Error fetching equipment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch equipment list"
        )

@router.get("/{id}", response_model=EquipmentResponse)
async def get_equipment_detail(id: str):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Equipment not found")

    asset = await Equipment.get(oid)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment not found")

    try:
        # Fetch history
        history = await MaintenanceRequest.find(MaintenanceRequest.equipmentId == oid).to_list()
        formatted_requests = []
        for r in history:
            formatted_requests.append({
                "id": str(r.id),
                "_id": str(r.id),
                "subject": r.subject,
                "type": r.type,
                "status": r.status,
                "equipmentId": str(r.equipmentId) if r.equipmentId else None,
                "createdBy": str(r.createdBy) if r.createdBy else None,
                "scheduledDate": r.scheduledDate,
                "duration": r.duration,
                "created_at": r.created_at,
                "createdAt": r.created_at
            })

        # Fetch active count
        active_count = await MaintenanceRequest.find(
            MaintenanceRequest.equipmentId == oid,
            MaintenanceRequest.status != "Repaired",
            MaintenanceRequest.status != "Scrap"
        ).count()

        # Fetch team
        team_obj = None
        if asset.maintenanceTeamId:
            team_doc = await Team.get(asset.maintenanceTeamId)
            if team_doc:
                team_obj = TeamResponse(id=str(team_doc.id), name=team_doc.name)

        return EquipmentResponse(
            id=str(asset.id),
            name=asset.name,
            serialNumber=asset.serialNumber,
            category=asset.category,
            location=asset.location,
            department=asset.department,
            assignedEmployee=asset.assignedEmployee,
            lastServiceDate=asset.lastServiceDate,
            isUsable=asset.isUsable,
            maintenanceTeamId=str(asset.maintenanceTeamId) if asset.maintenanceTeamId else None,
            assignedTechnicianId=str(asset.assignedTechnicianId) if asset.assignedTechnicianId else None,
            team=team_obj,
            requests=formatted_requests,
            requestCount=active_count
        )
    except Exception as e:
        print(f"Error fetching equipment detail: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch details")

@router.post("/", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(body: EquipmentCreate):
    if not body.name or not body.serialNumber:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name and Serial Number required"
        )

    # Check unique constraint violations
    existing = await Equipment.find_one(Equipment.serialNumber == body.serialNumber)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial Number must be unique"
        )

    team_oid = None
    if body.maintenanceTeamId:
        try:
            team_oid = PydanticObjectId(body.maintenanceTeamId)
        except Exception:
            pass

    try:
        new_asset = Equipment(
            name=body.name,
            serialNumber=body.serialNumber,
            department=body.department,
            category=body.category,
            location=body.location,
            maintenanceTeamId=team_oid,
            assignedEmployee=body.assignedEmployee or "Unassigned",
            isUsable=True
        )
        await new_asset.insert()
        return EquipmentResponse(
            id=str(new_asset.id),
            name=new_asset.name,
            serialNumber=new_asset.serialNumber,
            category=new_asset.category,
            location=new_asset.location,
            department=new_asset.department,
            assignedEmployee=new_asset.assignedEmployee,
            isUsable=new_asset.isUsable,
            maintenanceTeamId=str(new_asset.maintenanceTeamId) if new_asset.maintenanceTeamId else None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Creation failed"
        )

@router.patch("/{id}", response_model=EquipmentResponse)
async def update_equipment(id: str, body: EquipmentUpdate):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Equipment not found")

    asset = await Equipment.get(oid)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "maintenanceTeamId":
            if value:
                try:
                    setattr(asset, field, PydanticObjectId(value))
                except Exception:
                    pass
            else:
                setattr(asset, field, None)
        elif field == "assignedTechnicianId":
            if value:
                try:
                    setattr(asset, field, PydanticObjectId(value))
                except Exception:
                    pass
            else:
                setattr(asset, field, None)
        else:
            setattr(asset, field, value)

    try:
        await asset.save()
        
        # Populating team if available
        team_obj = None
        if asset.maintenanceTeamId:
            team_doc = await Team.get(asset.maintenanceTeamId)
            if team_doc:
                team_obj = TeamResponse(id=str(team_doc.id), name=team_doc.name)

        return EquipmentResponse(
            id=str(asset.id),
            name=asset.name,
            serialNumber=asset.serialNumber,
            category=asset.category,
            location=asset.location,
            department=asset.department,
            assignedEmployee=asset.assignedEmployee,
            lastServiceDate=asset.lastServiceDate,
            isUsable=asset.isUsable,
            maintenanceTeamId=str(asset.maintenanceTeamId) if asset.maintenanceTeamId else None,
            assignedTechnicianId=str(asset.assignedTechnicianId) if asset.assignedTechnicianId else None,
            team=team_obj
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Update failed")

@router.delete("/{id}")
async def delete_equipment(id: str):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Equipment not found")

    asset = await Equipment.get(oid)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment not found")

    try:
        await asset.delete()
        return {"message": "Equipment deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Delete failed")
