"use client";

import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { AlertCircle, CalendarCheck, ShieldCheck, Trello, Calendar as CalendarIcon, HardDrive, ClipboardList, Activity, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: () => fetch(`${API_BASE}/maintenance/requests`).then((r) => r.json()),
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => fetch(`${API_BASE}/equipment`).then((r) => r.json()),
  });

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeRequests = Array.isArray(requests) ? requests : [];

  const myTasks = safeRequests.filter((req: any) => req.createdBy === currentUser?.id);
  const criticalCount = safeAssets.filter((a: any) => !a.isUsable).length;
  const pendingCount = safeRequests.filter((r: any) => r.status === "New").length;
  const overdueCount = safeRequests.filter((r: any) =>
    r.status !== "Repaired" && r.scheduledDate && new Date(r.scheduledDate) < new Date()
  ).length;
  const operationalCount = safeAssets.length - criticalCount;

  if (reqLoading || assetsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "#10b981", borderTopColor: "transparent" }} />
          <p style={{ color: "#64748b" }} className="text-sm font-medium">Syncing telemetry data...</p>
        </div>
      </div>
    );
  }

  const getRoleDesc = () => {
    switch (currentUser?.role) {
      case "admin":      return "Manage operators, asset registers, categories, and site locations.";
      case "manager":    return "Review employee requests, allocate components, and audit log activities.";
      case "user":       return "Submit request tickets for facility assets and process returns.";
      case "technician": return "Oversee preventive calendars and kanban repair work stages.";
      case "auditor":    return "Generate asset failure rate metrics and view log ledgers.";
      default:           return "Live system status from GearGuard.";
    }
  };

  const getRoleColor = () => {
    switch (currentUser?.role) {
      case "admin":      return "#f43f5e";
      case "manager":    return "#f59e0b";
      case "user":       return "#06b6d4";
      case "technician": return "#10b981";
      case "auditor":    return "#6366f1";
      default:           return "#64748b";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in-up">

      {/* ── Header ── */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="beacon beacon-green" />
            <span style={{ color: "#10b981", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              System Online
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight" style={{ color: "#e8eaf2" }}>
            Welcome back,{" "}
            <span style={{ color: "#10b981" }}>{currentUser?.name || "Operator"}</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#64748b" }}>{getRoleDesc()}</p>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest"
          style={{ background: `${getRoleColor()}22`, color: getRoleColor(), border: `1px solid ${getRoleColor()}44` }}
        >
          {currentUser?.role || "guest"}
        </div>
      </header>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          icon={<AlertCircle size={18} />}
          label="Critical Equipment"
          value={`${criticalCount} Units`}
          sub="Requiring immediate attention"
          accentColor="#f43f5e"
          delay="delay-100"
        />
        <StatCard
          icon={<CalendarCheck size={18} />}
          label="Open Maintenance"
          value={`${pendingCount} Active`}
          sub={`${overdueCount} tasks overdue`}
          accentColor="#f59e0b"
          delay="delay-200"
        />
        <StatCard
          icon={<ShieldCheck size={18} />}
          label="Operational Assets"
          value={`${operationalCount} / ${safeAssets.length}`}
          sub="Equipment currently usable"
          accentColor="#10b981"
          delay="delay-300"
        />
      </div>

      {/* ── My Assignments ── */}
      <section className="space-y-4 animate-fade-in-up delay-200">
        <div className="flex items-center gap-2">
          <Activity size={18} style={{ color: "#10b981" }} />
          <h2 className="text-lg font-bold" style={{ color: "#e8eaf2" }}>Your Active Assignments</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myTasks.length > 0 ? myTasks.map((task: any) => (
            <div key={task.id} className="glass-card p-4 flex justify-between items-center gap-3">
              <div className="overflow-hidden flex-1">
                <p className="font-bold text-sm truncate" style={{ color: "#e8eaf2" }}>{task.subject}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#64748b" }}>
                  Asset: {task.equipment?.name || "Unit"}
                </p>
              </div>
              <StatusPill status={task.status} />
            </div>
          )) : (
            <div
              className="col-span-full py-12 rounded-xl text-center border border-dashed"
              style={{ borderColor: "rgba(148,163,184,0.12)", background: "rgba(19,25,41,0.4)" }}
            >
              <ClipboardList size={28} className="mx-auto mb-2" style={{ color: "#334155" }} />
              <p className="text-sm italic" style={{ color: "#475569" }}>No active assignments for your account.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Quick Navigation ── */}
      <section className="space-y-4 animate-fade-in-up delay-300">
        <div className="flex items-center gap-2">
          <Zap size={18} style={{ color: "#f59e0b" }} />
          <h2 className="text-lg font-bold" style={{ color: "#e8eaf2" }}>Quick Navigation</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link href="/kanban">
            <QuickNavCard icon={<Trello size={20} />} title="Kanban Board" desc="Manage repair workflow stages" color="#6366f1" />
          </Link>
          <Link href="/calendar">
            <QuickNavCard icon={<CalendarIcon size={20} />} title="Preventive Calendar" desc="Schedule routine maintenance" color="#10b981" />
          </Link>
          <Link href="/equipment">
            <QuickNavCard icon={<HardDrive size={20} />} title="Asset Inventory" desc="View equipment technical details" color="#f59e0b" />
          </Link>
        </div>
      </section>

    </div>
  );
}

function StatCard({ icon, label, value, sub, accentColor, delay }: any) {
  return (
    <div className={`glass-card p-5 animate-fade-in-up ${delay}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#64748b" }}>{label}</p>
        <div
          className="p-1.5 rounded-lg"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight" style={{ color: "#e8eaf2" }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#475569" }}>{sub}</p>
      <div className="mt-3 h-0.5 rounded-full" style={{ background: `${accentColor}30` }}>
        <div className="h-0.5 rounded-full w-3/5" style={{ background: accentColor }} />
      </div>
    </div>
  );
}

function QuickNavCard({ icon, title, desc, color }: any) {
  return (
    <div className="glass-card p-5 flex items-center gap-4 cursor-pointer group">
      <div
        className="p-3 rounded-xl shrink-0 transition-all group-hover:scale-110"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color: "#e8eaf2" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{desc}</p>
      </div>
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }}>→</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    New:      { bg: "rgba(99,102,241,0.2)",  color: "#a5b4fc" },
    "In Progress": { bg: "rgba(245,158,11,0.2)", color: "#fcd34d" },
    Repaired: { bg: "rgba(16,185,129,0.2)",  color: "#6ee7b7" },
    Scrap:    { bg: "rgba(244,63,94,0.2)",   color: "#fda4af" },
  };
  const style = map[status] || { bg: "rgba(100,116,139,0.2)", color: "#94a3b8" };
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}