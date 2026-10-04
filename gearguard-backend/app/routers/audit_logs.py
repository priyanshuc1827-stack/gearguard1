"""app/routers/audit_logs.py — Read-only audit log (admin + auditor only)."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.security import require, TokenData
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("/")
async def list_audit_logs(
    current: TokenData = Depends(require("admin", "auditor")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
):
    query: dict = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if actor_id:
        from beanie import PydanticObjectId
        try:
            query["actor_id"] = PydanticObjectId(actor_id)
        except Exception:
            pass

    total = await AuditLog.find(query).count()
    skip = (page - 1) * page_size
    logs = await AuditLog.find(query).sort("-timestamp").skip(skip).limit(page_size).to_list()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(log.id),
                "actor_id": str(log.actor_id),
                "actor_name": log.actor_name,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "entity_label": log.entity_label,
                "before": log.before,
                "after": log.after,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in logs
        ],
    }
