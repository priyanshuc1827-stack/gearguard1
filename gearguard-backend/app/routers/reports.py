"""app/routers/reports.py — Reports powered by robust queries with Atlas compatibility and department scoping."""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query

from app.core.security import require, TokenData
from app.models.work_order import WorkOrder
from app.models.equipment import Equipment
from app.models.user import User
from app.models.enums import UserRole

router = APIRouter(prefix="/reports", tags=["reports"])

# ── Simple in-process TTL cache ───────────────────────────────────────────────
# Avoids repeated full-collection MongoDB scans within the same minute.
_CACHE_TTL = 60  # seconds
_cache: Dict[str, Tuple[float, Any]] = {}


def _cache_get(key: str) -> Any:
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, value = entry
    if datetime.now(tz=timezone.utc).timestamp() - ts > _CACHE_TTL:
        del _cache[key]
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (datetime.now(tz=timezone.utc).timestamp(), value)


async def _resolve_target_department(current: TokenData, department: Optional[str]) -> Optional[str]:
    if current.role in (UserRole.manager, UserRole.auditor):
        current_user = await User.get(PydanticObjectId(current.user_id))
        scoped_dept = getattr(current_user, "department", None)
        if scoped_dept and scoped_dept != "All":
            return scoped_dept
    if department and department != "All":
        return department
    return None


@router.get("/summary")
async def summary(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(require("admin", "manager", "auditor")),
):
    target_dept = await _resolve_target_department(current, department)
    cache_key = f"summary:{target_dept or 'all'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if target_dept:
        dept_eqs = await Equipment.find(Equipment.department == target_dept).to_list()
        dept_eq_ids = [e.id for e in dept_eqs]
        dept_users = await User.find(User.department == target_dept).to_list()
        dept_uids = [u.id for u in dept_users]

        wos = await WorkOrder.find({
            "$or": [
                {"equipment_id": {"$in": dept_eq_ids}},
                {"created_by": {"$in": dept_uids}},
            ]
        }).to_list()

        total_assets = len(dept_eqs)
        out_of_service = len([e for e in dept_eqs if not e.is_usable])
        technicians = len([u for u in dept_users if u.role == UserRole.technician or u.role == "technician"])
    else:
        wos = await WorkOrder.find_all().to_list()
        total_assets = await Equipment.find_all().count()
        out_of_service = await Equipment.find(Equipment.is_usable == False).count()
        technicians = await User.find(User.role == "technician").count()

    total_wos = len(wos)
    status_counts = defaultdict(int)
    total_downtime = 0
    overdue_count = 0
    now = datetime.now(tz=timezone.utc)

    for w in wos:
        st = w.status.value if hasattr(w.status, "value") else str(w.status)
        status_counts[st] += 1
        if w.downtime_minutes:
            total_downtime += w.downtime_minutes

        if w.due_date and st not in ("Repaired", "Scrap"):
            due = w.due_date if w.due_date.tzinfo else w.due_date.replace(tzinfo=timezone.utc)
            if due < now:
                overdue_count += 1

    repaired_count = status_counts["Repaired"]
    repair_rate = round((repaired_count / total_wos * 100), 1) if total_wos > 0 else 0.0

    result = {
        "totalWorkOrders": total_wos,
        "openWorkOrders": status_counts["New"] + status_counts["In Progress"],
        "inProgress": status_counts["In Progress"],
        "repaired": repaired_count,
        "scrapped": status_counts["Scrap"],
        "overdue": overdue_count,
        "totalDowntimeMinutes": total_downtime,
        "totalAssets": total_assets,
        "outOfServiceAssets": out_of_service,
        "totalTechnicians": technicians,
        "repairRate": repair_rate,
        "department": target_dept or "All",
    }
    _cache_set(cache_key, result)
    return result


@router.get("/high-risk")
async def high_risk(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(require("admin", "manager", "auditor")),
):
    target_dept = await _resolve_target_department(current, department)
    cache_key = f"high-risk:{target_dept or 'all'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if target_dept:
        dept_eqs = await Equipment.find(Equipment.department == target_dept).to_list()
        dept_eq_ids = [e.id for e in dept_eqs]
        wos = await WorkOrder.find({
            "equipment_id": {"$in": dept_eq_ids}
        }).to_list()
        all_eq = dept_eqs
    else:
        wos = await WorkOrder.find(WorkOrder.equipment_id != None).to_list()
        all_eq = await Equipment.find_all().to_list()

    asset_stats = defaultdict(lambda: {"failures": 0, "totalDowntime": 0})
    for w in wos:
        if w.equipment_id:
            eq_id_str = str(w.equipment_id)
            asset_stats[eq_id_str]["failures"] += 1
            if w.downtime_minutes:
                asset_stats[eq_id_str]["totalDowntime"] += w.downtime_minutes

    sorted_assets = sorted(
        asset_stats.items(),
        key=lambda x: (x[1]["failures"], x[1]["totalDowntime"]),
        reverse=True
    )[:5]

    eq_by_id = {str(e.id): e for e in all_eq}

    result = []
    for eq_id_str, stats in sorted_assets:
        eq = eq_by_id.get(eq_id_str)
        result.append({
            "assetId": eq_id_str,
            "name": eq.name if eq else "Unknown Asset",
            "humanId": eq.human_id if eq else "—",
            "serialNumber": eq.serial_number if eq else "—",
            "department": eq.department if eq else "—",
            "failures": stats["failures"],
            "totalDowntimeMinutes": stats["totalDowntime"],
        })

    _cache_set(cache_key, result)
    return result


@router.get("/technician-performance")
async def technician_performance(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(require("admin", "manager", "auditor")),
):
    target_dept = await _resolve_target_department(current, department)
    cache_key = f"tech-perf:{target_dept or 'all'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if target_dept:
        all_techs = await User.find(
            User.role == "technician",
            User.department == target_dept
        ).to_list()
    else:
        all_techs = await User.find(User.role == "technician").to_list()

    tech_ids = [t.id for t in all_techs]
    wos = await WorkOrder.find({"assignee_id": {"$in": tech_ids}}).to_list()
    tech_stats = defaultdict(lambda: {"assigned": 0, "completed": 0, "totalDowntime": 0})

    for w in wos:
        tid_str = str(w.assignee_id)
        tech_stats[tid_str]["assigned"] += 1
        st = w.status.value if hasattr(w.status, "value") else str(w.status)
        if st == "Repaired":
            tech_stats[tid_str]["completed"] += 1
        if w.downtime_minutes:
            tech_stats[tid_str]["totalDowntime"] += w.downtime_minutes

    tech_by_id = {str(t.id): t for t in all_techs}

    result = []
    for tid_str, t in tech_by_id.items():
        stats = tech_stats.get(tid_str, {"assigned": 0, "completed": 0, "totalDowntime": 0})
        assigned = stats["assigned"]
        completed = stats["completed"]
        rate = round((completed / max(assigned, 1)) * 100, 1) if assigned > 0 else 0.0
        result.append({
            "technicianId": tid_str,
            "name": t.name,
            "email": t.email,
            "department": getattr(t, "department", "General"),
            "assigned": assigned,
            "completed": completed,
            "totalDowntimeMinutes": stats["totalDowntime"],
            "completionRate": rate,
        })

    result.sort(key=lambda x: (x["completionRate"], x["completed"]), reverse=True)
    _cache_set(cache_key, result)
    return result


@router.get("/downtime-trend")
async def downtime_trend(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(require("admin", "manager", "auditor")),
):
    target_dept = await _resolve_target_department(current, department)
    cache_key = f"downtime-trend:{target_dept or 'all'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if target_dept:
        dept_eqs = await Equipment.find(Equipment.department == target_dept).to_list()
        dept_eq_ids = [e.id for e in dept_eqs]
        wos = await WorkOrder.find({
            "equipment_id": {"$in": dept_eq_ids},
            "completed_at": {"$ne": None},
        }).to_list()
    else:
        wos = await WorkOrder.find(WorkOrder.completed_at != None).to_list()

    weekly = defaultdict(lambda: {"totalDowntimeMinutes": 0, "repaired": 0})

    for w in wos:
        dt = w.completed_at
        if dt:
            year, week, _ = dt.isocalendar()
            key = (year, week)
            weekly[key]["totalDowntimeMinutes"] += (w.downtime_minutes or 0)
            weekly[key]["repaired"] += 1

    sorted_keys = sorted(weekly.keys(), reverse=True)[:12]
    result = [
        {
            "year": k[0],
            "week": k[1],
            "totalDowntimeMinutes": weekly[k]["totalDowntimeMinutes"],
            "repaired": weekly[k]["repaired"],
        }
        for k in sorted_keys
    ]
    _cache_set(cache_key, result)
    return result
