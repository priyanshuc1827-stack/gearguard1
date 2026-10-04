from fastapi import APIRouter, HTTPException, status
from models import Equipment, Team, Request as MaintenanceRequest, User, AuditLog
from datetime import datetime, timezone

router = APIRouter()

@router.get("/high-risk")
async def get_high_risk_assets():
    try:
        all_equipment = await Equipment.find_all().to_list()
        risk_data = []
        for asset in all_equipment:
            reqs = await MaintenanceRequest.find(MaintenanceRequest.equipmentId == asset.id).to_list()
            total_duration = sum(r.duration or 0 for r in reqs)
            risk_data.append({
                "id": str(asset.id),
                "_id": str(asset.id),
                "name": asset.name,
                "serialNumber": asset.serialNumber,
                "totalRequests": len(reqs),
                "totalDuration": total_duration,
            })
        risk_data.sort(key=lambda x: x["totalRequests"], reverse=True)
        return risk_data[:5]
    except Exception as e:
        print(f"Error generating risk report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate risk report"
        )

@router.get("/team-performance")
async def get_team_performance():
    try:
        teams = await Team.find_all().to_list()
        performance_data = []
        for team in teams:
            team_eq = await Equipment.find(Equipment.maintenanceTeamId == team.id).to_list()
            eq_ids = [e.id for e in team_eq]
            repaired_count = 0
            total_downtime = 0
            if eq_ids:
                reqs = await MaintenanceRequest.find({"equipmentId": {"$in": eq_ids}}).to_list()
                repaired_count = len([r for r in reqs if r.status == "Repaired"])
                total_downtime = sum(r.duration or 0 for r in reqs)
            performance_data.append({
                "teamName": team.name,
                "repairedCount": repaired_count,
                "totalDowntime": total_downtime
            })
        return performance_data
    except Exception as e:
        print(f"Error fetching team performance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch team performance"
        )

@router.get("/summary")
async def get_summary():
    """Returns top-level KPI metrics for the auditor reporting dashboard."""
    try:
        all_reqs   = await MaintenanceRequest.find_all().to_list()
        all_assets = await Equipment.find_all().to_list()
        all_users  = await User.find_all().to_list()
        now = datetime.now(timezone.utc)

        total_requests = len(all_reqs)
        repaired    = [r for r in all_reqs if r.status == "Repaired"]
        in_progress = [r for r in all_reqs if r.status == "In Progress"]
        scrapped    = [r for r in all_reqs if r.status == "Scrap"]
        total_downtime = sum(r.duration or 0 for r in all_reqs)
        overdue = [
            r for r in all_reqs
            if r.scheduledDate and r.status not in ("Repaired", "Scrap")
            and r.scheduledDate.replace(tzinfo=timezone.utc) < now
        ]
        repair_rate = round((len(repaired) / total_requests * 100), 1) if total_requests > 0 else 0
        technicians = [u for u in all_users if u.role == "technician"]

        return {
            "totalAssets":      len(all_assets),
            "totalRequests":    total_requests,
            "repaired":         len(repaired),
            "inProgress":       len(in_progress),
            "scrapped":         len(scrapped),
            "overdue":          len(overdue),
            "totalDowntime":    total_downtime,
            "repairRate":       repair_rate,
            "totalTechnicians": len(technicians),
        }
    except Exception as e:
        print(f"Error fetching summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch summary")

@router.get("/technician-performance")
async def get_technician_performance():
    """Per-technician breakdown: assigned tasks, completed, downtime logged."""
    try:
        technicians = await User.find(User.role == "technician").to_list()
        result = []
        for tech in technicians:
            assigned = await MaintenanceRequest.find(
                MaintenanceRequest.createdBy == tech.id
            ).to_list()
            repaired = [r for r in assigned if r.status == "Repaired"]
            downtime = sum(r.duration or 0 for r in assigned)
            result.append({
                "id":        str(tech.id),
                "name":      tech.name,
                "email":     tech.email,
                "assigned":  len(assigned),
                "completed": len(repaired),
                "downtime":  downtime,
                "rate":      round(len(repaired) / len(assigned) * 100, 1) if assigned else 0,
            })
        result.sort(key=lambda x: x["completed"], reverse=True)
        return result
    except Exception as e:
        print(f"Error fetching technician performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch technician performance")
