"""
app/routers/compliance.py — Comprehensive Audit & Compliance Portal Endpoints.
Allows Compliance & Quality Auditors to:
- Conduct & record equipment compliance inspections with standards (ISO 9001, OSHA 1910, etc.)
- Auto-generate corrective action (CAPA) work orders on failures
- Issue tamper-evident compliance certificates
- Sign off and certify completed work orders or flag non-conformances
- Inspect department-scoped compliance metrics and audit logs
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from collections import defaultdict

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import require, get_current_user, TokenData
from app.models.enums import UserRole, WorkOrderStatus, Priority, WorkOrderType
from app.models.user import User
from app.models.equipment import Equipment
from app.models.work_order import WorkOrder, Comment
from app.models.audit_inspection import AuditInspection, ChecklistItem
from app.models.counter import Counter
from app.models.audit_log import AuditLog
from app.services.audit import audit
from app.services.ids import next_work_order_id

router = APIRouter(prefix="/compliance", tags=["compliance"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ChecklistItemInput(BaseModel):
    item: str
    passed: bool = True
    notes: Optional[str] = None


class InspectionCreate(BaseModel):
    equipment_id: str
    standard: str = "ISO 9001:2015"
    status: str = "passed"                      # "passed", "conditional", "failed"
    score: int = 100
    checklist: List[ChecklistItemInput] = []
    findings: str = ""
    corrective_action_required: bool = False
    corrective_action_notes: Optional[str] = None
    next_audit_days: int = 90                   # Default 90 days ahead


class WorkOrderReviewInput(BaseModel):
    status: str                                 # "certified" or "flagged"
    notes: str


# ── Standards & Checklists Catalog ──────────────────────────────────────────

STANDARDS_CATALOG = [
    {
        "id": "ISO 9001:2015",
        "name": "ISO 9001:2015 — Quality Management & Machinery Validation",
        "category": "Quality & Calibration",
        "default_items": [
            "Calibration tolerances within allowable limits (Gauge R&R)",
            "Preventive maintenance schedule followed with zero overdue cycles",
            "Tool wear tracking and spindle vibration baseline acceptable",
            "Operator shift logbook and sign-offs fully maintained",
            "Manufacturer operating limits and duty cycle respected",
        ],
    },
    {
        "id": "OSHA 1910",
        "name": "OSHA 1910 — Machinery Safeguarding & Operator Safety",
        "category": "Safety & Guarding",
        "default_items": [
            "Emergency Stop buttons and pull-cords fully operational (<200ms trip)",
            "Point-of-operation safety light curtains and physical interlocks aligned",
            "Electrical enclosures locked and lockout/tagout (LOTO) points labeled",
            "Pneumatic and hydraulic pressure relief valves tested and tagged",
            "Mandatory PPE, arc flash, and pinch-point caution placards visible",
        ],
    },
    {
        "id": "ISO 14001:2015",
        "name": "ISO 14001:2015 — Environmental & Fluid Containment",
        "category": "Environmental",
        "default_items": [
            "Zero hazardous lubricant or hydraulic oil drips in catch basins",
            "Coolant filtration and closed-loop recirculator functioning normally",
            "Fume extraction and dust collector differential pressure in range",
            "Emergency spill containment kit stocked and accessible within 15 meters",
            "Hazardous waste and oil disposal manifest up to date",
        ],
    },
    {
        "id": "IEC 17025",
        "name": "IEC 17025 — Metrology & Sensor Traceability",
        "category": "Metrology & Precision",
        "default_items": [
            "Primary sensor drift within ±0.005% of reference standard",
            "Environmental cleanroom temperature (20±1°C) and humidity verified",
            "Traceable calibration master artifacts logged with NIST/NABL certs",
            "Thermal expansion compensation algorithm validated",
            "Anti-vibration foundation isolation pads checked for degradation",
        ],
    },
]


@router.get("/standards")
async def list_standards(current: TokenData = Depends(require("admin", "auditor", "manager"))):
    """List pre-configured compliance standards and checklist templates."""
    return STANDARDS_CATALOG


# ── Helper ───────────────────────────────────────────────────────────────────

async def _get_scoped_department(current: TokenData) -> Optional[str]:
    """Returns department for auditor/manager, or None if admin."""
    if current.role in (UserRole.manager, UserRole.auditor, "manager", "auditor"):
        user = await User.get(PydanticObjectId(current.user_id))
        dept = getattr(user, "department", None)
        if dept and dept != "All":
            return dept
    return None


# ── Inspection Endpoints ─────────────────────────────────────────────────────

@router.get("/inspections")
async def list_inspections(
    current: TokenData = Depends(require("admin", "auditor", "manager")),
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """List compliance audit inspections scoped to the user's department."""
    scoped_dept = await _get_scoped_department(current)
    target_dept = scoped_dept or (department if department and department != "All" else None)

    query: dict = {}
    if target_dept:
        query["department"] = target_dept
    if status_filter:
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"equipment_name": {"$regex": search, "$options": "i"}},
            {"equipment_human_id": {"$regex": search, "$options": "i"}},
            {"human_id": {"$regex": search, "$options": "i"}},
            {"certificate_number": {"$regex": search, "$options": "i"}},
            {"auditor_name": {"$regex": search, "$options": "i"}},
        ]

    inspections = await AuditInspection.find(query).sort("-created_at").limit(limit).to_list()
    return [
        {
            "id": str(i.id),
            "human_id": i.human_id,
            "certificate_number": i.certificate_number,
            "department": i.department,
            "equipment_id": str(i.equipment_id),
            "equipment_name": i.equipment_name,
            "equipment_human_id": i.equipment_human_id,
            "equipment_serial": i.equipment_serial,
            "auditor_id": str(i.auditor_id),
            "auditor_name": i.auditor_name,
            "auditor_email": i.auditor_email,
            "standard": i.standard,
            "status": i.status,
            "score": i.score,
            "checklist": [c.model_dump() for c in i.checklist],
            "findings": i.findings,
            "corrective_action_required": i.corrective_action_required,
            "corrective_action_notes": i.corrective_action_notes,
            "work_order_id": str(i.work_order_id) if i.work_order_id else None,
            "work_order_human_id": i.work_order_human_id,
            "next_audit_due": i.next_audit_due.isoformat() if i.next_audit_due else None,
            "created_at": i.created_at.isoformat(),
        }
        for i in inspections
    ]


@router.post("/inspections", status_code=status.HTTP_201_CREATED)
async def create_inspection(
    body: InspectionCreate,
    current: TokenData = Depends(require("admin", "auditor")),
):
    """
    Conduct and register an official machinery audit inspection.
    - Validates departmental boundary for auditors
    - Issues certificate number
    - Automatically updates machinery audit status and next audit date
    - If non-compliant / failed, optionally dispatches high-priority CAPA Work Order
    - Records immutable tamper-evident audit entry
    """
    try:
        eq = await Equipment.get(PydanticObjectId(body.equipment_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")
    if not eq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    user = await User.get(PydanticObjectId(current.user_id))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Auditor profile not found")

    scoped_dept = await _get_scoped_department(current)
    if scoped_dept and eq.department != scoped_dept:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Auditor scoping violation: Equipment belongs to '{eq.department}', but your assigned audit department is '{scoped_dept}'."
        )

    # Sequence ID for inspection
    seq = await Counter.next("audit_inspection")
    human_id = f"AUD-{1000 + seq}"

    dept_code = "".join([w[0] for w in eq.department.split()]).upper() or "GEN"
    year = datetime.now().year
    cert_no = f"CERT-{year}-{dept_code}-{1000 + seq}"

    now = datetime.now(tz=timezone.utc)
    next_due = now + timedelta(days=body.next_audit_days)

    checklist_items = [
        ChecklistItem(item=item.item, passed=item.passed, notes=item.notes)
        for item in body.checklist
    ]

    # Handle automatic CAPA work order creation if non-conformance detected
    capa_wo_id = None
    capa_wo_human_id = None
    if body.corrective_action_required or body.status in ("failed", "conditional"):
        wo_seq = await next_work_order_id()
        capa_wo = WorkOrder(
            human_id=wo_seq,
            subject=f"[CAPA Audit Non-Conformance] {eq.name}: {body.findings[:60] if body.findings else 'Inspection Discrepancy'}",
            type=WorkOrderType.corrective,
            status=WorkOrderStatus.new,
            priority=Priority.high if body.status == "failed" else Priority.medium,
            equipment_id=eq.id,
            team_id=eq.maintenance_team_id,
            created_by=user.id,
            due_date=now + timedelta(days=7 if body.status == "failed" else 14),
            comments=[
                Comment(
                    author_id=user.id,
                    author_name=f"{user.name} (Auditor)",
                    text=f"🛡️ Automatic Corrective Action Request generated by Audit Inspection {human_id} ({body.standard}).\n\nFindings: {body.findings}\nAction Required: {body.corrective_action_notes or 'Remediate flagged non-conformance and submit for re-inspection.'}",
                )
            ]
        )
        await capa_wo.insert()
        capa_wo_id = capa_wo.id
        capa_wo_human_id = capa_wo.human_id

    inspection = AuditInspection(
        human_id=human_id,
        certificate_number=cert_no,
        department=eq.department,
        equipment_id=eq.id,
        equipment_name=eq.name,
        equipment_human_id=eq.human_id,
        equipment_serial=eq.serial_number,
        auditor_id=user.id,
        auditor_name=user.name,
        auditor_email=user.email,
        standard=body.standard,
        status=body.status,
        score=body.score,
        checklist=checklist_items,
        findings=body.findings,
        corrective_action_required=body.corrective_action_required or bool(capa_wo_id),
        corrective_action_notes=body.corrective_action_notes,
        work_order_id=capa_wo_id,
        work_order_human_id=capa_wo_human_id,
        next_audit_due=next_due,
        created_at=now,
    )
    await inspection.insert()

    # Update machinery compliance record
    eq.last_audit_date = now
    eq.audit_status = body.status
    eq.next_audit_due = next_due
    await eq.save()

    # Log immutable audit trail
    await audit(
        actor_id=str(user.id),
        actor_name=user.name,
        action=f"compliance.inspection_{body.status}",
        entity_type="audit_inspection",
        entity_id=str(inspection.id),
        entity_label=f"{human_id} ({eq.name})",
        after={
            "certificate": cert_no,
            "standard": body.standard,
            "status": body.status,
            "score": body.score,
            "capa_ticket": capa_wo_human_id,
        }
    )

    return {
        "id": str(inspection.id),
        "human_id": inspection.human_id,
        "certificate_number": inspection.certificate_number,
        "department": inspection.department,
        "equipment_id": str(inspection.equipment_id),
        "equipment_name": inspection.equipment_name,
        "equipment_human_id": inspection.equipment_human_id,
        "standard": inspection.standard,
        "status": inspection.status,
        "score": inspection.score,
        "findings": inspection.findings,
        "work_order_human_id": inspection.work_order_human_id,
        "created_at": inspection.created_at.isoformat(),
    }


# ── Work Order Compliance Review (Sign-off & Flagging) ──────────────────────

@router.post("/work-orders/{wo_id}/review")
async def review_work_order(
    wo_id: str,
    body: WorkOrderReviewInput,
    current: TokenData = Depends(require("admin", "auditor")),
):
    """
    Auditor review, formal sign-off, or non-conformance flagging of a completed work order.
    Auditors can verify post-repair calibration, documentation completeness, and downtime accuracy.
    """
    try:
        wo = await WorkOrder.get(PydanticObjectId(wo_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")

    user = await User.get(PydanticObjectId(current.user_id))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Auditor not found")

    scoped_dept = await _get_scoped_department(current)
    if scoped_dept:
        # Check equipment department
        if wo.equipment_id:
            eq = await Equipment.get(wo.equipment_id)
            if eq and eq.department != scoped_dept:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"Auditor scoping violation: Work order belongs to '{eq.department}', but your assigned department is '{scoped_dept}'."
                )

    now = datetime.now(tz=timezone.utc)
    status_clean = "certified" if body.status.lower() in ("certified", "passed", "approved") else "flagged"

    wo.audited_by = user.name
    wo.audited_at = now
    wo.audit_status = status_clean
    wo.audit_notes = body.notes

    status_badge = "✅ CERTIFIED COMPLIANT" if status_clean == "certified" else "⚠️ FLAGGED NON-CONFORMANCE"
    wo.comments.append(
        Comment(
            author_id=user.id,
            author_name=f"{user.name} (Auditor)",
            text=f"🛡️ Compliance Review — {status_badge}\n\nAuditor Notes: {body.notes}",
            created_at=now,
        )
    )
    wo.updated_at = now
    await wo.save()

    # Log immutable audit trail
    await audit(
        actor_id=str(user.id),
        actor_name=user.name,
        action=f"compliance.work_order_{status_clean}",
        entity_type="work_order",
        entity_id=str(wo.id),
        entity_label=wo.human_id,
        after={
            "audit_status": status_clean,
            "audited_by": user.name,
            "notes": body.notes,
        }
    )

    return {
        "id": str(wo.id),
        "human_id": wo.human_id,
        "audited_by": wo.audited_by,
        "audited_at": wo.audited_at.isoformat(),
        "audit_status": wo.audit_status,
        "audit_notes": wo.audit_notes,
    }


# ── Department Compliance KPIs & Summary ─────────────────────────────────────

@router.get("/stats")
async def get_compliance_stats(
    current: TokenData = Depends(require("admin", "auditor", "manager")),
    department: Optional[str] = Query(None),
):
    """
    Computes department-scoped compliance KPIs, certification coverage,
    and open CAPA discrepancy counts.
    """
    scoped_dept = await _get_scoped_department(current)
    target_dept = scoped_dept or (department if department and department != "All" else None)

    if target_dept:
        eqs = await Equipment.find(Equipment.department == target_dept).to_list()
        inspections = await AuditInspection.find(AuditInspection.department == target_dept).to_list()
    else:
        eqs = await Equipment.find_all().to_list()
        inspections = await AuditInspection.find_all().to_list()

    total_eq = len(eqs)
    compliant_eq = len([e for e in eqs if getattr(e, "audit_status", None) == "passed"])
    conditional_eq = len([e for e in eqs if getattr(e, "audit_status", None) == "conditional"])
    failed_eq = len([e for e in eqs if getattr(e, "audit_status", None) == "failed"])
    uninspected_eq = len([e for e in eqs if getattr(e, "audit_status", None) in (None, "uninspected")])

    compliance_rate = round((compliant_eq / total_eq * 100), 1) if total_eq > 0 else 0.0

    # Overdue checks
    now = datetime.now(tz=timezone.utc)
    overdue_audits = 0
    for e in eqs:
        due = getattr(e, "next_audit_due", None)
        if due:
            due_tz = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
            if due_tz < now:
                overdue_audits += 1

    # Active CAPA tickets generated by audits
    capa_wo_count = len([i for i in inspections if i.work_order_id is not None])

    # Recent inspections (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    recent_inspections = 0
    for i in inspections:
        c_at = i.created_at if i.created_at.tzinfo else i.created_at.replace(tzinfo=timezone.utc)
        if c_at >= thirty_days_ago:
            recent_inspections += 1

    # Work orders signed off
    if target_dept:
        dept_eq_ids = [e.id for e in eqs]
        dept_wos = await WorkOrder.find({"equipment_id": {"$in": dept_eq_ids}}).to_list()
    else:
        dept_wos = await WorkOrder.find_all().to_list()

    certified_wos = len([w for w in dept_wos if getattr(w, "audit_status", None) == "certified"])
    flagged_wos = len([w for w in dept_wos if getattr(w, "audit_status", None) == "flagged"])
    pending_review_wos = len([w for w in dept_wos if w.status in (WorkOrderStatus.repaired, "Repaired") and not getattr(w, "audit_status", None)])

    return {
        "department": target_dept or "All Plant Facilities",
        "totalEquipment": total_eq,
        "compliantCount": compliant_eq,
        "conditionalCount": conditional_eq,
        "failedCount": failed_eq,
        "uninspectedCount": uninspected_eq,
        "complianceRate": compliance_rate,
        "overdueAudits": overdue_audits,
        "totalInspections": len(inspections),
        "recentInspections": recent_inspections,
        "activeCapaTickets": capa_wo_count,
        "certifiedWorkOrders": certified_wos,
        "flaggedWorkOrders": flagged_wos,
        "pendingReviewWorkOrders": pending_review_wos,
    }
