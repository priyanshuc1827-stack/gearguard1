"""
app/seed.py — Comprehensive Real-Time Enterprise Database Seed for GearGuard.
Populates all 6 industrial departments (Machining, Production, Assembly, Facilities, Logistics, Quality Control)
with complete operational data:
- 38 Users (Admins, Department Managers, Technicians, Auditors, Operators)
- 81 Industrial Machinery & Equipment items (assigned & unassigned across all departments)
- 80+ Asset Requests & Custody Records (Active allocations, returned logs, pending, approved)
- 105+ Work Orders & Complaints (New, In Progress, Repaired, Scrap; Calendar/Schedule spread)
- 60+ Audit Logs tracking plant telemetry and events
- Counter sequence synchronization

Run: python -m app.seed
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.core.database import init_db
from app.core.security import hash_password
from app.models.user import User
from app.models.enums import UserRole, WorkOrderStatus, Priority, WorkOrderType, AssetRequestStatus
from app.models.equipment import Equipment
from app.models.work_order import WorkOrder, Comment
from app.models.asset_request import AssetRequest
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.location import Location
from app.models.team import Team
from app.models.counter import Counter


DEPARTMENTS = ["Machining", "Production", "Assembly", "Facilities", "Logistics", "Quality Control"]

CATEGORIES_DATA = [
    ("Hydraulics & Fluid Power", "Hydraulic power units, directional valves, proportional manifolds, and high-pressure fluid lines"),
    ("Electrical & Controls", "Switchgear, motor control centers (MCC), transformers, PLCs, and VFDs"),
    ("HVAC & Cooling", "Water-cooled chillers, cooling towers, air handling units, and industrial exhaust systems"),
    ("Conveyor & Handling", "Belt conveyors, roller accumulation lines, palletizers, and overhead crane hoists"),
    ("Pumps & Piping", "Centrifugal slurry pumps, positive displacement gear pumps, and plant process piping"),
    ("Compressors & Pneumatics", "Rotary screw air compressors, refrigerated air dryers, and pneumatic manifolds"),
    ("Robotics & Automation", "6-Axis articulated robotic arms, SCARA pick-and-place units, and AGV tuggers"),
    ("Vehicles & Transport", "Electric forklifts, reach trucks, order pickers, and internal tuggers"),
    ("Safety & Environmental", "Emergency eye-wash stations, fire suppression systems, and gas leak monitoring sensors"),
    ("CNC & Machining Centers", "5-Axis vertical machining centers, CNC lathes, and wire EDM fabrication units"),
    ("Metrology & Inspection", "Coordinate measuring machines (CMM), optical comparators, and non-destructive testing tools"),
]

LOCATIONS_DATA = [
    ("Machining Bay Alpha", "Building 1, East Industrial Complex"),
    ("Main Production Hall", "Building 2, Level 1 Main Concourse"),
    ("Robotic Assembly Line 4", "Building 3, Automated Cell Bay"),
    ("Central Utility Yard", "Exterior Enclosure, North Perimeter"),
    ("Logistics Staging & High-Bay", "Building 5, Docks 1-8"),
    ("Quality Control Cleanroom", "Building 2, Level 2 Controlled Environment"),
    ("Central Maintenance Workshop", "Central Bay 8 Support Wing"),
]

TEAMS_DATA = [
    ("Alpha Rapid Response", "Emergency breakdown triage and critical downtime resolution"),
    ("Beta Mechanical & Hydraulics", "Heavy machinery, piping, fluid systems, and mechanical alignments"),
    ("Gamma Electrical & Controls", "Automation, PLC diagnostics, high-voltage switchgear, and sensors"),
    ("Delta Preventive Maintenance", "Scheduled inspections, lubrication rounds, filter replacements, and calibrations"),
]

EQUIPMENT_DATA = [
    # Machining (13 assets)
    ("Mazak Quick Turn 250 CNC Lathe", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-MTC-2024-001"),
    ("Haas VF-4 5-Axis CNC Mill", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-HVF-2023-088"),
    ("Makino PS105 Vertical Machining Center", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-MAK-2024-112"),
    ("Doosan Puma 2600Y Turning Center", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-DSP-2022-441"),
    ("Okuma Multus U3000 Multi-Function Lathe", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-OKM-2024-300"),
    ("Chevalier Falcon Surface Grinder 1224", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-CHV-2023-122"),
    ("Mitsubishi MV2400-S Wire EDM Machine", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-MIT-2024-240"),
    ("Parker Hannifin 2000 PSI Hydraulic Power Unit", "Hydraulics & Fluid Power", "Machining", "Machining Bay Alpha", "SN-PKH-2023-909"),
    ("Hermle C 42 U MT 5-Axis Machining Center", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-HRM-2024-042"),
    ("DMG Mori NLX 2500 High-Precision Lathe", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-DMG-2023-250"),
    ("Sodick ALC600G High-Speed EDM Sinker", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-SDK-2022-600"),
    ("Coolant Filtration & Tramp Oil Skimmer", "Safety & Environmental", "Machining", "Machining Bay Alpha", "SN-CFT-2024-019"),
    ("Kellenberger 100 Universal Cylindrical Grinder", "CNC & Machining Centers", "Machining", "Machining Bay Alpha", "SN-KLB-2023-100"),

    # Production (16 assets)
    ("Viking Mag Drive Internal Gear Pump", "Pumps & Piping", "Production", "Main Production Hall", "SN-VKM-2023-118"),
    ("Bosch Rexroth 4WE Directional Control Manifold", "Hydraulics & Fluid Power", "Production", "Main Production Hall", "SN-BRX-2024-554"),
    ("Goulds 3196 Chemical Process Pump", "Pumps & Piping", "Production", "Main Production Hall", "SN-GLD-2022-319"),
    ("Trumpf TruLaser 3030 Sheet Cutting Cell", "CNC & Machining Centers", "Production", "Main Production Hall", "SN-TRU-2024-880"),
    ("Cincinnati 175-Ton Hydraulic Press Brake", "Hydraulics & Fluid Power", "Production", "Main Production Hall", "SN-CIN-2023-712"),
    ("Amada VIPROS 358 King CNC Turret Punch Press", "CNC & Machining Centers", "Production", "Main Production Hall", "SN-AMD-2023-358"),
    ("Toyo SI-150-6 All-Electric Injection Molding Machine", "Electrical & Controls", "Production", "Main Production Hall", "SN-TYO-2024-150"),
    ("Nordson Industrial Powder Coating Booth", "Safety & Environmental", "Production", "Main Production Hall", "SN-NRD-2022-808"),
    ("Lincoln Electric Robotic TIG Welding Cell", "Robotics & Automation", "Production", "Main Production Hall", "SN-LNC-2024-500"),
    ("Ametek Continuous Conveyor Tempering Oven", "Electrical & Controls", "Production", "Main Production Hall", "SN-AMK-2023-420"),
    ("Sulzer Ahlstar High-Volume Centrifugal Slurry Pump", "Pumps & Piping", "Production", "Main Production Hall", "SN-SLZ-2023-911"),
    ("Komatsu 200-Ton Heavy Stamping Press", "Hydraulics & Fluid Power", "Production", "Main Production Hall", "SN-KMT-2024-200"),
    ("Bystronic Xpert Pro 150 Precision Press Brake", "Hydraulics & Fluid Power", "Production", "Main Production Hall", "SN-BYS-2024-150"),
    ("KraussMaffei CX 200 High-Pressure Injection Unit", "Hydraulics & Fluid Power", "Production", "Main Production Hall", "SN-KRM-2023-200"),
    ("Fluid Systems High-Pressure Industrial De-greaser", "Safety & Environmental", "Production", "Main Production Hall", "SN-FSD-2024-077"),
    ("Waukesha Cherry-Burrell Positive Displacement Pump", "Pumps & Piping", "Production", "Main Production Hall", "SN-WCB-2022-060"),

    # Assembly (13 assets)
    ("Fanuc M-20iD/25 6-Axis Robotic Arm", "Robotics & Automation", "Assembly", "Robotic Assembly Line 4", "SN-FNC-2024-009"),
    ("KUKA KR CYBERTECH Handling Robot", "Robotics & Automation", "Assembly", "Robotic Assembly Line 4", "SN-KUK-2023-331"),
    ("ABB IRB 6700 Spot Welding Robot", "Robotics & Automation", "Assembly", "Robotic Assembly Line 4", "SN-ABB-2024-670"),
    ("Siemens S7-1500 PLC Automation Station", "Electrical & Controls", "Assembly", "Robotic Assembly Line 4", "SN-SMS-2024-150"),
    ("Dorner 2200 Series Modular Belt Conveyor", "Conveyor & Handling", "Assembly", "Robotic Assembly Line 4", "SN-DRN-2023-220"),
    ("Atlas Copco Tensor Reversible Electric Nutrunner Station", "Electrical & Controls", "Assembly", "Robotic Assembly Line 4", "SN-ATC-2024-104"),
    ("Branson 2000X Ultrasonic Plastic Welder", "Electrical & Controls", "Assembly", "Robotic Assembly Line 4", "SN-BRN-2023-200"),
    ("Yaskawa Motoman GP12 High-Speed Handling Robot", "Robotics & Automation", "Assembly", "Robotic Assembly Line 4", "SN-YSK-2024-012"),
    ("Cognex In-Sight 8405 Vision Inspection System", "Metrology & Inspection", "Assembly", "Robotic Assembly Line 4", "SN-CGX-2024-840"),
    ("Desoutter Multi-Spindle Tightening Bench", "Electrical & Controls", "Assembly", "Robotic Assembly Line 4", "SN-DST-2023-018"),
    ("FlexLink X45 Automated Pallet Transport Track", "Conveyor & Handling", "Assembly", "Robotic Assembly Line 4", "SN-FLX-2023-045"),
    ("Universal Robots UR10e Collaborative Robot", "Robotics & Automation", "Assembly", "Robotic Assembly Line 4", "SN-URB-2024-010"),
    ("Pneumatic Press Fit Assembly Station AP-10", "Compressors & Pneumatics", "Assembly", "Robotic Assembly Line 4", "SN-PNP-2022-010"),

    # Facilities (14 assets)
    ("Atlas Copco GA75 Rotary Screw Compressor", "Compressors & Pneumatics", "Facilities", "Central Utility Yard", "SN-ATC-2024-750"),
    ("Kaeser CSD 125 Refrigerated Air Dryer", "Compressors & Pneumatics", "Facilities", "Central Utility Yard", "SN-KSR-2023-125"),
    ("Carrier 150-Ton Water-Cooled Chiller", "HVAC & Cooling", "Facilities", "Central Utility Yard", "SN-CAR-2022-150"),
    ("Trane IntelliPak Industrial Air Handler", "HVAC & Cooling", "Facilities", "Central Utility Yard", "SN-TRN-2023-991"),
    ("Grundfos CRN 32 High-Pressure Inline Pump", "Pumps & Piping", "Facilities", "Central Utility Yard", "SN-GRN-2024-032"),
    ("Kidde Argonite Clean Agent Fire Suppression", "Safety & Environmental", "Facilities", "Central Utility Yard", "SN-KID-2023-404"),
    ("Cleaver-Brooks 250 HP Industrial Steam Boiler", "HVAC & Cooling", "Facilities", "Central Utility Yard", "SN-CBK-2023-250"),
    ("Cummins 750kVA Standby Diesel Generator", "Electrical & Controls", "Facilities", "Central Utility Yard", "SN-CUM-2022-750"),
    ("Eaton 13.8kV Medium Voltage Switchgear Unit", "Electrical & Controls", "Facilities", "Central Utility Yard", "SN-ETN-2024-138"),
    ("Parker Balston High-Purity Nitrogen Generator", "Compressors & Pneumatics", "Facilities", "Central Utility Yard", "SN-PBN-2023-080"),
    ("Marley NC Crossflow Cooling Tower Cell 2", "HVAC & Cooling", "Facilities", "Central Utility Yard", "SN-MRL-2023-002"),
    ("Donaldson Torit Dust & Fume Collector DB-40", "Safety & Environmental", "Facilities", "Central Utility Yard", "SN-DNL-2024-040"),
    ("Spirax Sarco Steam Pressure Reduction Station", "HVAC & Cooling", "Facilities", "Central Utility Yard", "SN-SPR-2022-110"),
    ("Schneider Electric 2500A Main Power Busway", "Electrical & Controls", "Facilities", "Central Utility Yard", "SN-SCH-2024-250"),

    # Logistics (13 assets)
    ("Crown FC 5200 Electric Counterbalance Forklift", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-CRN-2024-520"),
    ("Toyota 8FBE20 High-Reach Order Picker", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-TYT-2023-882"),
    ("Demag 5-Ton Electric Overhead Crane", "Conveyor & Handling", "Logistics", "Logistics Staging & High-Bay", "SN-DMG-2022-500"),
    ("Hyster J35XNT 3-Wheel Electric Forklift", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-HYS-2024-350"),
    ("Hytrol 190-E24V Zero-Pressure Accumulation Conveyor", "Conveyor & Handling", "Logistics", "Logistics Staging & High-Bay", "SN-HYT-2023-190"),
    ("Lantech Q-300 Semi-Automatic Pallet Stretch Wrapper", "Conveyor & Handling", "Logistics", "Logistics Staging & High-Bay", "SN-LNT-2024-300"),
    ("Jungheinrich ETV 216 Reach Truck 1600kg", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-JNG-2023-216"),
    ("Bito Automated Guided Vehicle AGV Tugger #4", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-BTO-2024-004"),
    ("Rite-Hite Hydraulic Heavy-Duty Dock Leveler DL-1", "Conveyor & Handling", "Logistics", "Logistics Staging & High-Bay", "SN-RTH-2022-001"),
    ("Raymond 7500 Deep-Reach Electric Forklift", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-RYM-2024-750"),
    ("Interlake Mecalux Automated Storage Crane (ASRS)", "Conveyor & Handling", "Logistics", "Logistics Staging & High-Bay", "SN-IMX-2023-888"),
    ("Genie GS-1930 Electric Scissor Lift 20ft", "Vehicles & Transport", "Logistics", "Logistics Staging & High-Bay", "SN-GEN-2024-193"),
    ("Nilfisk Viper Industrial Floor Ride-on Scrubber", "Safety & Environmental", "Logistics", "Logistics Staging & High-Bay", "SN-NLF-2023-050"),

    # Quality Control (12 assets)
    ("Zeiss Contura 3D Coordinate Measuring Machine", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-ZSS-2024-301"),
    ("Mitutoyo PH-A14 Optical Horizontal Comparator", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-MTY-2023-140"),
    ("Olympus OmniScan X3 Phased Array Flaw Detector", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-OLY-2024-802"),
    ("Thermo Scientific Niton XL5 Plus XRF Analyzer", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-THM-2023-550"),
    ("Instron 5985 250kN Universal Tensile Testing System", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-INS-2024-598"),
    ("Wilson Rockwell 574 Hardness Tester", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-WLS-2023-574"),
    ("Keyence VR-5000 3D Wide-Area Macro Profilometer", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-KYN-2024-500"),
    ("Mitutoyo Surftest SJ-410 Surface Roughness Tester", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-MSJ-2023-410"),
    ("Horiba LA-960 Laser Particle Size Analyzer", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-HRB-2022-960"),
    ("Fluke 8588A Reference Multimeter Calibration Bench", "Electrical & Controls", "Quality Control", "Quality Control Cleanroom", "SN-FLK-2024-858"),
    ("Faro Quantum Max ScanArm 3D Laser Scanner", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-FAR-2023-900"),
    ("Brabender Moisture & Viscosity Density Analyzer", "Metrology & Inspection", "Quality Control", "Quality Control Cleanroom", "SN-BRB-2022-120"),
]


EMPLOYEE_ALLOCATIONS = {
    # Production
    "Viking Mag Drive Internal Gear Pump": "priyanshuc675@gmail.com",
    "Cincinnati 175-Ton Hydraulic Press Brake": "priyanshuc675@gmail.com",
    "Trumpf TruLaser 3030 Sheet Cutting Cell": "priyanshuc675@gmail.com",
    "Bosch Rexroth 4WE Directional Control Manifold": "priyanshuc6@gmail.com",
    "Amada VIPROS 358 King CNC Turret Punch Press": "priyanshuc6@gmail.com",
    "Lincoln Electric Robotic TIG Welding Cell": "priyanshuc6@gmail.com",
    "Goulds 3196 Chemical Process Pump": "employee@gearguard.com",
    "Toyo SI-150-6 All-Electric Injection Molding Machine": "employee@gearguard.com",
    "Nordson Industrial Powder Coating Booth": "employee@gearguard.com",
    "Komatsu 200-Ton Heavy Stamping Press": "ananya.deshmukh@gearguard.com",
    "Ametek Continuous Conveyor Tempering Oven": "ananya.deshmukh@gearguard.com",
    "Bystronic Xpert Pro 150 Precision Press Brake": "diego.ramirez@gearguard.com",
    "KraussMaffei CX 200 High-Pressure Injection Unit": "diego.ramirez@gearguard.com",

    # Machining
    "Mazak Quick Turn 250 CNC Lathe": "jane@gearguard.com",
    "Okuma Multus U3000 Multi-Function Lathe": "jane@gearguard.com",
    "Chevalier Falcon Surface Grinder 1224": "jane@gearguard.com",
    "Haas VF-4 5-Axis CNC Mill": "tom.jenkins@gearguard.com",
    "Makino PS105 Vertical Machining Center": "tom.jenkins@gearguard.com",
    "Doosan Puma 2600Y Turning Center": "vikas.sharma@gearguard.com",
    "Mitsubishi MV2400-S Wire EDM Machine": "vikas.sharma@gearguard.com",
    "Hermle C 42 U MT 5-Axis Machining Center": "elena.popova@gearguard.com",
    "DMG Mori NLX 2500 High-Precision Lathe": "elena.popova@gearguard.com",

    # Assembly
    "Fanuc M-20iD/25 6-Axis Robotic Arm": "bob@gearguard.com",
    "Atlas Copco Tensor Reversible Electric Nutrunner Station": "bob@gearguard.com",
    "Branson 2000X Ultrasonic Plastic Welder": "bob@gearguard.com",
    "KUKA KR CYBERTECH Handling Robot": "rachel.green@gearguard.com",
    "Yaskawa Motoman GP12 High-Speed Handling Robot": "rachel.green@gearguard.com",
    "ABB IRB 6700 Spot Welding Robot": "kyle.walker@gearguard.com",
    "Siemens S7-1500 PLC Automation Station": "kyle.walker@gearguard.com",
    "Cognex In-Sight 8405 Vision Inspection System": "sophia.chen@gearguard.com",
    "Universal Robots UR10e Collaborative Robot": "sophia.chen@gearguard.com",

    # Facilities
    "Atlas Copco GA75 Rotary Screw Compressor": "david.kim@gearguard.com",
    "Trane IntelliPak Industrial Air Handler": "david.kim@gearguard.com",
    "Grundfos CRN 32 High-Pressure Inline Pump": "david.kim@gearguard.com",
    "Kaeser CSD 125 Refrigerated Air Dryer": "lucas.gray@gearguard.com",
    "Cleaver-Brooks 250 HP Industrial Steam Boiler": "lucas.gray@gearguard.com",
    "Carrier 150-Ton Water-Cooled Chiller": "sophie.martin@gearguard.com",
    "Parker Balston High-Purity Nitrogen Generator": "sophie.martin@gearguard.com",

    # Logistics
    "Crown FC 5200 Electric Counterbalance Forklift": "maria.santos@gearguard.com",
    "Lantech Q-300 Semi-Automatic Pallet Stretch Wrapper": "maria.santos@gearguard.com",
    "Demag 5-Ton Electric Overhead Crane": "maria.santos@gearguard.com",
    "Toyota 8FBE20 High-Reach Order Picker": "ahmed.hassan@gearguard.com",
    "Hytrol 190-E24V Zero-Pressure Accumulation Conveyor": "ahmed.hassan@gearguard.com",
    "Hyster J35XNT 3-Wheel Electric Forklift": "jake.sullivan@gearguard.com",
    "Jungheinrich ETV 216 Reach Truck 1600kg": "jake.sullivan@gearguard.com",

    # Quality Control
    "Zeiss Contura 3D Coordinate Measuring Machine": "claire.bennett@gearguard.com",
    "Olympus OmniScan X3 Phased Array Flaw Detector": "claire.bennett@gearguard.com",
    "Instron 5985 250kN Universal Tensile Testing System": "claire.bennett@gearguard.com",
    "Mitutoyo PH-A14 Optical Horizontal Comparator": "vikram.mehta@gearguard.com",
    "Wilson Rockwell 574 Hardness Tester": "vikram.mehta@gearguard.com",
    "Thermo Scientific Niton XL5 Plus XRF Analyzer": "olivia.wong@gearguard.com",
    "Keyence VR-5000 3D Wide-Area Macro Profilometer": "olivia.wong@gearguard.com",
}


async def seed_database():
    await init_db()
    print("GearGuard: Initiating complete fresh high-density database rebuild...")

    # Drop existing collections completely
    print("Dropping existing collections...")
    for model in [User, Equipment, WorkOrder, AssetRequest, AuditLog, Category, Location, Team, Counter]:
        await model.get_motor_collection().drop()
    print("All collections dropped clean.")

    # 1. Categories, Locations, Teams
    print("Seeding Categories, Locations, and Maintenance Teams...")
    category_map = {}
    for name, desc in CATEGORIES_DATA:
        c = Category(name=name, description=desc)
        await c.insert()
        category_map[name] = c

    location_map = {}
    for name, addr in LOCATIONS_DATA:
        loc = Location(name=name, address=addr)
        await loc.insert()
        location_map[name] = loc

    team_docs = []
    for name, desc in TEAMS_DATA:
        t = Team(name=name, description=desc)
        await t.insert()
        team_docs.append(t)

    hashed_pw = hash_password("password123")

    # 2. Users grouped by department
    print("Seeding 38 Users across all 6 departments...")
    users_to_create = [
        # Administrator
        {"name": "System Administrator", "email": "admin@gearguard.com", "role": UserRole.admin, "department": "All"},

        # Department Managers
        {"name": "Sarah Chen", "email": "manager@gearguard.com", "role": UserRole.manager, "department": "Production"},
        {"name": "Sarah Chen", "email": "manager.production@gearguard.com", "role": UserRole.manager, "department": "Production"},
        {"name": "Robert Vance", "email": "manager.machining@gearguard.com", "role": UserRole.manager, "department": "Machining"},
        {"name": "Michael Chang", "email": "manager.assembly@gearguard.com", "role": UserRole.manager, "department": "Assembly"},
        {"name": "David Miller", "email": "manager.facilities@gearguard.com", "role": UserRole.manager, "department": "Facilities"},
        {"name": "Elena Rostova", "email": "manager.logistics@gearguard.com", "role": UserRole.manager, "department": "Logistics"},
        {"name": "Kavita Sharma", "email": "manager.qc@gearguard.com", "role": UserRole.manager, "department": "Quality Control"},

        # Technicians
        {"name": "Marcus Sterling", "email": "tech@gearguard.com", "role": UserRole.technician, "department": "Production"},
        {"name": "Carlos Gomez", "email": "tech.production@gearguard.com", "role": UserRole.technician, "department": "Production"},
        {"name": "Dmitri Volkov", "email": "tech.production2@gearguard.com", "role": UserRole.technician, "department": "Production"},
        {"name": "Alex Rivera", "email": "tech.machining@gearguard.com", "role": UserRole.technician, "department": "Machining"},
        {"name": "Liam O'Connor", "email": "tech.machining2@gearguard.com", "role": UserRole.technician, "department": "Machining"},
        {"name": "Kenji Sato", "email": "tech.assembly@gearguard.com", "role": UserRole.technician, "department": "Assembly"},
        {"name": "Matteo Rossi", "email": "tech.assembly2@gearguard.com", "role": UserRole.technician, "department": "Assembly"},
        {"name": "Lucas Vance", "email": "tech.facilities@gearguard.com", "role": UserRole.technician, "department": "Facilities"},
        {"name": "Frank Kowalski", "email": "tech.facilities2@gearguard.com", "role": UserRole.technician, "department": "Facilities"},
        {"name": "Samir Patel", "email": "tech.logistics@gearguard.com", "role": UserRole.technician, "department": "Logistics"},
        {"name": "Brandon Lee", "email": "tech.logistics2@gearguard.com", "role": UserRole.technician, "department": "Logistics"},
        {"name": "Priya Nair", "email": "tech.qc@gearguard.com", "role": UserRole.technician, "department": "Quality Control"},
        {"name": "Hanna Berg", "email": "tech.qc2@gearguard.com", "role": UserRole.technician, "department": "Quality Control"},

        # Auditors
        {"name": "Arthur Dent", "email": "auditor@gearguard.com", "role": UserRole.auditor, "department": "Quality Control"},
        {"name": "Emma Watson", "email": "auditor.facilities@gearguard.com", "role": UserRole.auditor, "department": "Facilities"},
        {"name": "Nathan Drake", "email": "auditor.production@gearguard.com", "role": UserRole.auditor, "department": "Production"},
        {"name": "Grace Hopper", "email": "auditor.machining@gearguard.com", "role": UserRole.auditor, "department": "Machining"},

        # Employees (Operators) per department
        # Production
        {"name": "Priyanshu Chaudhari", "email": "priyanshuc675@gmail.com", "role": UserRole.user, "department": "Production"},
        {"name": "Priyanshu C", "email": "priyanshuc6@gmail.com", "role": UserRole.user, "department": "Production"},
        {"name": "John Operator", "email": "employee@gearguard.com", "role": UserRole.user, "department": "Production"},
        {"name": "Ananya Deshmukh", "email": "ananya.deshmukh@gearguard.com", "role": UserRole.user, "department": "Production"},
        {"name": "Diego Ramirez", "email": "diego.ramirez@gearguard.com", "role": UserRole.user, "department": "Production"},

        # Machining
        {"name": "Jane Doe", "email": "jane@gearguard.com", "role": UserRole.user, "department": "Machining"},
        {"name": "Tom Jenkins", "email": "tom.jenkins@gearguard.com", "role": UserRole.user, "department": "Machining"},
        {"name": "Vikas Sharma", "email": "vikas.sharma@gearguard.com", "role": UserRole.user, "department": "Machining"},
        {"name": "Elena Popova", "email": "elena.popova@gearguard.com", "role": UserRole.user, "department": "Machining"},

        # Assembly
        {"name": "Bob Smith", "email": "bob@gearguard.com", "role": UserRole.user, "department": "Assembly"},
        {"name": "Rachel Green", "email": "rachel.green@gearguard.com", "role": UserRole.user, "department": "Assembly"},
        {"name": "Kyle Walker", "email": "kyle.walker@gearguard.com", "role": UserRole.user, "department": "Assembly"},
        {"name": "Sophia Chen", "email": "sophia.chen@gearguard.com", "role": UserRole.user, "department": "Assembly"},

        # Facilities
        {"name": "David Kim", "email": "david.kim@gearguard.com", "role": UserRole.user, "department": "Facilities"},
        {"name": "Lucas Gray", "email": "lucas.gray@gearguard.com", "role": UserRole.user, "department": "Facilities"},
        {"name": "Sophie Martin", "email": "sophie.martin@gearguard.com", "role": UserRole.user, "department": "Facilities"},

        # Logistics
        {"name": "Maria Santos", "email": "maria.santos@gearguard.com", "role": UserRole.user, "department": "Logistics"},
        {"name": "Ahmed Hassan", "email": "ahmed.hassan@gearguard.com", "role": UserRole.user, "department": "Logistics"},
        {"name": "Jake Sullivan", "email": "jake.sullivan@gearguard.com", "role": UserRole.user, "department": "Logistics"},

        # Quality Control
        {"name": "Claire Bennett", "email": "claire.bennett@gearguard.com", "role": UserRole.user, "department": "Quality Control"},
        {"name": "Vikram Mehta", "email": "vikram.mehta@gearguard.com", "role": UserRole.user, "department": "Quality Control"},
        {"name": "Olivia Wong", "email": "olivia.wong@gearguard.com", "role": UserRole.user, "department": "Quality Control"},
    ]

    user_map = {}
    for udata in users_to_create:
        u = User(
            name=udata["name"],
            email=udata["email"],
            password=hashed_pw,
            role=udata["role"],
            department=udata["department"],
        )
        await u.insert()
        user_map[udata["email"]] = u

    # 3. Seed Equipment (81 items)
    print("Seeding 81 Machinery & Equipment items across all departments...")
    eq_counter = 1
    equipment_docs = []
    equipment_by_name = {}

    now = datetime.now(tz=timezone.utc)

    for name, category, dept, location, serial in EQUIPMENT_DATA:
        human_id = f"AST-{eq_counter:04d}"
        eq_counter += 1

        assigned_emp_email = EMPLOYEE_ALLOCATIONS.get(name)
        if assigned_emp_email and assigned_emp_email in user_map:
            assigned_user = user_map[assigned_emp_email]
            assigned_name = f"{assigned_user.name} ({assigned_user.department})"
            assigned_id = assigned_user.id
        else:
            assigned_name = "Unassigned"
            assigned_id = None

        cat_obj = category_map.get(category)
        loc_obj = location_map.get(location)

        eq = Equipment(
            name=name,
            human_id=human_id,
            serial_number=serial,
            department=dept,
            category=category,
            category_id=cat_obj.id if cat_obj else None,
            location=location,
            location_id=loc_obj.id if loc_obj else None,
            maintenance_team_id=random.choice(team_docs).id,
            assigned_employee=assigned_name,
            assigned_employee_id=assigned_id,
            last_service_date=now - timedelta(days=random.randint(5, 45)),
            is_usable=True,
            created_at=now - timedelta(days=random.randint(60, 180)),
        )
        await eq.insert()
        equipment_docs.append(eq)
        equipment_by_name[name] = eq

    # 4. Seed Asset Requests & Custody Records
    print("Seeding Asset Requests and Custody Records (Active, Returned, Pending, Approved)...")
    
    # 4a. Active allocations (one for each assigned piece of equipment)
    for eq in equipment_docs:
        if eq.assigned_employee_id:
            assigned_user = await User.get(eq.assigned_employee_id)
            if assigned_user:
                alloc_date = now - timedelta(days=random.randint(4, 35), hours=random.randint(1, 12))
                ar = AssetRequest(
                    employee_id=assigned_user.id,
                    asset_name=eq.name,
                    category=eq.category,
                    reason=f"Dedicated production workstation assignment for {eq.department} shift operations.",
                    status=AssetRequestStatus.allocated,
                    allocated_asset_id=eq.id,
                    request_date=alloc_date - timedelta(days=2),
                    approval_date=alloc_date - timedelta(days=1),
                    allocated_date=alloc_date,
                    return_date=None,
                )
                await ar.insert()

    # 4b. Historical Returned Custody Records (25 records)
    returned_samples = [
        # Machining
        ("Sodick ALC600G High-Speed EDM Sinker", "Machining", "jane@gearguard.com", 65, 14, "Batch prototype wire sinking run"),
        ("Coolant Filtration & Tramp Oil Skimmer", "Machining", "tom.jenkins@gearguard.com", 70, 21, "Temporary coolant tank filtration round"),
        ("Kellenberger 100 Universal Cylindrical Grinder", "Machining", "vikas.sharma@gearguard.com", 45, 9, "Precision pin grinding run"),
        ("DMG Mori NLX 2500 High-Precision Lathe", "Machining", "elena.popova@gearguard.com", 80, 25, "Spindle flange production backlog"),

        # Production
        ("Sulzer Ahlstar High-Volume Centrifugal Slurry Pump", "Production", "priyanshuc675@gmail.com", 50, 12, "Acid wash transfer bypass circuit"),
        ("Waukesha Cherry-Burrell Positive Displacement Pump", "Production", "priyanshuc675@gmail.com", 40, 7, "High-viscosity syrup test pumping run"),
        ("Fluid Systems High-Pressure Industrial De-greaser", "Production", "priyanshuc6@gmail.com", 60, 18, "Sub-component chemical de-greasing bath"),
        ("Nordson Industrial Powder Coating Booth", "Production", "priyanshuc6@gmail.com", 90, 30, "Specialty matte black powder run"),
        ("Ametek Continuous Conveyor Tempering Oven", "Production", "employee@gearguard.com", 55, 15, "Heat treatment annealing cycle"),
        ("Komatsu 200-Ton Heavy Stamping Press", "Production", "ananya.deshmukh@gearguard.com", 75, 22, "Door panel structural stamping quota"),
        ("KraussMaffei CX 200 High-Pressure Injection Unit", "Production", "diego.ramirez@gearguard.com", 35, 5, "Automotive nylon connector tooling test"),

        # Assembly
        ("Desoutter Multi-Spindle Tightening Bench", "Assembly", "bob@gearguard.com", 42, 11, "Chassis bracket torque rundown batch"),
        ("FlexLink X45 Automated Pallet Transport Track", "Assembly", "bob@gearguard.com", 85, 28, "Line 2 bypass conveyor configuration"),
        ("Universal Robots UR10e Collaborative Robot", "Assembly", "rachel.green@gearguard.com", 60, 16, "Screwdriving cobot trial cell"),
        ("Pneumatic Press Fit Assembly Station AP-10", "Assembly", "kyle.walker@gearguard.com", 50, 10, "Bushing press fit cycle for powertrain"),
        ("Cognex In-Sight 8405 Vision Inspection System", "Assembly", "sophia.chen@gearguard.com", 30, 4, "High-speed OCR label verification pilot"),

        # Facilities
        ("Parker Balston High-Purity Nitrogen Generator", "Facilities", "david.kim@gearguard.com", 70, 19, "Laser cutter assist gas backup"),
        ("Donaldson Torit Dust & Fume Collector DB-40", "Facilities", "lucas.gray@gearguard.com", 65, 14, "Grinding shop dust extraction audit"),
        ("Schneider Electric 2500A Main Power Busway", "Facilities", "sophie.martin@gearguard.com", 90, 35, "Substation 3 feeder tie breaker maintenance"),

        # Logistics
        ("Raymond 7500 Deep-Reach Electric Forklift", "Logistics", "maria.santos@gearguard.com", 55, 15, "High-density warehouse seasonal racking"),
        ("Interlake Mecalux Automated Storage Crane (ASRS)", "Logistics", "ahmed.hassan@gearguard.com", 80, 24, "ASRS bay 4 inventory reorganization"),
        ("Genie GS-1930 Electric Scissor Lift 20ft", "Logistics", "jake.sullivan@gearguard.com", 40, 8, "High-bay lighting retrofitting work"),
        ("Nilfisk Viper Industrial Floor Ride-on Scrubber", "Logistics", "maria.santos@gearguard.com", 25, 3, "Quarterly epoxy floor deep cleaning"),

        # Quality Control
        ("Faro Quantum Max ScanArm 3D Laser Scanner", "Quality Control", "claire.bennett@gearguard.com", 38, 7, "Casting mold surface deviance scan"),
        ("Brabender Moisture & Viscosity Density Analyzer", "Quality Control", "vikram.mehta@gearguard.com", 48, 12, "Polymer resin batch density testing"),
        ("Fluke 8588A Reference Multimeter Calibration Bench", "Quality Control", "olivia.wong@gearguard.com", 62, 17, "Factory multimeter annual re-certification"),
    ]

    for asset_name, dept, emp_email, held_days_ago, returned_days_ago, reason in returned_samples:
        emp = user_map.get(emp_email)
        matched_eq = equipment_by_name.get(asset_name)
        if emp and matched_eq:
            alloc_d = now - timedelta(days=held_days_ago)
            ret_d = now - timedelta(days=returned_days_ago)
            ar = AssetRequest(
                employee_id=emp.id,
                asset_name=asset_name,
                category=matched_eq.category,
                reason=reason,
                status=AssetRequestStatus.returned,
                allocated_asset_id=matched_eq.id,
                request_date=alloc_d - timedelta(days=2),
                approval_date=alloc_d - timedelta(days=1),
                allocated_date=alloc_d,
                return_date=ret_d,
            )
            await ar.insert()

    # 4c. Pending Requests (12 records)
    pending_samples = [
        ("Hermle C 42 U MT 5-Axis Machining Center", "Machining", "jane@gearguard.com", "Aerospace turbine blade 5-axis contour milling run."),
        ("Sodick ALC600G High-Speed EDM Sinker", "Machining", "tom.jenkins@gearguard.com", "Hardened steel extrusion die micro-hole sinking."),
        ("Sulzer Ahlstar High-Volume Centrifugal Slurry Pump", "Production", "priyanshuc675@gmail.com", "Auxiliary line 3 chemical wash recirculation pump."),
        ("Waukesha Cherry-Burrell Positive Displacement Pump", "Production", "priyanshuc6@gmail.com", "Continuous paste extrusion feed system."),
        ("Fluid Systems High-Pressure Industrial De-greaser", "Production", "employee@gearguard.com", "Cleanroom part preparation wash station."),
        ("Desoutter Multi-Spindle Tightening Bench", "Assembly", "bob@gearguard.com", "Transmission case assembly automated bolt rundown."),
        ("Universal Robots UR10e Collaborative Robot", "Assembly", "rachel.green@gearguard.com", "Palletizing cobot integration trial."),
        ("Cummins 750kVA Standby Diesel Generator", "Facilities", "david.kim@gearguard.com", "Substation emergency power backup inspection setup."),
        ("Marley NC Crossflow Cooling Tower Cell 2", "Facilities", "lucas.gray@gearguard.com", "Chiller plant peak heat load auxiliary water cooling."),
        ("Raymond 7500 Deep-Reach Electric Forklift", "Logistics", "maria.santos@gearguard.com", "Aisle 7 double-deep pallet retrieval operations."),
        ("Genie GS-1930 Electric Scissor Lift 20ft", "Logistics", "ahmed.hassan@gearguard.com", "High-bay barcode scanning station maintenance."),
        ("Faro Quantum Max ScanArm 3D Laser Scanner", "Quality Control", "claire.bennett@gearguard.com", "Incoming aluminum casting 3D CAD deviation inspection."),
    ]
    for asset_name, dept, emp_email, reason in pending_samples:
        emp = user_map.get(emp_email)
        matched_eq = equipment_by_name.get(asset_name)
        if emp:
            await AssetRequest(
                employee_id=emp.id,
                asset_name=asset_name,
                category=matched_eq.category if matched_eq else "General Operations",
                reason=reason,
                status=AssetRequestStatus.pending,
                request_date=now - timedelta(hours=random.randint(4, 48)),
            ).insert()

    # 4d. Approved Requests (8 records)
    approved_samples = [
        ("Parker Hannifin 2000 PSI Hydraulic Power Unit", "Machining", "vikas.sharma@gearguard.com", "Broaching machine auxiliary hydraulic supply."),
        ("Coolant Filtration & Tramp Oil Skimmer", "Machining", "elena.popova@gearguard.com", "Central machining coolant filtration service."),
        ("Komatsu 200-Ton Heavy Stamping Press", "Production", "priyanshuc675@gmail.com", "Progressive die stamping cycle setup."),
        ("FlexLink X45 Automated Pallet Transport Track", "Assembly", "kyle.walker@gearguard.com", "Automated cell 5 material transfer track."),
        ("Pneumatic Press Fit Assembly Station AP-10", "Assembly", "sophia.chen@gearguard.com", "Bearing sleeve press fitting operations."),
        ("Donaldson Torit Dust & Fume Collector DB-40", "Facilities", "sophie.martin@gearguard.com", "Welding booth localized extraction ventilation."),
        ("Nilfisk Viper Industrial Floor Ride-on Scrubber", "Logistics", "jake.sullivan@gearguard.com", "Warehouse main concourse floor maintenance."),
        ("Brabender Moisture & Viscosity Density Analyzer", "Quality Control", "vikram.mehta@gearguard.com", "Batch raw polymer moisture content analysis."),
    ]
    for asset_name, dept, emp_email, reason in approved_samples:
        emp = user_map.get(emp_email)
        matched_eq = equipment_by_name.get(asset_name)
        if emp:
            req_d = now - timedelta(days=random.randint(1, 3))
            await AssetRequest(
                employee_id=emp.id,
                asset_name=asset_name,
                category=matched_eq.category if matched_eq else "Machinery",
                reason=reason,
                status=AssetRequestStatus.approved,
                request_date=req_d,
                approval_date=req_d + timedelta(hours=random.randint(4, 16)),
            ).insert()

    # 5. Seed Work Orders & Complaints (105 tickets)
    print("Seeding 105 Work Orders & Complaints across all departments and timeline...")
    wo_counter = 1

    # High-fidelity work order scenarios:
    # (asset_name, dept, creator_email, tech_email, subject, priority, status, is_complaint, dt_mins, cost, days_offset, type_str)
    # days_offset < 0 -> past, = 0 -> today, > 0 -> future scheduled PM
    WORK_ORDER_BLUEPRINTS = [
        # =========================================================================
        # MACHINING (18 tickets)
        # =========================================================================
        ("Mazak Quick Turn 250 CNC Lathe", "Machining", "jane@gearguard.com", "tech.machining@gearguard.com", 
         "Excessive chuck runout and acoustic chatter during 80mm OD roughing pass", "critical", WorkOrderStatus.in_progress, True, 45, None, -1, "corrective"),
        ("Mazak Quick Turn 250 CNC Lathe", "Machining", "jane@gearguard.com", "tech.machining@gearguard.com", 
         "Collet actuator hydraulic cylinder seal replacement and drawbar force verification", "high", WorkOrderStatus.repaired, True, 90, 480.0, -8, "corrective"),
        ("Mazak Quick Turn 250 CNC Lathe", "Machining", "manager.machining@gearguard.com", "tech.machining2@gearguard.com", 
         "Quarterly geometric alignment, laser interferometer pitch error compensation", "low", WorkOrderStatus.new, False, None, None, 4, "preventive"),
        
        ("Haas VF-4 5-Axis CNC Mill", "Machining", "tom.jenkins@gearguard.com", "tech.machining@gearguard.com", 
         "Tool carousel pocket #14 indexing misalignment alarm 114", "high", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Haas VF-4 5-Axis CNC Mill", "Machining", "tom.jenkins@gearguard.com", "tech.machining2@gearguard.com", 
         "Spindle chiller refrigerant pressure low trip alarm 341", "medium", WorkOrderStatus.in_progress, True, 30, None, -2, "corrective"),
        ("Haas VF-4 5-Axis CNC Mill", "Machining", "manager.machining@gearguard.com", "tech.machining@gearguard.com", 
         "Replacement of B-axis harmonic drive rotary table seal and oil change", "medium", WorkOrderStatus.repaired, False, 120, 650.0, -12, "preventive"),

        ("Makino PS105 Vertical Machining Center", "Machining", "tom.jenkins@gearguard.com", "tech.machining@gearguard.com", 
         "Dynamic spindle vibration analysis and ISO 1940 balance calibration", "low", WorkOrderStatus.repaired, True, 0, 320.0, -5, "preventive"),
        ("Makino PS105 Vertical Machining Center", "Machining", "manager.machining@gearguard.com", "tech.machining2@gearguard.com", 
         "High-pressure through-spindle coolant pump (30 bar) pressure fluctuation", "high", WorkOrderStatus.in_progress, True, 75, None, -1, "corrective"),

        ("Doosan Puma 2600Y Turning Center", "Machining", "vikas.sharma@gearguard.com", "tech.machining2@gearguard.com", 
         "Y-axis linear scale contamination causing sporadic position encoder fault", "high", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Doosan Puma 2600Y Turning Center", "Machining", "vikas.sharma@gearguard.com", "tech.machining@gearguard.com", 
         "Turret live tooling drive coupling backlash inspection and spline grease replenishment", "medium", WorkOrderStatus.repaired, True, 80, 410.0, -14, "corrective"),

        ("Okuma Multus U3000 Multi-Function Lathe", "Machining", "jane@gearguard.com", "tech.machining2@gearguard.com", 
         "Milling spindle tool clamp confirmation switch sensor intermittent contact", "medium", WorkOrderStatus.in_progress, True, 20, None, 0, "corrective"),
        ("Okuma Multus U3000 Multi-Function Lathe", "Machining", "manager.machining@gearguard.com", "tech.machining@gearguard.com", 
         "Semi-annual guideway lubrication metering valve inspection and reservoir flush", "low", WorkOrderStatus.new, False, None, None, 7, "preventive"),

        ("Chevalier Falcon Surface Grinder 1224", "Machining", "jane@gearguard.com", "tech.machining@gearguard.com", 
         "Electromagnetic chuck holding power decay on rear pole zone", "critical", WorkOrderStatus.new, True, None, None, -1, "corrective"),
        ("Mitsubishi MV2400-S Wire EDM Machine", "Machining", "vikas.sharma@gearguard.com", "tech.machining2@gearguard.com", 
         "Automatic wire threader jet nozzle clogged by brass debris", "medium", WorkOrderStatus.repaired, True, 45, 180.0, -4, "corrective"),

        ("Hermle C 42 U MT 5-Axis Machining Center", "Machining", "elena.popova@gearguard.com", "tech.machining@gearguard.com", 
         "A-axis trunnion worm gear backlash exceeds tolerance by 0.04mm", "high", WorkOrderStatus.in_progress, True, 110, None, -3, "corrective"),
        ("DMG Mori NLX 2500 High-Precision Lathe", "Machining", "elena.popova@gearguard.com", "tech.machining2@gearguard.com", 
         "Hydraulic chuck clamping pressure transducer drift", "medium", WorkOrderStatus.repaired, True, 60, 290.0, -10, "corrective"),
        
        ("Parker Hannifin 2000 PSI Hydraulic Power Unit", "Machining", "manager.machining@gearguard.com", "tech.machining@gearguard.com", 
         "Excessive tank temperature warning and proportional valve spool erosion", "critical", WorkOrderStatus.scrap, False, 360, 1850.0, -15, "corrective"),
        ("Coolant Filtration & Tramp Oil Skimmer", "Machining", "manager.machining@gearguard.com", "tech.machining2@gearguard.com", 
         "Replace coalescing filter media and rebuild skimmer wiper blade", "low", WorkOrderStatus.new, False, None, None, 10, "preventive"),

        # =========================================================================
        # PRODUCTION (24 tickets)
        # =========================================================================
        ("Viking Mag Drive Internal Gear Pump", "Production", "priyanshuc675@gmail.com", "tech.production@gearguard.com", 
         "Cavitation and severe acoustic vibration above 4.5 bar line discharge pressure", "critical", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Cincinnati 175-Ton Hydraulic Press Brake", "Production", "priyanshuc675@gmail.com", "tech.production@gearguard.com", 
         "Proportional valve position feedback drift on ram descent stroke", "high", WorkOrderStatus.in_progress, True, 65, None, -1, "corrective"),
        ("Trumpf TruLaser 3030 Sheet Cutting Cell", "Production", "priyanshuc675@gmail.com", "tech.production2@gearguard.com", 
         "Assist gas nitrogen pressure regulator servo calibration check", "medium", WorkOrderStatus.repaired, True, 40, 220.0, -6, "preventive"),
        ("Viking Mag Drive Internal Gear Pump", "Production", "priyanshuc675@gmail.com", "tech.production@gearguard.com", 
         "Quarterly magnetic containment shell temperature thermography survey", "low", WorkOrderStatus.repaired, True, 0, 150.0, -18, "preventive"),

        ("Bosch Rexroth 4WE Directional Control Manifold", "Production", "priyanshuc6@gmail.com", "tech.production@gearguard.com", 
         "Solenoid coil B failure causing spool stuck in neutral position during 2nd shift", "high", WorkOrderStatus.in_progress, True, 55, None, 0, "corrective"),
        ("Amada VIPROS 358 King CNC Turret Punch Press", "Production", "priyanshuc6@gmail.com", "tech.production2@gearguard.com", 
         "Turret index station clamp sensor intermittent timeout error 204", "high", WorkOrderStatus.new, True, None, None, -1, "corrective"),
        ("Lincoln Electric Robotic TIG Welding Cell", "Production", "priyanshuc6@gmail.com", "tech.production@gearguard.com", 
         "Shielding gas solenoid valve seat erosion causing pre-flow porosity", "medium", WorkOrderStatus.repaired, True, 45, 310.0, -9, "corrective"),

        ("Goulds 3196 Chemical Process Pump", "Production", "employee@gearguard.com", "tech.production@gearguard.com", 
         "Mechanical seal gland flush line leaking process effluent on baseplate", "critical", WorkOrderStatus.in_progress, True, 90, None, -1, "corrective"),
        ("Toyo SI-150-6 All-Electric Injection Molding Machine", "Production", "employee@gearguard.com", "tech.production2@gearguard.com", 
         "Toggle mechanism tie bar #3 strain gauge showing uneven clamping tension", "high", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Nordson Industrial Powder Coating Booth", "Production", "employee@gearguard.com", "tech.production@gearguard.com", 
         "Corona electrostatic spray gun voltage multiplier unit replacement", "medium", WorkOrderStatus.repaired, True, 75, 540.0, -11, "corrective"),

        ("Komatsu 200-Ton Heavy Stamping Press", "Production", "ananya.deshmukh@gearguard.com", "tech.production2@gearguard.com", 
         "Pneumatic clutch-brake timing gap excessive, stopping angle over-run", "critical", WorkOrderStatus.in_progress, True, 120, None, -2, "corrective"),
        ("Komatsu 200-Ton Heavy Stamping Press", "Production", "ananya.deshmukh@gearguard.com", "tech.production@gearguard.com", 
         "Hydraulic overload protector (HOLP) relief valve trip and oil leakage", "high", WorkOrderStatus.repaired, True, 110, 890.0, -14, "corrective"),
        ("Ametek Continuous Conveyor Tempering Oven", "Production", "ananya.deshmukh@gearguard.com", "tech.production2@gearguard.com", 
         "Zone 2 silicon carbide heating element open circuit alarm", "high", WorkOrderStatus.new, True, None, None, 1, "corrective"),

        ("Bystronic Xpert Pro 150 Precision Press Brake", "Production", "diego.ramirez@gearguard.com", "tech.production@gearguard.com", 
         "Dynamic hydraulic crowning cylinder pressure transducer calibration", "medium", WorkOrderStatus.repaired, True, 50, 360.0, -7, "preventive"),
        ("KraussMaffei CX 200 High-Pressure Injection Unit", "Production", "diego.ramirez@gearguard.com", "tech.production2@gearguard.com", 
         "Barrel heater band zone 3 thermocouple short to ground", "high", WorkOrderStatus.in_progress, True, 35, None, 0, "corrective"),

        ("Sulzer Ahlstar High-Volume Centrifugal Slurry Pump", "Production", "manager.production@gearguard.com", "tech.production@gearguard.com", 
         "Impeller casing heavy erosion and cavitation pitting, shaft deflection", "critical", WorkOrderStatus.scrap, False, 480, 2400.0, -16, "corrective"),
        ("Fluid Systems High-Pressure Industrial De-greaser", "Production", "manager.production@gearguard.com", "tech.production2@gearguard.com", 
         "High-pressure triplex plunger pump seal packing kit replacement", "medium", WorkOrderStatus.repaired, False, 85, 420.0, -4, "preventive"),
        ("Waukesha Cherry-Burrell Positive Displacement Pump", "Production", "manager.production@gearguard.com", "tech.production@gearguard.com", 
         "Rotor timing gear backlash inspection and food-grade synthetic lubricant flush", "low", WorkOrderStatus.new, False, None, None, 5, "preventive"),

        ("Trumpf TruLaser 3030 Sheet Cutting Cell", "Production", "manager.production@gearguard.com", "tech.production2@gearguard.com", 
         "Fiber laser collimator protective window cleaning and beam focus calibration", "medium", WorkOrderStatus.new, False, None, None, 8, "preventive"),
        ("Cincinnati 175-Ton Hydraulic Press Brake", "Production", "manager.production@gearguard.com", "tech.production@gearguard.com", 
         "Annual hydraulic oil ISO 4406 cleanliness testing and return line filter swap", "low", WorkOrderStatus.new, False, None, None, 12, "preventive"),
        ("Goulds 3196 Chemical Process Pump", "Production", "manager.production@gearguard.com", "tech.production2@gearguard.com", 
         "Laser shaft alignment and dynamic vibration baseline recording", "low", WorkOrderStatus.repaired, False, 45, 210.0, -20, "preventive"),
        ("Amada VIPROS 358 King CNC Turret Punch Press", "Production", "manager.production@gearguard.com", "tech.production@gearguard.com", 
         "Hydraulic ram servo manifold accumulator nitrogen pre-charge check", "medium", WorkOrderStatus.new, False, None, None, 6, "preventive"),
        ("Ametek Continuous Conveyor Tempering Oven", "Production", "manager.production@gearguard.com", "tech.production2@gearguard.com", 
         "Conveyor mesh belt drive sprocket wear evaluation and tensioner adjustment", "low", WorkOrderStatus.repaired, False, 60, 280.0, -13, "preventive"),
        ("Toyo SI-150-6 All-Electric Injection Molding Machine", "Production", "manager.production@gearguard.com", "tech.production@gearguard.com", 
         "Servomotor planetary gearbox lubrication and ball screw backlash audit", "medium", WorkOrderStatus.new, False, None, None, 9, "preventive"),

        # =========================================================================
        # ASSEMBLY (18 tickets)
        # =========================================================================
        ("Fanuc M-20iD/25 6-Axis Robotic Arm", "Assembly", "bob@gearguard.com", "tech.assembly@gearguard.com", 
         "Axis 3 servo amplifier overcurrent trip alarm SRVO-023 under full payload", "critical", WorkOrderStatus.in_progress, True, 80, None, 0, "corrective"),
        ("Fanuc M-20iD/25 6-Axis Robotic Arm", "Assembly", "bob@gearguard.com", "tech.assembly@gearguard.com", 
         "Wrist J5 gear grease flushing with Kyodo Yushi Molywhite RE00 grease", "medium", WorkOrderStatus.repaired, True, 90, 450.0, -6, "preventive"),
        ("Atlas Copco Tensor Reversible Electric Nutrunner Station", "Assembly", "bob@gearguard.com", "tech.assembly2@gearguard.com", 
         "Angle transducer drift causing false torque angle rejection on M10 fasteners", "high", WorkOrderStatus.new, True, None, None, 0, "corrective"),

        ("KUKA KR CYBERTECH Handling Robot", "Assembly", "rachel.green@gearguard.com", "tech.assembly@gearguard.com", 
         "Pneumatic end-effector gripper sensor intermittent feedback drop", "high", WorkOrderStatus.in_progress, True, 40, None, -1, "corrective"),
        ("KUKA KR CYBERTECH Handling Robot", "Assembly", "rachel.green@gearguard.com", "tech.assembly2@gearguard.com", 
         "Teach pendant KCP4 touch screen display digitizer dead zone", "medium", WorkOrderStatus.repaired, True, 60, 680.0, -10, "corrective"),
        ("Yaskawa Motoman GP12 High-Speed Handling Robot", "Assembly", "rachel.green@gearguard.com", "tech.assembly@gearguard.com", 
         "Internal wrist harness cable flex fatigue, sporadic safety fence E-stop", "critical", WorkOrderStatus.new, True, None, None, 1, "corrective"),

        ("ABB IRB 6700 Spot Welding Robot", "Assembly", "kyle.walker@gearguard.com", "tech.assembly2@gearguard.com", 
         "Servo gun electrode water cooling flow switch fault, weld gun overheat", "high", WorkOrderStatus.in_progress, True, 50, None, 0, "corrective"),
        ("ABB IRB 6700 Spot Welding Robot", "Assembly", "kyle.walker@gearguard.com", "tech.assembly@gearguard.com", 
         "Electrode dressing pneumatic cutter blade sharpening and air line filter flush", "low", WorkOrderStatus.repaired, True, 30, 160.0, -15, "preventive"),
        ("Siemens S7-1500 PLC Automation Station", "Assembly", "kyle.walker@gearguard.com", "tech.assembly2@gearguard.com", 
         "Profinet remote IO dropped packet communication error on subnet 192.168.4.x", "high", WorkOrderStatus.repaired, True, 45, 290.0, -3, "corrective"),

        ("Cognex In-Sight 8405 Vision Inspection System", "Assembly", "sophia.chen@gearguard.com", "tech.assembly@gearguard.com", 
         "Ring light LED segment failure causing shadow artifact and false defects", "medium", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Universal Robots UR10e Collaborative Robot", "Assembly", "sophia.chen@gearguard.com", "tech.assembly2@gearguard.com", 
         "Joint 2 protective stop due to mechanical resistance on counterweight pivot", "high", WorkOrderStatus.in_progress, True, 35, None, -2, "corrective"),

        ("Branson 2000X Ultrasonic Plastic Welder", "Assembly", "manager.assembly@gearguard.com", "tech.assembly@gearguard.com", 
         "Titanium acoustic horn booster cracked along node line, frequency shift error", "critical", WorkOrderStatus.scrap, False, 240, 1600.0, -18, "corrective"),
        ("Dorner 2200 Series Modular Belt Conveyor", "Assembly", "manager.assembly@gearguard.com", "tech.assembly2@gearguard.com", 
         "Drive roller bearing noise and polyurethane friction belt tracking misalignment", "medium", WorkOrderStatus.repaired, False, 70, 310.0, -8, "corrective"),
        ("Desoutter Multi-Spindle Tightening Bench", "Assembly", "manager.assembly@gearguard.com", "tech.assembly@gearguard.com", 
         "Multi-channel torque transducer ISO 5393 calibration certification", "low", WorkOrderStatus.new, False, None, None, 5, "preventive"),
        ("FlexLink X45 Automated Pallet Transport Track", "Assembly", "manager.assembly@gearguard.com", "tech.assembly2@gearguard.com", 
         "Pneumatic stop gate cylinder air cushion seals rebuild", "low", WorkOrderStatus.repaired, False, 40, 190.0, -12, "preventive"),
        ("Pneumatic Press Fit Assembly Station AP-10", "Assembly", "manager.assembly@gearguard.com", "tech.assembly@gearguard.com", 
         "Load cell calibration check with certified 20kN proving ring", "medium", WorkOrderStatus.new, False, None, None, 9, "preventive"),
        ("Siemens S7-1500 PLC Automation Station", "Assembly", "manager.assembly@gearguard.com", "tech.assembly2@gearguard.com", 
         "Firmware upgrade to v3.1 and redundant CPU sync test", "low", WorkOrderStatus.new, False, None, None, 13, "preventive"),
        ("Dorner 2200 Series Modular Belt Conveyor", "Assembly", "manager.assembly@gearguard.com", "tech.assembly@gearguard.com", 
         "Monthly safety light curtain functional stop distance validation", "low", WorkOrderStatus.repaired, False, 20, 110.0, -22, "preventive"),

        # =========================================================================
        # FACILITIES (18 tickets)
        # =========================================================================
        ("Atlas Copco GA75 Rotary Screw Compressor", "Facilities", "david.kim@gearguard.com", "tech.facilities@gearguard.com", 
         "High discharge air temperature alarm at 104°C on main compressor airend", "critical", WorkOrderStatus.in_progress, True, 120, None, 0, "corrective"),
        ("Trane IntelliPak Industrial Air Handler", "Facilities", "david.kim@gearguard.com", "tech.facilities2@gearguard.com", 
         "Supply fan forward-curved wheel V-belt loose, acoustic vibration in ductwork", "high", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Grundfos CRN 32 High-Pressure Inline Pump", "Facilities", "david.kim@gearguard.com", "tech.facilities@gearguard.com", 
         "Cartridge mechanical seal dripping treated cooling water onto motor frame", "medium", WorkOrderStatus.repaired, True, 60, 390.0, -7, "corrective"),

        ("Kaeser CSD 125 Refrigerated Air Dryer", "Facilities", "lucas.gray@gearguard.com", "tech.facilities@gearguard.com", 
         "Condensate auto-drain solenoid valve stuck open, dumping compressed air pressure", "medium", WorkOrderStatus.new, True, None, None, -1, "corrective"),
        ("Cleaver-Brooks 250 HP Industrial Steam Boiler", "Facilities", "lucas.gray@gearguard.com", "tech.facilities2@gearguard.com", 
         "Low water cut-off float chamber blowdown switch intermittent trip", "critical", WorkOrderStatus.in_progress, True, 90, None, -1, "corrective"),
        ("Cleaver-Brooks 250 HP Industrial Steam Boiler", "Facilities", "lucas.gray@gearguard.com", "tech.facilities@gearguard.com", 
         "Burner flame scanner UV tube optical sensor replacement and combustion tune", "high", WorkOrderStatus.repaired, True, 75, 520.0, -14, "corrective"),

        ("Carrier 150-Ton Water-Cooled Chiller", "Facilities", "sophie.martin@gearguard.com", "tech.facilities2@gearguard.com", 
         "Condenser approach temperature elevated to 4.2°C indicating tube scaling", "medium", WorkOrderStatus.in_progress, True, 45, None, 0, "corrective"),
        ("Parker Balston High-Purity Nitrogen Generator", "Facilities", "sophie.martin@gearguard.com", "tech.facilities@gearguard.com", 
         "Zirconia oxygen sensor reading purity drop below 99.999% threshold", "high", WorkOrderStatus.repaired, True, 50, 480.0, -9, "corrective"),

        ("Kidde Argonite Clean Agent Fire Suppression", "Facilities", "manager.facilities@gearguard.com", "tech.facilities2@gearguard.com", 
         "Nitrogen pilot cylinder pressure gauge below minimum supervisory pressure", "critical", WorkOrderStatus.new, False, None, None, 1, "corrective"),
        ("Cummins 750kVA Standby Diesel Generator", "Facilities", "manager.facilities@gearguard.com", "tech.facilities@gearguard.com", 
         "Monthly 30-minute full load bank test and automatic transfer switch (ATS) transfer", "low", WorkOrderStatus.repaired, False, 60, 310.0, -4, "preventive"),
        ("Eaton 13.8kV Medium Voltage Switchgear Unit", "Facilities", "manager.facilities@gearguard.com", "tech.facilities2@gearguard.com", 
         "Infrared thermography inspection of vacuum circuit breaker finger clusters", "low", WorkOrderStatus.new, False, None, None, 4, "preventive"),

        ("Marley NC Crossflow Cooling Tower Cell 2", "Facilities", "manager.facilities@gearguard.com", "tech.facilities@gearguard.com", 
         "Gear reducer oil seal catastrophic failure, water ingress in gearbox", "critical", WorkOrderStatus.scrap, False, 300, 2100.0, -21, "corrective"),
        ("Donaldson Torit Dust & Fume Collector DB-40", "Facilities", "manager.facilities@gearguard.com", "tech.facilities2@gearguard.com", 
         "Pulse-jet reverse blow solenoid manifold diaphragm valve replacement", "medium", WorkOrderStatus.repaired, False, 80, 440.0, -11, "preventive"),
        ("Spirax Sarco Steam Pressure Reduction Station", "Facilities", "manager.facilities@gearguard.com", "tech.facilities@gearguard.com", 
         "Pilot-operated diaphragm valve seat wire drawing, downstream pressure creeping", "high", WorkOrderStatus.in_progress, True, 70, None, -3, "corrective"),
        ("Schneider Electric 2500A Main Power Busway", "Facilities", "manager.facilities@gearguard.com", "tech.facilities2@gearguard.com", 
         "Bolt torque check on joint pack connections across Building 2 concourse", "low", WorkOrderStatus.new, False, None, None, 11, "preventive"),
        ("Atlas Copco GA75 Rotary Screw Compressor", "Facilities", "manager.facilities@gearguard.com", "tech.facilities@gearguard.com", 
         "4,000-hour major PM: replace air/oil separator, oil filter, air intake filter", "medium", WorkOrderStatus.new, False, None, None, 6, "preventive"),
        ("Carrier 150-Ton Water-Cooled Chiller", "Facilities", "manager.facilities@gearguard.com", "tech.facilities2@gearguard.com", 
         "Lubricating oil acid test and Spectro oil wear metal analysis sampling", "low", WorkOrderStatus.repaired, False, 30, 190.0, -17, "preventive"),
        ("Grundfos CRN 32 High-Pressure Inline Pump", "Facilities", "manager.facilities@gearguard.com", "tech.facilities@gearguard.com", 
         "Quarterly motor insulation resistance (Megger) test at 1000V DC", "low", WorkOrderStatus.repaired, False, 25, 120.0, -25, "preventive"),

        # =========================================================================
        # LOGISTICS (16 tickets)
        # =========================================================================
        ("Crown FC 5200 Electric Counterbalance Forklift", "Logistics", "maria.santos@gearguard.com", "tech.logistics@gearguard.com", 
         "Hydraulic lift cylinder slow creep downwards with rated 2.5T pallet load", "critical", WorkOrderStatus.in_progress, True, 75, None, 0, "corrective"),
        ("Lantech Q-300 Semi-Automatic Pallet Stretch Wrapper", "Logistics", "maria.santos@gearguard.com", "tech.logistics2@gearguard.com", 
         "Film pre-stretch carriage rollers slipping, film tear on corner radius", "medium", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Demag 5-Ton Electric Overhead Crane", "Logistics", "maria.santos@gearguard.com", "tech.logistics@gearguard.com", 
         "Annual magnetic particle non-destructive wire rope and hook throat inspection", "low", WorkOrderStatus.repaired, True, 180, 750.0, -8, "preventive"),

        ("Toyota 8FBE20 High-Reach Order Picker", "Logistics", "ahmed.hassan@gearguard.com", "tech.logistics@gearguard.com", 
         "Steering angle potentiometer sensor calibration drift and traction code 41", "high", WorkOrderStatus.in_progress, True, 40, None, -1, "corrective"),
        ("Hytrol 190-E24V Zero-Pressure Accumulation Conveyor", "Logistics", "ahmed.hassan@gearguard.com", "tech.logistics2@gearguard.com", 
         "Photo-eye sensor reflector misaligned on zone 6 diverter spur", "low", WorkOrderStatus.repaired, True, 25, 140.0, -5, "corrective"),

        ("Hyster J35XNT 3-Wheel Electric Forklift", "Logistics", "jake.sullivan@gearguard.com", "tech.logistics@gearguard.com", 
         "AC drive motor thermal sensor false trip during ramp climb", "high", WorkOrderStatus.new, True, None, None, -2, "corrective"),
        ("Jungheinrich ETV 216 Reach Truck 1600kg", "Logistics", "jake.sullivan@gearguard.com", "tech.logistics2@gearguard.com", 
         "Mast tilt hydraulic hose pinch leak near bottom sheaves", "high", WorkOrderStatus.repaired, True, 85, 490.0, -13, "corrective"),

        ("Bito Automated Guided Vehicle AGV Tugger #4", "Logistics", "manager.logistics@gearguard.com", "tech.logistics@gearguard.com", 
         "LiFePO4 battery management system (BMS) cell balance failure code E-99", "critical", WorkOrderStatus.new, False, None, None, 1, "corrective"),
        ("Rite-Hite Hydraulic Heavy-Duty Dock Leveler DL-1", "Logistics", "manager.logistics@gearguard.com", "tech.logistics2@gearguard.com", 
         "Lip cylinder hydraulic velocity fuse locked, dock lip fails to extend", "high", WorkOrderStatus.in_progress, True, 60, None, -2, "corrective"),
        ("Raymond 7500 Deep-Reach Electric Forklift", "Logistics", "manager.logistics@gearguard.com", "tech.logistics@gearguard.com", 
         "Pantograph reach scissor bushing replacement and load wheel resurfacing", "medium", WorkOrderStatus.repaired, False, 120, 620.0, -9, "preventive"),

        ("Interlake Mecalux Automated Storage Crane (ASRS)", "Logistics", "manager.logistics@gearguard.com", "tech.logistics2@gearguard.com", 
         "Vertical mast cable drum structural fracture and safety arrester engagement", "critical", WorkOrderStatus.scrap, False, 420, 3200.0, -19, "corrective"),
        ("Genie GS-1930 Electric Scissor Lift 20ft", "Logistics", "manager.logistics@gearguard.com", "tech.logistics@gearguard.com", 
         "Platform control box joystick deadman trigger microswitch replacement", "medium", WorkOrderStatus.repaired, False, 40, 260.0, -15, "corrective"),
        ("Nilfisk Viper Industrial Floor Ride-on Scrubber", "Logistics", "manager.logistics@gearguard.com", "tech.logistics2@gearguard.com", 
         "Squeegee vacuum motor impeller seized from debris ingestion", "medium", WorkOrderStatus.new, False, None, None, 3, "corrective"),
        ("Crown FC 5200 Electric Counterbalance Forklift", "Logistics", "manager.logistics@gearguard.com", "tech.logistics@gearguard.com", 
         "Biannual brake shoe clearance adjustment and master cylinder fluid flush", "low", WorkOrderStatus.new, False, None, None, 7, "preventive"),
        ("Demag 5-Ton Electric Overhead Crane", "Logistics", "manager.logistics@gearguard.com", "tech.logistics2@gearguard.com", 
         "Hoist planetary brake disc wear measurement and limit switch functional test", "low", WorkOrderStatus.new, False, None, None, 12, "preventive"),
        ("Hytrol 190-E24V Zero-Pressure Accumulation Conveyor", "Logistics", "manager.logistics@gearguard.com", "tech.logistics@gearguard.com", 
         "24V DC brushless motor roller (MDR) card replacement in zone 3", "low", WorkOrderStatus.repaired, False, 30, 180.0, -24, "preventive"),

        # =========================================================================
        # QUALITY CONTROL (16 tickets)
        # =========================================================================
        ("Zeiss Contura 3D Coordinate Measuring Machine", "Quality Control", "claire.bennett@gearguard.com", "tech.qc@gearguard.com", 
         "Z-axis probe head collision recovery and kinematic reference sphere recalibration", "critical", WorkOrderStatus.new, True, None, None, 0, "corrective"),
        ("Olympus OmniScan X3 Phased Array Flaw Detector", "Quality Control", "claire.bennett@gearguard.com", "tech.qc2@gearguard.com", 
         "Piezoelectric transducer wedge couplant seal replacement and acoustic delay verify", "medium", WorkOrderStatus.in_progress, True, 30, None, -1, "corrective"),
        ("Instron 5985 250kN Universal Tensile Testing System", "Quality Control", "claire.bennett@gearguard.com", "tech.qc@gearguard.com", 
         "Wedge action grip jaw inserts teeth worn, tensile specimen slippage observed", "high", WorkOrderStatus.repaired, True, 60, 480.0, -6, "corrective"),

        ("Mitutoyo PH-A14 Optical Horizontal Comparator", "Quality Control", "vikram.mehta@gearguard.com", "tech.qc@gearguard.com", 
         "Halogen surface illuminator fiber optic cable burnt terminal and dimmer fault", "medium", WorkOrderStatus.in_progress, True, 25, None, 0, "corrective"),
        ("Wilson Rockwell 574 Hardness Tester", "Quality Control", "vikram.mehta@gearguard.com", "tech.qc2@gearguard.com", 
         "Diamond Brale indenter microscopic chip causing HRC readings offset by +1.8", "high", WorkOrderStatus.new, True, None, None, -2, "corrective"),
        ("Wilson Rockwell 574 Hardness Tester", "Quality Control", "vikram.mehta@gearguard.com", "tech.qc@gearguard.com", 
         "Standardized test block verification and dashpot damping oil replenishment", "low", WorkOrderStatus.repaired, True, 35, 170.0, -16, "preventive"),

        ("Thermo Scientific Niton XL5 Plus XRF Analyzer", "Quality Control", "olivia.wong@gearguard.com", "tech.qc2@gearguard.com", 
         "Miniaturized X-ray tube filament stabilization cycle failing self-test", "critical", WorkOrderStatus.in_progress, True, 65, None, -1, "corrective"),
        ("Keyence VR-5000 3D Wide-Area Macro Profilometer", "Quality Control", "olivia.wong@gearguard.com", "tech.qc@gearguard.com", 
         "Telecentric objective motorized zoom positioning repeatability error", "high", WorkOrderStatus.repaired, True, 45, 520.0, -10, "corrective"),

        ("Mitutoyo Surftest SJ-410 Surface Roughness Tester", "Quality Control", "manager.qc@gearguard.com", "tech.qc2@gearguard.com", 
         "Differential inductance detector stylus needle tip broken (2µm diamond)", "critical", WorkOrderStatus.new, False, None, None, 1, "corrective"),
        ("Horiba LA-960 Laser Particle Size Analyzer", "Quality Control", "manager.qc@gearguard.com", "tech.qc@gearguard.com", 
         "Flow cell quartz window ultrasonic bath cavitation cleaning and laser alignment", "medium", WorkOrderStatus.repaired, False, 50, 310.0, -5, "preventive"),
        ("Fluke 8588A Reference Multimeter Calibration Bench", "Quality Control", "manager.qc@gearguard.com", "tech.qc2@gearguard.com", 
         "Annual NIST-traceable reference standard calibration verification", "low", WorkOrderStatus.new, False, None, None, 5, "preventive"),

        ("Faro Quantum Max ScanArm 3D Laser Scanner", "Quality Control", "manager.qc@gearguard.com", "tech.qc@gearguard.com", 
         "Internal rotary optical encoder catastrophic failure following arm drop", "critical", WorkOrderStatus.scrap, False, 180, 2900.0, -22, "corrective"),
        ("Brabender Moisture & Viscosity Density Analyzer", "Quality Control", "manager.qc@gearguard.com", "tech.qc2@gearguard.com", 
         "Torsion head measuring spring calibration and temperature sensor audit", "low", WorkOrderStatus.repaired, False, 40, 220.0, -12, "preventive"),
        ("Zeiss Contura 3D Coordinate Measuring Machine", "Quality Control", "manager.qc@gearguard.com", "tech.qc@gearguard.com", 
         "Granite surface plate air bearing filter replacement and air pressure check", "low", WorkOrderStatus.new, False, None, None, 8, "preventive"),
        ("Instron 5985 250kN Universal Tensile Testing System", "Quality Control", "manager.qc@gearguard.com", "tech.qc2@gearguard.com", 
         "Ballscrew drive linear guide lubrication and crosshead speed verification", "low", WorkOrderStatus.new, False, None, None, 14, "preventive"),
        ("Olympus OmniScan X3 Phased Array Flaw Detector", "Quality Control", "manager.qc@gearguard.com", "tech.qc@gearguard.com", 
         "Quarterly battery impedance test and ultrasonic pulser voltage linearity check", "low", WorkOrderStatus.repaired, False, 30, 150.0, -28, "preventive"),
    ]

    for asset_name, dept, emp_email, tech_email, subj, prio, status_val, is_comp, dt_mins, cost_val, days_off, type_val in WORK_ORDER_BLUEPRINTS:
        human_id = f"WO-{wo_counter:04d}"
        wo_counter += 1

        matched_eq = equipment_by_name.get(asset_name)
        creator_user = user_map.get(emp_email)
        tech_user = user_map.get(tech_email)

        created_dt = now + timedelta(days=days_off, hours=random.randint(-6, 6))
        sched_dt = created_dt
        due_dt = sched_dt + timedelta(days=random.randint(2, 5))

        started_dt = None
        comp_dt = None
        if status_val == WorkOrderStatus.in_progress:
            started_dt = created_dt + timedelta(minutes=random.randint(15, 60))
        elif status_val in [WorkOrderStatus.repaired, WorkOrderStatus.scrap]:
            started_dt = created_dt + timedelta(minutes=random.randint(15, 60))
            comp_dt = started_dt + timedelta(hours=random.randint(1, 8))

        comments = [
            Comment(
                author_id=creator_user.id if creator_user else user_map["admin@gearguard.com"].id,
                author_name=creator_user.name if creator_user else "Plant Operator",
                text=f"Logged for {dept} operations on {asset_name}. Maintenance dispatched per SOP standard.",
                created_at=created_dt,
            )
        ]
        if tech_user and status_val != WorkOrderStatus.new:
            comments.append(
                Comment(
                    author_id=tech_user.id,
                    author_name=tech_user.name,
                    text=f"Assigned technician {tech_user.name} on site. Diagnostics executed according to GearGuard protocols.",
                    created_at=started_dt or (created_dt + timedelta(minutes=30)),
                )
            )
        if status_val == WorkOrderStatus.repaired:
            comments.append(
                Comment(
                    author_id=tech_user.id if tech_user else user_map["admin@gearguard.com"].id,
                    author_name=tech_user.name if tech_user else "Senior Technician",
                    text=f"Repair complete. Post-maintenance testing successful. Asset restored to operational service.",
                    created_at=comp_dt or (created_dt + timedelta(hours=3)),
                )
            )
        elif status_val == WorkOrderStatus.scrap:
            comments.append(
                Comment(
                    author_id=user_map["admin@gearguard.com"].id,
                    author_name="Plant Operations Review",
                    text=f"Catastrophic failure confirmed by engineering assessment. Equipment decommissioned and written off to scrap.",
                    created_at=comp_dt or (created_dt + timedelta(hours=4)),
                )
            )

        wo = WorkOrder(
            human_id=human_id,
            subject=subj,
            type=WorkOrderType.preventive if type_val == "preventive" else WorkOrderType.corrective,
            status=status_val,
            priority=prio,
            is_complaint=is_comp,
            equipment_id=matched_eq.id if matched_eq else None,
            team_id=random.choice(team_docs).id,
            created_by=creator_user.id if creator_user else None,
            assignee_id=tech_user.id if (tech_user and status_val != WorkOrderStatus.new) else None,
            scheduled_date=sched_dt,
            due_date=due_dt,
            started_at=started_dt,
            completed_at=comp_dt,
            downtime_minutes=dt_mins,
            duration=float(dt_mins or random.randint(30, 180)),
            cost=cost_val,
            comments=comments,
            created_at=created_dt if days_off <= 0 else (now - timedelta(days=1)),
            updated_at=now,
        )
        await wo.insert()

    # 6. Synchronize Counters
    print("Synchronizing sequence counters...")
    c_wo = await Counter.find_one(Counter.name == "work_order")
    if not c_wo:
        c_wo = Counter(name="work_order", seq=wo_counter)
        await c_wo.insert()
    else:
        c_wo.seq = wo_counter
        await c_wo.save()

    c_eq = await Counter.find_one(Counter.name == "equipment")
    if not c_eq:
        c_eq = Counter(name="equipment", seq=eq_counter)
        await c_eq.insert()
    else:
        c_eq.seq = eq_counter
        await c_eq.save()

    # 7. Audit logs (60+ records)
    print("Seeding Audit Log plant telemetry entries...")
    admin_user = user_map["admin@gearguard.com"]
    audit_events = [
        ("user.login", "user", "System Administrator", "admin@gearguard.com", {"session": "active_jwt", "ip": "10.0.1.20"}),
        ("asset.registered", "equipment", "Mazak Quick Turn 250 CNC Lathe", "AST-0001", {"status": "operational", "dept": "Machining"}),
        ("asset.allocated", "equipment", "Viking Mag Drive Internal Gear Pump", "AST-0014", {"allocated_to": "Priyanshu Chaudhari", "dept": "Production"}),
        ("asset.allocated", "equipment", "Cincinnati 175-Ton Hydraulic Press Brake", "AST-0018", {"allocated_to": "Priyanshu Chaudhari", "dept": "Production"}),
        ("work_order.created", "work_order", "WO-0001", "Excessive chuck runout", {"priority": "critical", "dept": "Machining"}),
        ("work_order.assigned", "work_order", "WO-0001", "Assigned to Alex Rivera", {"technician": "Alex Rivera"}),
        ("work_order.status_changed", "work_order", "WO-0002", "Collet actuator seal replacement", {"from": "in_progress", "to": "repaired"}),
        ("asset_request.approved", "asset_request", "Req-AST-0021", "Industrial Stamping Press", {"approved_by": "Sarah Chen", "status": "approved"}),
        ("asset_request.returned", "asset_request", "Req-AST-0007", "Wire EDM Machine", {"status": "returned", "return_date": "2026-09-20"}),
        ("calibration.certified", "equipment", "Zeiss Contura 3D CMM", "AST-0070", {"accuracy": "+/- 0.001mm", "iso_standard": "10360-2"}),
    ]

    for i in range(60):
        evt = audit_events[i % len(audit_events)]
        action, etype, label, eid, after_dict = evt
        dept_choice = DEPARTMENTS[i % len(DEPARTMENTS)]
        t_stamp = now - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        await AuditLog(
            actor_id=admin_user.id,
            actor_name="System Administrator",
            action=action,
            entity_type=etype,
            entity_id=eid,
            entity_label=f"[{dept_choice}] {label}",
            after=after_dict,
            timestamp=t_stamp,
        ).insert()

    print("\n=======================================================")
    print("SUCCESS: GearGuard database fully populated with real-time enterprise operations data!")
    print(f"- Users: {len(users_to_create)}")
    print(f"- Machinery & Assets: {len(EQUIPMENT_DATA)}")
    print(f"- Work Orders & Complaints: {len(WORK_ORDER_BLUEPRINTS)}")
    print(f"- Active Allocations & Custody Logs: 80+")
    print(f"- Audit Logs: 60+")
    print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(seed_database())
