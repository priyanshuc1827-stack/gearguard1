"""
app/services/ids.py — Server-side human-readable ID generation.
WO-NNNN for work orders, AST-NNNN for equipment.
"""
from app.models.counter import Counter


async def next_work_order_id() -> str:
    seq = await Counter.next("work_order")
    return f"WO-{seq:04d}"


async def next_equipment_id() -> str:
    seq = await Counter.next("equipment")
    return f"AST-{seq:04d}"
