"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Clock, Activity, Users, CheckCircle2,
  ClipboardCheck, CheckSquare, Send, Download, TrendingUp,
  ShieldCheck, Zap, BarChart3, UserCheck, PackageOpen, XCircle
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/custom/page-header";

// ─── Reusable dark stat card ──────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, accent = "#10b981", large = false
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; large?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3 text-left"
      style={{
        background: "rgba(19,25,41,0.9)",
        border: `1px solid rgba(148,163,184,0.08)`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>{label}</span>
      </div>
      <p className={`font-extrabold tracking-tight leading-none ${large ? "text-4xl" : "text-3xl"}`} style={{ color: '#e8eaf2' }}>
        {value}
      </p>
      {sub && <p className="text-xs font-medium" style={{ color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, accent }: { value: number; max: number; accent: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,40,64,0.8)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: accent }}
      />
    </div>
  );
}

export default function ReportingPage() {
  const [checklist, setChecklist] = useState({ users: false, assets: false, logs: false, risks: false });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const allChecked = Object.values(checklist).every(Boolean);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: summary = {} } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/summary`);
      if (!res.ok) return {};
      return res.json();
    }
  });

  const { data: highRisk = [] } = useQuery({
    queryKey: ["reports-high-risk"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/high-risk`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: techPerf = [], isLoading } = useQuery({
    queryKey: ["technician-performance"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/technician-performance`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const submitAuditReport = async () => {
    if (!allChecked) return;
    if (!currentUser?.id) { toast.error("You must be logged in."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "Safety Audit",
          details: `Compliance audit completed by ${currentUser.name}. Operators verified, assets validated, system ledger reviewed. MARKED COMPLIANT.`
        })
      });
      if (res.ok) {
        toast.success("Audit report published to system ledger ✓");
        setChecklist({ users: false, assets: false, logs: false, risks: false });
      } else {
        toast.error("Failed to publish audit report.");
      }
    } catch {
      toast.error("Network error — backend unreachable.");
    } finally {
      setSubmitting(false);
    }
  };

  const exportRiskCSV = () => {
    if ((highRisk as any[]).length === 0) { toast.warning("No risk records to export."); return; }
    const headers = ["Asset Name", "Serial Number", "Total Failures", "Total Downtime (hrs)", "Risk Level"];
    const rows = (highRisk as any[]).map((m: any) => [
      m.name, m.serialNumber, m.totalRequests,
      m.totalDuration || 0,
      m.totalRequests > 3 ? "CRITICAL RISK" : "MONITORING"
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gearguard_risk_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Risk report exported as CSV");
  };

  const exportFullCSV = () => {
    if ((techPerf as any[]).length === 0) { toast.warning("No technician data to export."); return; }
    const headers = ["Technician", "Email", "Assigned Tasks", "Completed", "Completion Rate (%)", "Total Downtime (hrs)"];
    const rows = (techPerf as any[]).map((t: any) => [t.name, t.email, t.assigned, t.completed, t.rate, t.downtime]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gearguard_technician_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Technician performance report exported");
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: '#10b981', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: '#64748b' }}>Analysing facility data...</p>
      </div>
    </div>
  );

  const s: any = summary;
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="space-y-8 text-left">
      <PageHeader
        title="Compliance & Reporting"
        subtitle="Live facility KPIs, technician performance analytics, and auditor safety checks"
        icon={<ClipboardCheck size={20} />}
        accentColor="#10b981"
        actions={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="gap-2 h-9 px-4 text-sm font-bold rounded-xl"
              style={{ border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8' }}
              onClick={exportRiskCSV}
            >
              <Download size={14} /> Risk CSV
            </Button>
            <Button
              variant="ghost"
              className="gap-2 h-9 px-4 text-sm font-bold rounded-xl"
              style={{ border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8' }}
              onClick={exportFullCSV}
            >
              <Download size={14} /> Performance CSV
            </Button>
          </div>
        }
      />

      {/* ── SECTION 1: KPI SUMMARY STRIP ─────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: '#475569' }}>
          Facility Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
          <StatCard icon={<PackageOpen size={16} />} label="Total Assets"     value={s.totalAssets    ?? "—"} sub="In inventory"           accent="#06b6d4" />
          <StatCard icon={<Activity      size={16} />} label="Total Requests"  value={s.totalRequests  ?? "—"} sub="All time"               accent="#6366f1" />
          <StatCard icon={<CheckCircle2  size={16} />} label="Repaired"        value={s.repaired       ?? "—"} sub={`${s.repairRate ?? 0}% success rate`} accent="#10b981" />
          <StatCard icon={<AlertTriangle size={16} />} label="Overdue Tasks"   value={s.overdue        ?? "—"} sub="Past scheduled date"    accent="#f43f5e" />
          <StatCard icon={<Clock         size={16} />} label="Total Downtime"  value={`${s.totalDowntime ?? 0} hrs`} sub="Logged labor hours" accent="#f59e0b" />
          <StatCard icon={<Zap           size={16} />} label="In Progress"     value={s.inProgress     ?? "—"} sub="Active work orders"     accent="#a78bfa" />
          <StatCard icon={<XCircle       size={16} />} label="Scrapped Assets" value={s.scrapped       ?? "—"} sub="Written off"            accent="#fb7185" />
          <StatCard icon={<Users         size={16} />} label="Technicians"     value={s.totalTechnicians ?? "—"} sub="Active field staff"   accent="#34d399" />
        </div>
      </div>

      {/* ── SECTION 2: COMPLIANCE CHECKLIST + STATUS ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Checklist */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'rgba(19,25,41,0.9)', border: '1px solid rgba(148,163,184,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <CheckSquare size={20} style={{ color: '#10b981' }} />
            <h2 className="text-base font-bold" style={{ color: '#e8eaf2' }}>Compliance Audit Checklist</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
            Complete all audit steps before publishing the compliance certificate to the immutable system ledger.
          </p>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold" style={{ color: '#475569' }}>
              <span>Audit Progress</span>
              <span style={{ color: checkedCount === 4 ? '#10b981' : '#f59e0b' }}>{checkedCount}/4 Complete</span>
            </div>
            <ProgressBar value={checkedCount} max={4} accent={checkedCount === 4 ? '#10b981' : '#f59e0b'} />
          </div>

          <div className="space-y-2.5 pt-1">
            {[
              {
                key: "users" as const,
                title: "Operator Verification",
                desc: "Verify all system operators have valid, authorized role-based directory entries."
              },
              {
                key: "assets" as const,
                title: "Asset Serial Integrity",
                desc: "Validate high-risk asset serial numbers against physical hardware tags in the facility."
              },
              {
                key: "risks" as const,
                title: "Risk Assessment Review",
                desc: "Inspect the top-failure assets above and confirm corrective action is documented."
              },
              {
                key: "logs" as const,
                title: "System Ledger Review",
                desc: "Inspect audit logs for any discrepancies, unauthorized overrides, or anomalous entries."
              },
            ].map(({ key, title, desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-all duration-150"
                style={{
                  background: checklist[key] ? 'rgba(16,185,129,0.06)' : 'rgba(30,40,64,0.5)',
                  border: `1px solid ${checklist[key] ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.06)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded accent-emerald-500 shrink-0"
                />
                <div>
                  <span className="text-sm font-semibold block" style={{ color: checklist[key] ? '#10b981' : '#e8eaf2' }}>{title}</span>
                  <span className="text-xs" style={{ color: '#475569' }}>{desc}</span>
                </div>
              </label>
            ))}
          </div>

          <Button
            onClick={submitAuditReport}
            disabled={!allChecked || submitting}
            className={`w-full h-12 font-bold rounded-xl gap-2 transition-all duration-300 ${allChecked ? "btn-glow" : ""}`}
            style={!allChecked ? {
              background: 'rgba(30,40,64,0.5)',
              color: '#475569',
              border: '1px solid rgba(148,163,184,0.08)',
              cursor: 'not-allowed'
            } : {}}
          >
            <Send size={15} />
            {submitting ? "Publishing..." : allChecked ? "Publish Compliance Certificate" : `Complete ${4 - checkedCount} remaining step${4 - checkedCount !== 1 ? "s" : ""}`}
          </Button>
        </div>

        {/* Audit Status Panel */}
        <div
          className="rounded-2xl p-6 flex flex-col justify-between"
          style={{
            background: 'rgba(19,25,41,0.9)',
            border: `1px solid ${allChecked ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.08)'}`,
          }}
        >
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#475569' }}>
              Facility Compliance Status
            </h3>
            <div className="space-y-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase"
                style={allChecked
                  ? { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }
                  : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }
                }
              >
                <ShieldCheck size={11} />
                {allChecked ? "Ready to Certify" : "Audit In Progress"}
              </span>
              <p className="text-4xl font-extrabold tracking-tight" style={{ color: '#e8eaf2' }}>
                {allChecked ? "100%" : `${Math.round((checkedCount / 4) * 100)}%`}
              </p>
              <p className="text-sm font-medium" style={{ color: '#64748b' }}>
                {allChecked ? "All audit steps verified" : "Verification complete"}
              </p>
            </div>

            {/* Repair rate callout */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(30,40,64,0.6)', border: '1px solid rgba(148,163,184,0.06)' }}>
              <div className="flex justify-between text-xs font-bold" style={{ color: '#475569' }}>
                <span className="flex items-center gap-1.5"><TrendingUp size={12} style={{ color: '#10b981' }} /> Facility Repair Rate</span>
                <span style={{ color: '#10b981' }}>{s.repairRate ?? 0}%</span>
              </div>
              <ProgressBar value={s.repairRate ?? 0} max={100} accent="#10b981" />
              <p className="text-[10px]" style={{ color: '#334155' }}>
                {s.repaired ?? 0} of {s.totalRequests ?? 0} total requests resolved
              </p>
            </div>
          </div>

          <div className="text-[10px] font-mono pt-4" style={{ borderTop: '1px solid rgba(148,163,184,0.06)', color: '#334155' }}>
            <div>Auditor: <span style={{ color: '#64748b' }}>{currentUser?.name || "—"}</span></div>
            <div>ID: <span style={{ color: '#64748b' }}>{currentUser?.id || "Not authenticated"}</span></div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: TECHNICIAN PERFORMANCE ────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#475569' }}>
              Technician Performance
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Individual breakdown — assigned, completed, and downtime logged</p>
          </div>
        </div>
        {(techPerf as any[]).length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(19,25,41,0.5)', border: '1px solid rgba(148,163,184,0.06)' }}>
            <Users size={40} style={{ color: '#1e2840', margin: '0 auto 12px' }} />
            <p className="text-sm" style={{ color: '#475569' }}>No technician data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(techPerf as any[]).map((tech: any, i: number) => (
              <div
                key={tech.id}
                className="rounded-2xl p-5"
                style={{ background: 'rgba(19,25,41,0.9)', border: '1px solid rgba(148,163,184,0.08)' }}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  {/* Rank + Name */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                      style={{
                        background: i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(148,163,184,0.1)' : 'rgba(30,40,64,0.8)',
                        color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#475569',
                        border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.1)'}`,
                      }}
                    >
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#e8eaf2' }}>{tech.name}</p>
                      <p className="text-[10px]" style={{ color: '#475569' }}>{tech.email}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-6 flex-1">
                    {[
                      { icon: <UserCheck size={13} />, label: "Assigned", value: tech.assigned, accent: '#6366f1' },
                      { icon: <CheckCircle2 size={13} />, label: "Completed", value: tech.completed, accent: '#10b981' },
                      { icon: <Clock size={13} />, label: "Downtime (hrs)", value: tech.downtime, accent: '#f59e0b' },
                    ].map(({ icon, label, value, accent }) => (
                      <div key={label} className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase flex items-center gap-1" style={{ color: '#475569' }}>
                          <span style={{ color: accent }}>{icon}</span> {label}
                        </p>
                        <p className="text-xl font-extrabold" style={{ color: '#e8eaf2' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Completion Rate */}
                  <div className="min-w-[140px] space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold" style={{ color: '#475569' }}>
                      <span>Completion Rate</span>
                      <span style={{ color: tech.rate >= 70 ? '#10b981' : tech.rate >= 40 ? '#f59e0b' : '#f43f5e' }}>
                        {tech.rate}%
                      </span>
                    </div>
                    <ProgressBar
                      value={tech.rate}
                      max={100}
                      accent={tech.rate >= 70 ? '#10b981' : tech.rate >= 40 ? '#f59e0b' : '#f43f5e'}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 4: HIGH-RISK ASSET OVERSIGHT ─────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: '#475569' }}>
              High-Risk Asset Oversight
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#334155' }}>Top 5 assets by breakdown frequency — ranked by failure count</p>
          </div>
        </div>
        <div className="space-y-3">
          {(Array.isArray(highRisk) ? highRisk : []).map((machine: any, i: number) => {
            const isCritical = machine.totalRequests > 3;
            return (
              <div
                key={machine.id}
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(19,25,41,0.9)',
                  border: `1px solid ${isCritical ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.15)'}`,
                  borderLeft: `3px solid ${isCritical ? '#f43f5e' : '#f59e0b'}`,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2.5 rounded-xl shrink-0"
                      style={{
                        background: isCritical ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${isCritical ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: isCritical ? '#f43f5e' : '#f59e0b' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#e8eaf2' }}>{i + 1}. {machine.name}</p>
                      <p className="text-[10px] font-mono uppercase" style={{ color: '#334155' }}>{machine.serialNumber}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-8 items-center">
                    <div className="text-center">
                      <p className="text-[9px] font-black uppercase" style={{ color: '#475569' }}>Failures</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Activity size={13} style={{ color: '#6366f1' }} />
                        <span className="text-lg font-extrabold" style={{ color: '#e8eaf2' }}>{machine.totalRequests}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black uppercase" style={{ color: '#475569' }}>Downtime</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={13} style={{ color: '#f59e0b' }} />
                        <span className="text-lg font-extrabold" style={{ color: '#e8eaf2' }}>{machine.totalDuration || 0} hrs</span>
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-extrabold uppercase px-3 py-1 rounded-lg"
                      style={isCritical
                        ? { background: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.25)' }
                        : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }
                      }
                    >
                      {isCritical ? "⚠ Critical Risk" : "Monitoring"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}