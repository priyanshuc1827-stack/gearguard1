from beanie import PydanticObjectId
from models import AuditLog
from datetime import datetime

async def log_audit(user_id: str, action: str, details: str):
    if not user_id:
        return
    try:
        log = AuditLog(
            userId=PydanticObjectId(user_id),
            action=action,
            details=details,
            timestamp=datetime.utcnow()
        )
        await log.insert()
        print(f"[AUDIT]: User {user_id} performed action '{action}' - {details}")
    except Exception as e:
        print(f"Failed to write audit log: {e}")
