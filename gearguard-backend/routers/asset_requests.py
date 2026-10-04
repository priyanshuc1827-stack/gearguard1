from fastapi import APIRouter, HTTPException, status, Query
from models import AssetRequest, Equipment, User, Team
from schemas import AssetRequestResponse, AssetRequestCreate, AssetRequestAllocate, UserResponse, EquipmentResponse
from beanie import PydanticObjectId
from datetime import datetime
from audit_helper import log_audit

router = APIRouter()

async def _format_request(req: AssetRequest) -> AssetRequestResponse:
    emp_obj = None
    if req.employeeId:
        emp_doc = await User.get(req.employeeId)
        if emp_doc:
            emp_obj = UserResponse(id=str(emp_doc.id), name=emp_doc.name, email=emp_doc.email, role=emp_doc.role)

    asset_obj = None
    if req.allocatedAssetId:
        asset_doc = await Equipment.get(req.allocatedAssetId)
        if asset_doc:
            team_obj = None
            if asset_doc.maintenanceTeamId:
                team_doc = await Team.get(asset_doc.maintenanceTeamId)
                if team_doc:
                    team_obj = {"id": str(team_doc.id), "name": team_doc.name}
            asset_obj = EquipmentResponse(
                id=str(asset_doc.id),
                name=asset_doc.name,
                serialNumber=asset_doc.serialNumber,
                category=asset_doc.category,
                location=asset_doc.location,
                department=asset_doc.department,
                assignedEmployee=asset_doc.assignedEmployee,
                lastServiceDate=asset_doc.lastServiceDate,
                isUsable=asset_doc.isUsable,
                maintenanceTeamId=str(asset_doc.maintenanceTeamId) if asset_doc.maintenanceTeamId else None,
                assignedTechnicianId=str(asset_doc.assignedTechnicianId) if asset_doc.assignedTechnicianId else None,
                team=team_obj
            )

    return AssetRequestResponse(
        id=str(req.id),
        employeeId=str(req.employeeId),
        assetName=req.assetName,
        category=req.category,
        reason=req.reason,
        status=req.status,
        allocatedAssetId=str(req.allocatedAssetId) if req.allocatedAssetId else None,
        requestDate=req.requestDate,
        approvalDate=req.approvalDate,
        allocatedDate=req.allocatedDate,
        returnDate=req.returnDate,
        employee=emp_obj,
        allocatedAsset=asset_obj
    )

@router.get("/", response_model=list[AssetRequestResponse])
async def get_all_requests():
    try:
        requests = await AssetRequest.find_all().sort("-requestDate").to_list()
        return [await _format_request(req) for req in requests]
    except Exception as e:
        print(f"Error fetching requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch asset requests")

@router.get("/my-requests", response_model=list[AssetRequestResponse])
async def get_my_requests(employeeId: str = Query(...)):
    try:
        emp_oid = PydanticObjectId(employeeId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid employee ID")
    try:
        requests = await AssetRequest.find(
            AssetRequest.employeeId == emp_oid
        ).sort("-requestDate").to_list()
        return [await _format_request(req) for req in requests]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch your requests")

@router.post("/", response_model=AssetRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_asset_request(body: AssetRequestCreate):
    if not body.employeeId or not body.assetName:
        raise HTTPException(status_code=400, detail="Employee ID and asset name are required")
    try:
        emp_oid = PydanticObjectId(body.employeeId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid employee ID")

    try:
        new_req = AssetRequest(
            employeeId=emp_oid,
            assetName=body.assetName,
            category=body.category,
            reason=body.reason,
            status="Pending"
        )
        await new_req.insert()
        await log_audit(
            body.employeeId,
            "Request Asset",
            f'Requested "{body.assetName}" ({body.category}): {body.reason}'
        )
        return await _format_request(new_req)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create request")

@router.patch("/{id}/approve", response_model=AssetRequestResponse)
async def approve_request(id: str, managerId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")
    req = await AssetRequest.get(oid)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "Approved"
    req.approvalDate = datetime.utcnow()
    await req.save()
    emp_doc = await User.get(req.employeeId)
    emp_name = emp_doc.name if emp_doc else "Unknown"
    await log_audit(managerId, "Approve Request", f"Approved asset request for {emp_name}")
    return await _format_request(req)

@router.patch("/{id}/reject", response_model=AssetRequestResponse)
async def reject_request(id: str, managerId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")
    req = await AssetRequest.get(oid)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "Rejected"
    await req.save()
    emp_doc = await User.get(req.employeeId)
    emp_name = emp_doc.name if emp_doc else "Unknown"
    await log_audit(managerId, "Reject Request", f"Rejected asset request for {emp_name}")
    return await _format_request(req)

@router.patch("/{id}/allocate", response_model=AssetRequestResponse)
async def allocate_asset(id: str, body: AssetRequestAllocate):
    if not body.managerId or not body.equipmentId:
        raise HTTPException(status_code=400, detail="Manager ID and Equipment ID required")
    try:
        oid = PydanticObjectId(id)
        eq_oid = PydanticObjectId(body.equipmentId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid IDs")

    req = await AssetRequest.get(oid)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    asset = await Equipment.get(eq_oid)
    if not asset:
        raise HTTPException(status_code=404, detail="Equipment not found")

    emp_doc = await User.get(req.employeeId)
    emp_name = emp_doc.name if emp_doc else "Unknown"

    asset.assignedEmployee = emp_name
    await asset.save()

    req.status = "Allocated"
    req.allocatedAssetId = eq_oid
    req.allocatedDate = datetime.utcnow()
    await req.save()

    await log_audit(body.managerId, "Allocate Asset", f'Allocated "{asset.name}" ({asset.serialNumber}) to {emp_name}')
    return await _format_request(req)

@router.patch("/{id}/return", response_model=AssetRequestResponse)
async def return_asset(id: str, employeeId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="Request not found")

    req = await AssetRequest.get(oid)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.allocatedAssetId:
        asset = await Equipment.get(req.allocatedAssetId)
        if asset:
            asset.assignedEmployee = "Unassigned"
            await asset.save()

    emp_doc = await User.get(req.employeeId)
    emp_name = emp_doc.name if emp_doc else "Unknown"

    req.status = "Returned"
    req.returnDate = datetime.utcnow()
    await req.save()

    await log_audit(employeeId, "Return Asset", f"Processed return from {emp_name}")
    return await _format_request(req)
