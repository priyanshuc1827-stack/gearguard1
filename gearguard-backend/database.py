import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models import User, Team, Equipment, Request, Category, Location, AssetRequest, AuditLog

# Monkeypatch append_metadata to resolve Motor 3.7+ compatibility issues with Beanie 2.1.0
def dummy_append_metadata(*args, **kwargs):
    pass
AsyncIOMotorClient.append_metadata = dummy_append_metadata

async def init_db(database_url: str):
    client = AsyncIOMotorClient(database_url)
    db = client.get_default_database()
    if db is None or db.name == "admin":
        db = client["gearguard"]
    
    await init_beanie(
        database=db,
        document_models=[
            User, Team, Equipment, Request, Category, Location, AssetRequest, AuditLog
        ]
    )
    print(f"MongoDB connected to database: {db.name}")

async def clean_and_seed_db():
    print("Purging old messy records and seeding clean presentation dataset...")
    # Clear existing collections
    await User.find_all().delete()
    await Team.find_all().delete()
    await Equipment.find_all().delete()
    await Category.find_all().delete()
    await Location.find_all().delete()
    await Request.find_all().delete()
    await AssetRequest.find_all().delete()
    await AuditLog.find_all().delete()
    
    # 1. Create Clean Categories
    machinery_cat = await Category(name="Heavy Machinery", description="Industrial fabrication centers, CNC mills, and lathes").insert()
    compressor_cat = await Category(name="Compressors & Pneumatics", description="High-pressure air systems and hydraulic pumps").insert()
    sensors_cat = await Category(name="Sensors & Displays", description="Control room touchscreens, HMIs, and telemetric sensors").insert()
    it_cat = await Category(name="IT & Servers", description="Enterprise rack servers, blade systems, and routers").insert()
    
    # 2. Create Clean Plant Locations
    loc_workshop_a = await Location(name="Plant 1 - Workshop A", address="100 Industrial Parkway, Building 1").insert()
    loc_fab_bay = await Location(name="Plant 1 - Heavy Fabrication Bay", address="100 Industrial Parkway, West Wing").insert()
    loc_server = await Location(name="Server Center - Room B", address="100 Industrial Parkway, Climate Room B").insert()
    loc_hq = await Location(name="HQ - Operations Floor", address="500 Corporate Blvd, 3rd Floor").insert()
    
    # 3. Create Teams
    mech_team = await Team(name="Mechanical Engineering").insert()
    elec_team = await Team(name="Electronics & Robotics").insert()
    it_team = await Team(name="IT Infrastructure").insert()
    
    # 4. Create the 5 Hackathon Presentation Users (password: password123)
    admin = await User(name="Alex Vance (Admin)", email="admin@gearguard.com", password="password123", role="admin").insert()
    manager = await User(name="Sarah Jenkins (Manager)", email="manager@gearguard.com", password="password123", role="manager").insert()
    employee = await User(name="Alice Walker (Operator)", email="employee@gearguard.com", password="password123", role="user").insert()
    tech = await User(name="John Miller (Technician)", email="tech@gearguard.com", password="password123", role="technician").insert()
    auditor = await User(name="David Ross (Auditor)", email="auditor@gearguard.com", password="password123", role="auditor").insert()
    
    now = datetime.utcnow()

    # 5. Create Presentation Equipment (Assets)
    cnc = await Equipment(
        name="HAAS CNC Milling Center M2",
        serialNumber="SN-CNC-8821",
        category="Heavy Machinery",
        location="Plant 1 - Heavy Fabrication Bay",
        department="Manufacturing",
        assignedEmployee="Alice Walker (Operator)",
        lastServiceDate=now - timedelta(days=5),
        isUsable=True,
        maintenanceTeamId=mech_team.id,
        assignedTechnicianId=tech.id
    ).insert()
    
    compressor = await Equipment(
        name="Atlas Copco Industrial Compressor G11",
        serialNumber="SN-CMP-4091",
        category="Compressors & Pneumatics",
        location="Plant 1 - Workshop A",
        department="Assembly",
        assignedEmployee="Unassigned",
        lastServiceDate=now - timedelta(days=12),
        isUsable=True,
        maintenanceTeamId=mech_team.id,
        assignedTechnicianId=tech.id
    ).insert()
    
    hmi = await Equipment(
        name='Siemens Touchscreen HMI Panel 15"',
        serialNumber="SN-HMI-1204",
        category="Sensors & Displays",
        location="Plant 1 - Workshop A",
        department="Assembly",
        assignedEmployee="Unassigned",
        lastServiceDate=now - timedelta(days=30),
        isUsable=False,  # Triggers Critical Asset counter on Dashboard
        maintenanceTeamId=elec_team.id,
        assignedTechnicianId=tech.id
    ).insert()
    
    server = await Equipment(
        name="Enterprise Rack Server Blade RX-4",
        serialNumber="SN-SRV-9930",
        category="IT & Servers",
        location="Server Center - Room B",
        department="IT Infrastructure",
        assignedEmployee="Unassigned",
        lastServiceDate=now - timedelta(days=3),
        isUsable=True,
        maintenanceTeamId=it_team.id,
        assignedTechnicianId=tech.id
    ).insert()
    
    robot = await Equipment(
        name="KUKA Robotic Welder Arm KR-16",
        serialNumber="SN-ROB-7712",
        category="Heavy Machinery",
        location="Plant 1 - Heavy Fabrication Bay",
        department="Manufacturing",
        assignedEmployee="Unassigned",
        lastServiceDate=now - timedelta(days=8),
        isUsable=True,
        maintenanceTeamId=elec_team.id,
        assignedTechnicianId=tech.id
    ).insert()
    
    # 6. Create Balanced Maintenance Requests Across Kanban Stages
    # Stage: NEW
    await Request(
        subject="Fix hydraulic pressure drop on Robotic Welder KR-16",
        type="Corrective",
        status="New",
        equipmentId=robot.id,
        createdBy=tech.id,
        scheduledDate=now,
        duration=0.0
    ).insert()
    
    await Request(
        subject="Calibrate HMI Touchscreen display sensors",
        type="Preventive",
        status="New",
        equipmentId=hmi.id,
        createdBy=tech.id,
        scheduledDate=now + timedelta(days=1),
        duration=0.0
    ).insert()
    
    # Stage: IN PROGRESS
    await Request(
        subject="CNC 5-Axis Precision Recalibration & Coolant Flush",
        type="Preventive",
        status="In Progress",
        equipmentId=cnc.id,
        createdBy=tech.id,
        scheduledDate=now,
        duration=2.5
    ).insert()
    
    # Stage: REPAIRED
    await Request(
        subject="Compressor intake valve gasket replacement",
        type="Corrective",
        status="Repaired",
        equipmentId=compressor.id,
        createdBy=tech.id,
        scheduledDate=now - timedelta(days=2),
        duration=1.5
    ).insert()
    
    await Request(
        subject="Replace Server Blade RX-4 backup battery units",
        type="Preventive",
        status="Repaired",
        equipmentId=server.id,
        createdBy=tech.id,
        scheduledDate=now - timedelta(days=3),
        duration=1.0
    ).insert()
    
    # Stage: SCRAP (shows decommissioned unit)
    await Request(
        subject="Decommission burnt-out sensor board on HMI unit",
        type="Corrective",
        status="Scrap",
        equipmentId=hmi.id,
        createdBy=tech.id,
        scheduledDate=now - timedelta(days=1),
        duration=3.0
    ).insert()
    
    # 7. Create Asset Requests (Perfect for Live Manager Approval Demo)
    await AssetRequest(
        employeeId=employee.id,
        assetName="Atlas Copco Industrial Compressor G11",
        category="Compressors & Pneumatics",
        reason="Need high-pressure air supply for pneumatic tool testing on Assembly Line A",
        status="Pending",  # Presenter can log in as Manager & click Approve!
        requestDate=now - timedelta(hours=2)
    ).insert()
    
    await AssetRequest(
        employeeId=employee.id,
        assetName="High-Precision CNC Tooling Set",
        category="Heavy Machinery",
        reason="Replacement carbide drill bits for precision milling run",
        status="Approved",
        requestDate=now - timedelta(days=1),
        approvalDate=now - timedelta(hours=18)
    ).insert()
    
    # 8. Create Realistic Audit Ledger Entries
    await AuditLog(
        userId=admin.id,
        action="System Seeded",
        details="GearGuard enterprise asset ledger initialized with calibrated plant sites and equipment.",
        timestamp=now - timedelta(days=3)
    ).insert()
    
    await AuditLog(
        userId=manager.id,
        action="Approve Request",
        details="Approved tooling set request for Alice Walker (Assembly Line A).",
        timestamp=now - timedelta(hours=18)
    ).insert()
    
    await AuditLog(
        userId=tech.id,
        action="Allocate Asset",
        details="Assigned HAAS CNC Milling Center M2 to Alice Walker for manufacturing run.",
        timestamp=now - timedelta(days=5)
    ).insert()
    
    await AuditLog(
        userId=auditor.id,
        action="Safety Audit",
        details="Quarterly ISO 55001 compliance audit completed. Plant 1 assets inspected and verified.",
        timestamp=now - timedelta(hours=6)
    ).insert()
    
    print("Database cleaned and seeded with presentation-ready dataset successfully!")

async def seed_db():
    # Only seed if no equipment exists yet
    count = await Equipment.count()
    if count == 0:
        await clean_and_seed_db()
    else:
        print(f"Database already has {count} equipment records.")

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv
    load_dotenv()
    url = os.getenv("DATABASE_URL") or os.getenv("MONGO_URI")
    if not url:
        print("❌ DATABASE_URL or MONGO_URI not found in .env")
    else:
        async def main():
            await init_db(url)
            await clean_and_seed_db()
        asyncio.run(main())

