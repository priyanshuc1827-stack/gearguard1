from fastapi import APIRouter, HTTPException, status
from models import AuditLog, User
from schemas import AuditLogResponse, AuditLogCreate, UserResponse
from beanie import PydanticObjectId
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=list[AuditLogResponse])
async def get_audit_logs():
    try:
        logs = await AuditLog.find_all().sort("-timestamp").to_list()
        formatted = []
        for item in logs:
            user_obj = None
            if item.userId:
                user_doc = await User.get(item.userId)
                if user_doc:
                    user_obj = UserResponse(
                        id=str(user_doc.id),
                        name=user_doc.name,
                        email=user_doc.email,
                        role=user_doc.role
                    )
            formatted.append(
                AuditLogResponse(
                    id=str(item.id),
                    userId=str(item.userId),
                    action=item.action,
                    details=item.details,
                    timestamp=item.timestamp,
                    user=user_obj
                )
            )
        return formatted
    except Exception as e:
        print(f"Error fetching audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch audit logs")

@router.post("/", response_model=AuditLogResponse, status_code=status.HTTP_201_CREATED)
async def create_audit_log(body: AuditLogCreate):
    if not body.userId or not body.action:
        raise HTTPException(status_code=400, detail="User ID and action are required")

    try:
        user_oid = PydanticObjectId(body.userId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    try:
        new_log = AuditLog(
            userId=user_oid,
            action=body.action,
            details=body.details
        )
        await new_log.insert()

        return AuditLogResponse(
            id=str(new_log.id),
            userId=str(new_log.userId),
            action=new_log.action,
            details=new_log.details,
            timestamp=new_log.timestamp
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create audit log entry")
