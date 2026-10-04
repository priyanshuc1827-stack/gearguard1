"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Cpu,
  Layers,
  Building2,
  Boxes,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  Lock,
  UserCheck,
  Server,
  BarChart3,
  Moon,
  Sun,
  Laptop,
  FileCheck,
  TrendingDown,
  Timer,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/components/ui/theme-provider";

interface WorkflowStep {
  id: number;
  stage: string;
  title: string;
  badge: string;
  color: string;
  icon: React.ElementType;
  actor: string;
  description: string;
  telemetry: {
    event: string;
    target: string;
    impact: string;
    output: string;
  };
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    stage: "Stage 01",
    title: "Anomaly Detection & Breakdown Filing",
    badge: "Shopfloor Operator",
    color: "#f59e0b",
    icon: AlertTriangle,
    actor: "Plant Floor Operator",
    description: "An operator detects abnormal hydraulic pressure fluctuation on an assigned press brake and files an emergency breakdown ticket with severity rating and failure photos.",
    telemetry: {
      event: "INCIDENT_REPORTED",
      target: "Cincinnati 175-Ton Press Brake (AST-0004)",
      impact: "Machine flagged with orange attention indicator",
      output: "Ticket WO-0042 auto-generated with component metadata",
    },
  },
  {
    id: 2,
    stage: "Stage 02",
    title: "Strict Department Triage & Routing",
    badge: "Division Manager",
    color: "var(--blue)",
    icon: GitBranch,
    actor: "Department Superintendent",
    description: "The ticket routes strictly to that division's manager (e.g. Machining complaints only route to Machining Manager). The manager inspects spare seals and dispatches a certified technician.",
    telemetry: {
      event: "DISPATCH_AUTHORIZED",
      target: "Production Maintenance Team Alpha",
      impact: "Zero cross-department noise; manager isolation preserved",
      output: "Assigned to Lead Technician Carlos Gomez (tech.production)",
    },
  },
  {
    id: 3,
    stage: "Stage 03",
    title: "Kanban Transition & Live Repair Timer",
    badge: "Maintenance Tech",
    color: "var(--accent)",
    icon: Timer,
    actor: "Dispatched Technician",
    description: "The technician drags the ticket to 'In Progress' on the Kanban board, initiates the stopwatch timer, executes the replacement SOP, and documents diagnostic measurements.",
    telemetry: {
      event: "WORK_IN_PROGRESS",
      target: "Work Order #WO-0042",
      impact: "Timer clocking downtime minutes for MTTR calculation",
      output: "High-pressure valve spool replaced & torque tested to 65 Nm",
    },
  },
  {
    id: 4,
    stage: "Stage 04",
    title: "Automated Fleet Telemetry Sync",
    badge: "Fleet Intelligence",
    color: "var(--green)",
    icon: RefreshCw,
    actor: "System Automation",
    description: "Ticket transitions to 'Repaired'. GearGuard automatically updates the physical machine's last_service_date timestamp, resets the downtime clock, and clears the alert badge across inventory.",
    telemetry: {
      event: "HEALTH_SYNCHRONIZED",
      target: "Equipment Registry AST-0004",
      impact: "last_service_date set to NOW; MTBF interval refreshed",
      output: "Machine restored to 100% operational status in Command Center",
    },
  },
  {
    id: 5,
    stage: "Stage 05",
    title: "Tamper-Evident Ledger & ISO Audit",
    badge: "Compliance Auditor",
    color: "#8b5cf6",
    icon: FileCheck,
    actor: "Quality & Safety Auditor",
    description: "Every action, timestamp, operator signature, and component cost is permanently committed to the immutable compliance ledger for instantaneous ISO 55001 / OSHA audit exports.",
    telemetry: {
      event: "AUDIT_COMMITTED",
      target: "Ledger Record #LOG-0108",
      impact: "Full cryptographic audit trail; zero manual paper logbooks",
      output: "Complies with ISO 9001:2015 §7.1.3 Infrastructure Maintenance",
    },
  },
];

const DEPARTMENTS_DATA = [
  {
    name: "Machining",
    icon: Cpu,
    tag: "High-Precision CNC",
    supervisor: "Robert Vance",
    machinery: ["Haas VF-4 5-Axis CNC Mill", "Makino PS105 Machining Center", "Doosan Puma 2600Y Lathe", "Mitsubishi MV2400-S Wire EDM"],
    stats: "21 Machines • 8 Technicians • 99.2% Spindle Uptime",
    description: "Tolerances within 2 microns. Continuous automated tool wear monitoring, spindle vibration tracking, and oil replenishment.",
  },
  {
    name: "Production",
    icon: Boxes,
    tag: "Heavy Fabrication",
    supervisor: "Sarah Chen",
    machinery: ["Cincinnati 175-Ton Hydraulic Press Brake", "Trumpf TruLaser 3030 Cell", "Komatsu 200-Ton Press", "Toyo SI-150-6 Injection Unit"],
    stats: "24 Machines • 10 Technicians • Sub-45m Breakdown Response",
    description: "High-tonnage stamping, sheet metal laser cutting, and hydraulic manifold control with zero tolerance for unplanned shutdowns.",
  },
  {
    name: "Assembly",
    icon: Layers,
    tag: "Robotics & Automation",
    supervisor: "Michael Chang",
    machinery: ["Fanuc M-20iD/25 6-Axis Arm", "KUKA KR CYBERTECH Robot", "ABB IRB 6700 Spot Welder", "Universal Robots UR10e Cobot"],
    stats: "18 Robotic Cells • 6 Automation Techs • 100% Vision QC",
    description: "Multi-axis articulated robotics, ultrasonic plastic welders, and precision nutrunner stations with real-time torque feedback.",
  },
  {
    name: "Facilities",
    icon: Building2,
    tag: "Plant Infrastructure",
    supervisor: "David Miller",
    machinery: ["Atlas Copco GA75 Screw Compressor", "Cleaver-Brooks 250 HP Steam Boiler", "Carrier 150-Ton Water Chiller", "Nitrogen Generator"],
    stats: "12 Critical Utilities • 4 Boiler Engineers • 24/7 Redundancy",
    description: "Factory utilities backbone supplying 8.5 bar compressed air, high-pressure steam, chilled water, and high-purity nitrogen.",
  },
  {
    name: "Logistics",
    icon: Activity,
    tag: "Material Handling",
    supervisor: "Elena Rostova",
    machinery: ["Crown FC 5200 Electric Forklift", "Toyota 8FBE20 Reach Picker", "Hytrol Zero-Pressure Conveyor", "Lantech Pallet Wrapper"],
    stats: "15 Fleet Units • 5 Mobile Techs • Battery Impedance Monitored",
    description: "Automated warehouse material flow, dock leveler hydraulics, and counterbalance electric forklift fleet telemetry.",
  },
  {
    name: "Quality Control",
    icon: Shield,
    tag: "Metrology & NDT",
    supervisor: "Kavita Sharma",
    machinery: ["Zeiss Contura 3D CMM", "Olympus OmniScan X3 Flaw Detector", "Instron 5985 250kN Tensile Tester", "Niton XL5 XRF Analyzer"],
    stats: "16 Cleanroom Gauges • 4 Metrologists • ISO 17025 Compliant",
    description: "Class 10,000 cleanroom metrology laboratory ensuring metallurgical integrity, dimensional accuracy, and non-destructive testing.",
  },
];

const COMPARISON_ROWS = [
  {
    metric: "Mean Time to Repair (MTTR)",
    traditional: "4.5 to 6.2 hours per incident",
    gearguard: "1.8 hours (Automated dispatch & live timers)",
    improvement: "-60% Downtime",
  },
  {
    metric: "Emergency Breakdown Frequency",
    traditional: "15–20 unplanned outages monthly",
    gearguard: "Sub-2 outages via automated preventive calendar",
    improvement: "-89% Failures",
  },
  {
    metric: "Department Noise & Triage",
    traditional: "Global email threads and misplaced calls",
    gearguard: "Strict manager routing isolated to specific division",
    improvement: "100% Scoped",
  },
  {
    metric: "Machine Service Synchronization",
    traditional: "Manual clipboard logs forgotten after repairs",
    gearguard: "Auto-syncs last_service_date & scrap flags on status change",
    improvement: "Zero Lost Data",
  },
  {
    metric: "Regulatory & ISO Compliance Prep",
    traditional: "2–4 days sifting paper binders and receipts",
    gearguard: "1-Click instant export from tamper-evident audit ledger",
    improvement: "Instant Readiness",
  },
  {
    metric: "Machinery Custody & Possession",
    traditional: "Unclear machine handovers between shifts",
    gearguard: "Formal operator checkout & manager return approvals",
    improvement: "Total Accountability",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { resolved, setTheme } = useTheme();
  const router = useRouter();

  const [activeStep, setActiveStep] = useState(0);
  const [activeDept, setActiveDept] = useState(0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", overflowX: "hidden" }}>
      {/* ── TOP NAV BAR ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo & Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius)",
                background: "linear-gradient(135deg, var(--accent) 0%, #b45309 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(217, 119, 6, 0.35)",
              }}
            >
              <Wrench size={18} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em" }}>GearGuard</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                  border: "1px solid rgba(217, 119, 6, 0.2)",
                }}
              >
                Enterprise ERP
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 24 }} className="desktop-nav">
            <a href="#features" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
              Core Modules
            </a>
            <a href="#workflow" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
              Operational Flow
            </a>
            <a href="#departments" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
              Plant Divisions
            </a>
            <a href="#impact" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
              Reliability ROI
            </a>
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              API Docs <ExternalLink size={12} />
            </a>
          </nav>

          {/* Action CTAs & Theme Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {resolved === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {user ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => router.push("/dashboard")}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              >
                <span>Enter System ({user.name.split(" ")[0]})</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <Link
                href="/login"
                className="btn btn-primary btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                  fontWeight: 600,
                  padding: "7px 16px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span>Operator Sign In</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          padding: "85px 24px 75px",
          maxWidth: 1280,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        {/* Ambient background glow */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(circle, rgba(217, 119, 6, 0.14) 0%, rgba(217, 119, 6, 0) 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>
          {/* Status Live Telemetry Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 9999,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 8px var(--green)",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em" }}>
              Live Telemetry Active • 81 Heavy Machinery Units • 0 Unresolved Critical Outages
            </span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: "clamp(34px, 5.5vw, 60px)",
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              marginBottom: 20,
            }}
          >
            Zero Unplanned Downtime. <br />
            <span
              style={{
                background: "linear-gradient(90deg, var(--accent) 0%, #f59e0b 50%, #d97706 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Total Shopfloor Intelligence.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              maxWidth: 740,
              margin: "0 auto 36px",
            }}
          >
            The Odoo-inspired industrial maintenance operating system. Uniting 6 factory divisions, 
            interactive Kanban work queues, operator breakdown complaints, custody handovers, 
            and tamper-evident compliance audit ledgers in a single high-performance cockpit.
          </p>

          {/* Clean Focused Hero CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 54 }}>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{
                padding: "13px 32px",
                fontSize: "15px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 6px 22px rgba(217, 119, 6, 0.35)",
              }}
            >
              <span>Operator Sign In</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "18px 24px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                Machinery Monitored
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: 4, color: "var(--text)" }}>81 Assets</div>
              <div style={{ fontSize: "12px", color: "var(--green)", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <CheckCircle2 size={12} /> 100% Barcoded & Serialized
              </div>
            </div>

            <div style={{ borderLeft: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                Resolved Work Orders
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: 4, color: "var(--text)" }}>110 Tickets</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 2 }}>
                Preventive & Corrective
              </div>
            </div>

            <div style={{ borderLeft: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                Mean Time to Repair
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: 4, color: "var(--accent)" }}>1.8 Hours</div>
              <div style={{ fontSize: "12px", color: "var(--green)", marginTop: 2 }}>
                -60% vs Industry Average
              </div>
            </div>

            <div style={{ borderLeft: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                Factory Divisions
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, marginTop: 4, color: "var(--text)" }}>6 Plants</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 2 }}>
                Strict Departmental RBAC
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE OPERATIONAL LIFECYCLE (REPLACES DEMO CREDS) ──────────── */}
      <section
        id="workflow"
        style={{
          padding: "80px 24px",
          background: "var(--bg-sunken)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 46 }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
              }}
            >
              Shopfloor Lifecycle
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>
              How GearGuard Eliminates Unplanned Downtime
            </h2>
            <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 660, margin: "10px auto 0" }}>
              Explore the five continuous stages of physical asset intelligence—from the moment an anomaly is detected 
              to technician resolution and tamper-evident audit archival.
            </p>
          </div>

          {/* Stepper Navigation Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {WORKFLOW_STEPS.map((s, idx) => {
              const isSelected = activeStep === idx;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(idx)}
                  className={`card ${isSelected ? "border-accent" : ""}`}
                  style={{
                    padding: "16px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                    background: isSelected ? "var(--bg-elevated)" : "transparent",
                    border: isSelected ? `2px solid var(--accent)` : "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    transition: "all 150ms ease",
                    boxShadow: isSelected ? "0 6px 20px rgba(217, 119, 6, 0.15)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: isSelected ? "var(--accent)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {s.stage}
                    </span>
                    <Icon size={16} style={{ color: isSelected ? "var(--accent)" : "var(--text-muted)" }} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
                    {s.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Live Simulator Display */}
          {(() => {
            const current = WORKFLOW_STEPS[activeStep];
            const StepIcon = current.icon;
            return (
              <div
                className="card"
                style={{
                  padding: "32px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 32,
                  alignItems: "center",
                }}
              >
                {/* Left explanation */}
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--bg-sunken)", border: "1px solid var(--border)", marginBottom: 14 }}>
                    <StepIcon size={14} style={{ color: current.color }} />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: current.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {current.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 10px" }}>
                    {current.title}
                  </h3>

                  <p style={{ fontSize: "14.5px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
                    {current.description}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "13px", color: "var(--text-muted)" }}>
                    <Clock size={15} />
                    <span>Average Execution Time: <strong>Sub-15 minutes</strong> across plant floor</span>
                  </div>
                </div>

                {/* Right simulated telemetry card */}
                <div
                  style={{
                    background: "var(--bg-sunken)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "20px 22px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", fontWeight: 600 }}>
                      <Terminal size={14} style={{ color: "var(--accent)" }} />
                      <span>GearGuard Event Bus Telemetry</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--green)", fontWeight: 600 }}>SYNCED</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "12px" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>event: </span>
                      <strong style={{ color: current.color }}>{current.telemetry.event}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>target_asset: </span>
                      <span style={{ color: "var(--text)" }}>{current.telemetry.target}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>system_impact: </span>
                      <span style={{ color: "var(--text)" }}>{current.telemetry.impact}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>event_output: </span>
                      <span style={{ color: "var(--green)" }}>{current.telemetry.output}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── CORE MODULES (6 PILLARS) ─────────────────────────────────────────── */}
      <section id="features" style={{ padding: "80px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
            Architecture & Capabilities
          </span>
          <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>
            Engineered for High-Reliability Plants
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 640, margin: "10px auto 0" }}>
            Every component designed with zero-fluff industrial UX principles. Fast keyboard shortcuts, 
            high-contrast readability, and deep integration across every physical asset.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* Pillar 1 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 16 }}>
              <BarChart3 size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Command Center & Fleet Telemetry</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Real-time calculation of Mean Time to Repair (MTTR), Mean Time Between Failures (MTBF), 
              downtime expense attribution, and high-risk equipment detection without slow N+1 database queries.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--blue-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue)", marginBottom: 16 }}>
              <Wrench size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Work Order Kanban Lifecycle</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Interactive drag-and-drop workflow tracking tickets from <strong>New Request</strong> to <strong>In Progress</strong> and <strong>Repaired</strong>. 
              Includes automated scrap state handling and synchronized machine service timestamps.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--green-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)", marginBottom: 16 }}>
              <Boxes size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Smart Equipment Catalog & Odoo Buttons</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Complete machinery registry with serial numbers, warranty terms, work-center locations, and assigned operators. 
              Smart badge buttons show live active work order counts directly on detail sheets.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "#faf5ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#9333ea", marginBottom: 16 }}>
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Operator Complaint Triage & Dispatch</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Plant operators log breakdown reports with severity ratings and component descriptions. 
              Tickets are strictly routed to their specific department manager for technician dispatch.
            </p>
          </div>

          {/* Pillar 5 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", color: "#ea580c", marginBottom: 16 }}>
              <Layers size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Machine Custody & Storage Return</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Tracks physical possession of machinery. Operators request machine allocations, department managers 
              review budget authorizations, and return-to-storage handovers reset active custody.
            </p>
          </div>

          {/* Pillar 6 */}
          <div className="card" style={{ padding: "24px 22px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--radius)", background: "var(--red-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)", marginBottom: 16 }}>
              <Shield size={20} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: 8 }}>Immutable Ledger & Compliance Audit</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Tamper-evident audit trail capturing user IDs, timestamps, entity diffs, and state transitions. 
              Includes technician resolution leaderboards and full ISO/OSHA readiness exports.
            </p>
          </div>
        </div>
      </section>

      {/* ── DEPARTMENT EXPLORER TABS ────────────────────────────────────────── */}
      <section
        id="departments"
        style={{
          padding: "70px 24px",
          background: "var(--bg-sunken)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
              Multi-Department Partitioning
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>
              6 Factory Divisions Operating in Harmony
            </h2>
            <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 640, margin: "10px auto 0" }}>
              Explore how each industrial unit maintains dedicated equipment catalogs, technician teams, and strict manager isolation.
            </p>
          </div>

          {/* Department Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 30,
            }}
          >
            {DEPARTMENTS_DATA.map((d, idx) => {
              const Icon = d.icon;
              const isActive = activeDept === idx;
              return (
                <button
                  key={d.name}
                  onClick={() => setActiveDept(idx)}
                  className={`btn btn-sm ${isActive ? "btn-primary" : "btn-default"}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <Icon size={14} />
                  <span>{d.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Department Showcase Panel */}
          {(() => {
            const current = DEPARTMENTS_DATA[activeDept];
            const Icon = current.icon;
            return (
              <div
                className="card"
                style={{
                  padding: "32px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius)",
                        background: "var(--accent-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                        {current.name} Division
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                        Work Center Supervisor: <strong>{current.supervisor}</strong> • Tag: {current.tag}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-sunken)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {current.stats}
                  </span>
                </div>

                <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
                  {current.description}
                </p>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 10 }}>
                    Sample High-Value Machinery In This Division:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    {current.machinery.map((mach, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-sunken)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "13px",
                          fontWeight: 500,
                        }}
                      >
                        <Wrench size={14} style={{ color: "var(--accent)" }} />
                        <span>{mach}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── QUANTIFIABLE IMPACT & RELIABILITY ROI ────────────────────────────── */}
      <section id="impact" style={{ padding: "80px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
            Quantifiable Factory Impact
          </span>
          <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>
            Traditional Factory Maintenance vs. GearGuard
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 640, margin: "10px auto 0" }}>
            See how transitioning to an automated, telemetry-driven platform dramatically reduces downtime and administrative overhead.
          </p>
        </div>

        <div className="table-container" style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "16px 20px", textAlign: "left", fontSize: "13px", fontWeight: 600 }}>Operational Vector</th>
                <th style={{ padding: "16px 20px", textAlign: "left", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>Traditional Plant Setup</th>
                <th style={{ padding: "16px 20px", textAlign: "left", fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>GearGuard Enterprise</th>
                <th style={{ padding: "16px 20px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}>Measured Delta</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600, fontSize: "13.5px" }}>{row.metric}</td>
                  <td style={{ padding: "14px 20px", color: "var(--text-muted)", fontSize: "13px" }}>{row.traditional}</td>
                  <td style={{ padding: "14px 20px", fontWeight: 600, color: "var(--text)", fontSize: "13.5px" }}>{row.gearguard}</td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--green-subtle)",
                        color: "var(--green)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {row.improvement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── TECHNICAL STACK & ARCHITECTURE ──────────────────────────────────── */}
      <section style={{ padding: "60px 24px 80px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>
            Engineered For Speed & Reliability
          </span>
          <h2 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6 }}>
            Modern Full-Stack Technical Foundation
          </h2>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 640, margin: "10px auto 0" }}>
            Zero unnecessary bloat. Clean separation of concerns with asynchronous Python micro-services and Next.js React 19.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
              Frontend Tier
            </div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 6 }}>Next.js 16 App Router</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              React 19, TypeScript, TanStack React Query v5 caching, Lucide icons, and Vanilla CSS design tokens.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--blue)", marginBottom: 8 }}>
              Backend Tier
            </div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 6 }}>FastAPI 2.0 Async</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Python 3.10+ async ASGI server with Pydantic v2 schemas, JWT authentication in HTTP-only cookies, and SlowAPI rate limiting.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--green)", marginBottom: 8 }}>
              Data Layer
            </div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 6 }}>MongoDB & Beanie ODM</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Official Motor async driver with 9 strongly typed Beanie document collections, composite indices, and aggregation pipelines.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#9333ea", marginBottom: 8 }}>
              Security & UI
            </div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: 6 }}>RBAC & Backdrop Blur</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Frosted-glass modal popups, department scoping, audit helper hooks, and dark/light system theme switching.
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border)",
          padding: "48px 24px 36px",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <Wrench size={15} />
            </div>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>GearGuard</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              — Intelligent Asset Maintenance Platform
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: "13px", color: "var(--text-secondary)" }}>
            <Link href="/login" style={{ color: "inherit", textDecoration: "none" }}>
              Operator Sign In
            </Link>
            <a href="http://localhost:3001/api/docs" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
              API Swagger Docs
            </a>
            <a href="https://www.loom.com/share/cf38a46e897c4508a00ad83d5d006aff" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
              Loom Walkthrough
            </a>
            <span style={{ color: "var(--text-muted)" }}>© 2026 GearGuard Systems</span>
          </div>
        </div>
      </footer>
    </div>
  );
}