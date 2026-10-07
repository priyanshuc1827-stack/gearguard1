"""app/models/audit_inspection.py — Audit & Compliance Inspection Model."""
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List


class ChecklistItem(BaseModel):
    item: str
    passed: bool = True
    notes: Optional[str] = None


class AuditInspection(Document):
    human_id: str = Field(default="")            # e.g. AUD-1001
    certificate_number: str = Field(default="")  # e.g. CERT-2026-PROD-1001
    department: str                              # Scoped department (Production, Machining, etc.)
    
    equipment_id: PydanticObjectId
    equipment_name: str
    equipment_human_id: str
    equipment_serial: str
    
    auditor_id: PydanticObjectId
    auditor_name: str
    auditor_email: str
    
    standard: str = "ISO 9001:2015"             # ISO 9001, OSHA 1910, ISO 14001, IEC 17025
    status: str = "passed"                      # passed, conditional, failed
    score: int = 100                            # 0-100
    
    checklist: List[ChecklistItem] = Field(default_factory=list)
    findings: str = ""
    
    corrective_action_required: bool = False
    corrective_action_notes: Optional[str] = None
    work_order_id: Optional[PydanticObjectId] = None
    work_order_human_id: Optional[str] = None
    
    next_audit_due: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "audit_inspections"
        indexes = ["human_id", "certificate_number", "department", "equipment_id", "auditor_id", "status", "-created_at"]
