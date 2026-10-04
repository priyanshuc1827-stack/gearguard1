"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { reports, workOrders } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, PriorityLabel, HumanId, SkeletonRows } from "@/components/custom/display";
import { useAuth } from "@/features/auth/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedDept, setSelectedDept] = useState<string>("All");

  const deptParam = user?.role === "admin" && selectedDept !== "All" ? selectedDept : undefined;

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["reports", "summary", user?.department, deptParam],
    queryFn: () => reports.summary(deptParam),
  });

  const { data: needsAttention, isLoading: naLoading } = useQuery({
    queryKey: ["work-orders", "attention", user?.department, deptParam],
    queryFn: () => workOrders.list({ priority: "critical", department: deptParam, page_size: 6 }),
  });

  const { data: highRisk } = useQuery({
    queryKey: ["reports", "high-risk", user?.department, deptParam],
    queryFn: () => reports.highRisk(deptParam),
  });

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1280, margin: "0 auto" }}>
        
        {/* Header Bar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="badge badge-accent" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                Command Center
              </span>
              {user?.role === "manager" && (
                <span className="badge badge-primary" style={{ fontSize: "11px" }}>
                  📍 {user?.department || "Production"} Department
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em" }}>
              {user?.role === "manager" ? `${user.department || "Production"} Operations Command` : "Operations Command Center"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
              {user?.role === "manager"
                ? `Real-time telemetry and equipment work order metrics for the ${user.department || "Production"} division.`
                : "Real-time plant telemetry, critical breakdown triage, and machinery failure analytics."}
            </p>
          </div>

          {user?.role === "admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Department:</span>
              <select
                className="input input-sm select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                style={{ width: 170, fontSize: "12px" }}
              >
                <option value="All">All Departments</option>
                {["Machining", "Production", "Assembly", "Facilities", "Logistics", "Quality Control"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Metric strip */}
        <div className="metric-strip" style={{ marginBottom: "var(--space-8)" }}>
          {sumLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="metric">
                <div className="skeleton" style={{ height: 28, width: 60, marginBottom: 4 }} />
                <div className="skeleton" style={{ height: 12, width: 80 }} />
              </div>
            ))
          ) : (
            <>
              <div className="metric">
                <div className="metric-value">{Number(summary?.openWorkOrders ?? 0)}</div>
                <div className="metric-label">Open work orders</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: "var(--red)" }}>{Number(summary?.overdue ?? 0)}</div>
                <div className="metric-label">Overdue</div>
              </div>
              <div className="metric">
                <div className="metric-value mono">{Number(summary?.totalDowntimeMinutes ?? 0)}</div>
                <div className="metric-label">Downtime (min)</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: "var(--amber)" }}>{Number(summary?.outOfServiceAssets ?? 0)}</div>
                <div className="metric-label">Out of service</div>
              </div>
              <div className="metric">
                <div className="metric-value" style={{ color: "var(--green)" }}>{Number(summary?.repairRate ?? 0)}%</div>
                <div className="metric-label">Repair rate</div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          {/* Needs attention */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Critical Work Orders & Breakdowns</span>
              <Link href="/work-orders?priority=critical" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textDecoration: "none" }}>
                View all →
              </Link>
            </div>
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Subject</th><th>Priority</th><th>Stage</th></tr>
                </thead>
                <tbody>
                  {naLoading ? (
                    <SkeletonRows cols={4} rows={4} />
                  ) : (needsAttention?.items ?? []).length === 0 ? (
                    <tr><td colSpan={4}><div className="empty-state"><p>No critical issues active.</p></div></td></tr>
                  ) : (
                    (needsAttention?.items ?? []).map((wo) => (
                      <tr key={wo.id}>
                        <td><HumanId id={wo.human_id} /></td>
                        <td className="truncate" style={{ maxWidth: 200 }}>{wo.subject}</td>
                        <td><PriorityLabel priority={wo.priority} /></td>
                        <td><StatusDot status={wo.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Asset risk ranking */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>High-Risk Machinery Ranking</span>
              <Link href="/assets" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textDecoration: "none" }}>
                Asset inventory →
              </Link>
            </div>
            {(highRisk ?? []).length === 0 ? (
              <div className="empty-state"><p>No high risk machinery flagged.</p></div>
            ) : (
              <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Asset</th><th>Department</th><th style={{ textAlign: "right" }}>Failures</th><th style={{ textAlign: "right" }}>Downtime</th></tr>
                  </thead>
                  <tbody>
                    {(highRisk ?? []).map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span className="mono" style={{ fontSize: "var(--text-xs)" }}>{String(row.humanId)}</span>
                          <span style={{ marginLeft: 6, fontSize: "var(--text-sm)", fontWeight: 500 }}>{String(row.name)}</span>
                        </td>
                        <td className="text-secondary" style={{ fontSize: "11px" }}>{String(row.department ?? "—")}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.failures)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.totalDowntimeMinutes)} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}