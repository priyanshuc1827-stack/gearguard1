from fastapi import APIRouter, HTTPException, status, Query
from models import Request as MaintenanceRequest, Equipment, User, Team
from schemas import RequestResponse, RequestCreate, RequestUpdate, EquipmentDropdownResponse, EquipmentResponse, UserResponse
from beanie import PydanticObjectId
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.get("/requests", response_model=list[RequestResponse])
async def get_maintenance_requests(
    userId: Optional[str] = Query(None),
    role: Optional[str] = Query(None)
):
    try:
        query = {}
        if role == "technician" and userId:
            try:
                query["createdBy"] = PydanticObjectId(userId)
            except Exception:
                pass
        
        # Fetch requests sorted by created_at descending
        requests = await MaintenanceRequest.find(query).sort("-created_at").to_list()
        
        formatted = []
        for req in requests:
            # Populate equipment
            eq_obj = None
            if req.equipmentId:
                eq_doc = await Equipment.get(req.equipmentId)
                if eq_doc:
                    # Populating team for equipment if available
                    team_obj = None
                    if eq_doc.maintenanceTeamId:
                        team_doc = await Team.get(eq_doc.maintenanceTeamId)
                        if team_doc:
                            team_obj = {"id": str(team_doc.id), "name": team_doc.name}

                    eq_obj = EquipmentResponse(
                        id=str(eq_doc.id),
                        name=eq_doc.name,
                        serialNumber=eq_doc.serialNumber,
                        category=eq_doc.category,
                        location=eq_doc.location,
                        department=eq_doc.department,
                        assignedEmployee=eq_doc.assignedEmployee,
                        lastServiceDate=eq_doc.lastServiceDate,
                        isUsable=eq_doc.isUsable,
                        maintenanceTeamId=str(eq_doc.maintenanceTeamId) if eq_doc.maintenanceTeamId else None,
                        assignedTechnicianId=str(eq_doc.assignedTechnicianId) if eq_doc.assignedTechnicianId else None,
                        team=team_obj
                    )

            # Populate creator
            creator_obj = None
            if req.createdBy:
                user_doc = await User.get(req.createdBy)
                if user_doc:
                    creator_obj = UserResponse(
                        id=str(user_doc.id),
                        name=user_doc.name,
                        email=user_doc.email,
                        role=user_doc.role
                    )

            formatted.append(
                RequestResponse(
                    id=str(req.id),
                    subject=req.subject,
                    type=req.type,
                    status=req.status,
                    equipmentId=str(req.equipmentId) if req.equipmentId else None,
                    createdBy=str(req.createdBy) if req.createdBy else None,
                    scheduledDate=req.scheduledDate,
                    duration=req.duration,
                    created_at=req.created_at,
                    createdAt=req.created_at,
                    equipment=eq_obj,
                    creator=creator_obj
                )
            )
        return formatted
    except Exception as e:
        print(f"Error fetching requests: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch requests"
        )

@router.post("/requests", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance_request(body: RequestCreate):
    try:
        eq_oid = PydanticObjectId(body.equipmentId)
    except Exception:
        raise HTTPException(status_code=404, detail="Equipment not found")

    asset = await Equipment.get(eq_oid)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment not found")

    created_by_oid = None
    if body.createdBy:
        try:
            created_by_oid = PydanticObjectId(body.createdBy)
        except Exception:
            pass

    try:
        new_request = MaintenanceRequest(
            subject=body.subject,
            equipmentId=eq_oid,
            type=body.type or "Corrective",
            status="New",
            createdBy=created_by_oid,
            scheduledDate=body.scheduledDate
        )
        await new_request.insert()
        
        return RequestResponse(
            id=str(new_request.id),
            subject=new_request.subject,
            type=new_request.type,
            status=new_request.status,
            equipmentId=str(new_request.equipmentId),
            createdBy=str(new_request.createdBy) if new_request.createdBy else None,
            scheduledDate=new_request.scheduledDate,
            duration=new_request.duration,
            created_at=new_request.created_at,
            createdAt=new_request.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Creation failed")

@router.patch("/requests/{id}", response_model=RequestResponse)
async def update_maintenance_request(id: str, body: RequestUpdate):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")

    req = await MaintenanceRequest.get(oid)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Update fields
    if body.status is not None:
        req.status = body.status
    if body.duration is not None:
        req.duration = body.duration
    if body.equipmentId is not None:
        try:
            req.equipmentId = PydanticObjectId(body.equipmentId)
        except Exception:
            pass
    if body.createdBy is not None:
        try:
            req.createdBy = PydanticObjectId(body.createdBy)
        except Exception:
            pass
    if body.subject is not None:
        req.subject = body.subject
    if body.type is not None:
        req.type = body.type
    if body.scheduledDate is not None:
        req.scheduledDate = body.scheduledDate

    try:
        await req.save()

        target_eq_id = req.equipmentId
        # Conditional Workflow trigger: Repaired
        if body.status == "Repaired" and target_eq_id:
            asset = await Equipment.get(target_eq_id)
            if asset:
                asset.lastServiceDate = datetime.utcnow()
                await asset.save()

        # Conditional Workflow trigger: Scrap
        if body.status == "Scrap" and target_eq_id:
            asset = await Equipment.get(target_eq_id)
            if asset:
                asset.isUsable = False
                await asset.save()

        return RequestResponse(
            id=str(req.id),
            subject=req.subject,
            type=req.type,
            status=req.status,
            equipmentId=str(req.equipmentId) if req.equipmentId else None,
            createdBy=str(req.createdBy) if req.createdBy else None,
            scheduledDate=req.scheduledDate,
            duration=req.duration,
            created_at=req.created_at,
            createdAt=req.created_at
        )
    except Exception as e:
        print(f"Error updating request: {e}")
        raise HTTPException(status_code=500, detail="Update failed")

@router.get("/dropdown/equipment", response_model=list[EquipmentDropdownResponse])
async def get_dropdown_equipment():
    try:
        list_usable = await Equipment.find(Equipment.isUsable == True).to_list()
        return [
            EquipmentDropdownResponse(
                id=str(item.id),
                name=item.name,
                serialNumber=item.serialNumber
            )
            for item in list_usable
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch dropdown data")
