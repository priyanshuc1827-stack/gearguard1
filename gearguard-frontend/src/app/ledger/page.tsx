"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { reports } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { SkeletonRows } from "@/components/custom/display";

export default function LedgerPage() {
  const { data: summary, isLoading: sumLoading } = useQuery({ queryKey: ["reports", "summary"], queryFn: () => reports.summary() });
  const { data: techPerf, isLoading: techLoading } = useQuery({ queryKey: ["reports", "tech-perf"], queryFn: () => reports.technicianPerformance() });
  const { data: highRisk, isLoading: riskLoading } = useQuery({ queryKey: ["reports", "high-risk"], queryFn: () => reports.highRisk() });
  const { data: downtimeTrend } = useQuery({ queryKey: ["reports", "downtime-trend"], queryFn: () => reports.downtimeTrend() });

  return (
    <AppShell>
      <div className="page">
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 500 }}>Ledger</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>Aggregated maintenance and performance data</p>
        </div>

        {/* Summary strip */}
        <div className="metric-strip" style={{ marginBottom: "var(--space-8)" }}>
          {sumLoading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="metric"><div className="skeleton" style={{ height: 28, width: 56, marginBottom: 4 }} /><div className="skeleton" style={{ height: 12, width: 88 }} /></div>)
            : (
              <>
                <div className="metric"><div className="metric-value">{summary?.totalWorkOrders ?? 0}</div><div className="metric-label">Total work orders</div></div>
                <div className="metric"><div className="metric-value">{summary?.repaired ?? 0}</div><div className="metric-label">Repaired</div></div>
                <div className="metric"><div className="metric-value" style={{ color: "var(--red)" }}>{summary?.scrapped ?? 0}</div><div className="metric-label">Scrapped</div></div>
                <div className="metric"><div className="metric-value mono">{summary?.totalDowntimeMinutes ?? 0}</div><div className="metric-label">Total downtime (min)</div></div>
                <div className="metric"><div className="metric-value">{summary?.totalAssets ?? 0}</div><div className="metric-label">Total assets</div></div>
                <div className="metric"><div className="metric-value" style={{ color: "var(--green)" }}>{summary?.repairRate ?? 0}%</div><div className="metric-label">Repair rate</div></div>
              </>
            )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
          {/* Technician performance */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>Technician performance</span></div>
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead><tr><th>Technician</th><th style={{ textAlign: "right" }}>Assigned</th><th style={{ textAlign: "right" }}>Completed</th><th style={{ textAlign: "right" }}>Rate</th></tr></thead>
                <tbody>
                  {techLoading ? <SkeletonRows cols={4} /> :
                    (techPerf ?? []).length === 0 ? <tr><td colSpan={4}><div className="empty-state"><p>No data.</p></div></td></tr> :
                    (techPerf ?? []).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 450 }}>{String(row.name ?? "Unknown")}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.assigned)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.completed)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ color: Number(row.completionRate) >= 80 ? "var(--green)" : Number(row.completionRate) >= 50 ? "var(--amber)" : "var(--red)" }}>
                            {Number(row.completionRate)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* High risk assets */}
          <div className="card">
            <div className="card-header"><span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>High-risk assets</span></div>
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead><tr><th>Asset</th><th style={{ textAlign: "right" }}>Failures</th><th style={{ textAlign: "right" }}>Downtime</th></tr></thead>
                <tbody>
                  {riskLoading ? <SkeletonRows cols={3} /> :
                    (highRisk ?? []).length === 0 ? <tr><td colSpan={3}><div className="empty-state"><p>No data.</p></div></td></tr> :
                    (highRisk ?? []).map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span className="mono" style={{ fontSize: "var(--text-xs)" }}>{String(row.humanId)}</span>
                          <span style={{ marginLeft: 6, fontSize: "var(--text-sm)" }}>{String(row.name)}</span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: Number(row.failures) >= 5 ? "var(--red)" : "inherit" }}>{Number(row.failures)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.totalDowntimeMinutes)} min</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Downtime trend */}
        <div className="card">
          <div className="card-header"><span style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>Weekly downtime (last 12 weeks)</span></div>
          {(downtimeTrend ?? []).length === 0 ? <div className="empty-state"><p>No trend data yet.</p></div> : (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead><tr><th>Year</th><th>Week</th><th style={{ textAlign: "right" }}>Downtime (min)</th><th style={{ textAlign: "right" }}>Repaired</th></tr></thead>
                <tbody>
                  {(downtimeTrend ?? []).map((row, i) => (
                    <tr key={i}>
                      <td className="mono text-secondary">{String(row.year)}</td>
                      <td className="mono">{String(row.week)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.totalDowntimeMinutes)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(row.repaired)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
