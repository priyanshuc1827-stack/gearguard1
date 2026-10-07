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

    # Department Scoping for Auditors
    if current.role == "auditor":
        from app.models.user import User
        from app.models.equipment import Equipment
        from app.models.work_order import WorkOrder
        from beanie import PydanticObjectId

        current_user = await User.get(PydanticObjectId(current.user_id))
        auditor_dept = getattr(current_user, "department", None)
        if auditor_dept and auditor_dept != "All":
            dept_users = await User.find(User.department == auditor_dept).to_list()
            dept_uids = [u.id for u in dept_users]

            dept_eqs = await Equipment.find(Equipment.department == auditor_dept).to_list()
            dept_eq_ids = [str(e.id) for e in dept_eqs]
            dept_eq_labels = [e.name for e in dept_eqs] + [e.human_id for e in dept_eqs]

            dept_wos = await WorkOrder.find({
                "$or": [
                    {"equipment_id": {"$in": [e.id for e in dept_eqs]}},
                    {"created_by": {"$in": dept_uids}},
                ]
            }).to_list()
            dept_wo_ids = [str(w.id) for w in dept_wos]
            dept_wo_labels = [w.human_id for w in dept_wos]

            or_clauses = [
                {"actor_id": {"$in": dept_uids}},
                {"entity_id": {"$in": dept_eq_ids + dept_wo_ids}},
                {"entity_label": {"$in": dept_eq_labels + dept_wo_labels}},
            ]
            if "$or" in query:
                query = {"$and": [{"$or": query.pop("$or")}, {"$or": or_clauses}]}
            elif "$and" in query:
                query["$and"].append({"$or": or_clauses})
            else:
                query["$or"] = or_clauses

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
