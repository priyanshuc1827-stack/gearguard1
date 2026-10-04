"""
app/services/audit.py — Shared audit service.
Every route that mutates data MUST call audit() after saving.
"""
from beanie import PydanticObjectId
from app.models.audit_log import AuditLog


async def audit(
    *,
    actor_id: str,
    actor_name: str,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_label: str,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    """Fire-and-forget audit entry. Never raises — audit failure must not break the API."""
    try:
        entry = AuditLog(
            actor_id=PydanticObjectId(actor_id),
            actor_name=actor_name,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_label=entity_label,
            before=before,
            after=after,
        )
        await entry.insert()
    except Exception as exc:
        # Log to stderr but never propagate
        import sys
        print(f"[audit] WARNING: failed to write audit entry: {exc}", file=sys.stderr)
