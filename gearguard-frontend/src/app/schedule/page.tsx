"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { workOrders } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, PriorityLabel, HumanId, SkeletonRows } from "@/components/custom/display";

export default function SchedulePage() {
  const [view, setView] = useState<"week" | "list">("list");

  const { data, isLoading } = useQuery({
    queryKey: ["work-orders", "schedule"],
    queryFn: () => workOrders.list({ status: "New", page_size: 200, sort_by: "due_date", sort_dir: 1 }),
  });

  const items = (data?.items ?? []).filter((w) => w.due_date);
  const overdue = items.filter((w) => w.due_date && new Date(w.due_date) < new Date() && w.status !== "Repaired" && w.status !== "Scrap");
  const upcoming = items.filter((w) => w.due_date && new Date(w.due_date) >= new Date());

  return (
    <AppShell>
      <div className="page">
        <div style={{ marginBottom: "var(--space-6)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 500 }}>Schedule</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>Upcoming and overdue work orders by due date</p>
          </div>
        </div>

        {overdue.length > 0 && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--red)", marginBottom: "var(--space-2)", letterSpacing: "0.04em" }}>OVERDUE ({overdue.length})</div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Subject</th><th>Asset</th><th>Priority</th><th>Stage</th><th>Assignee</th><th>Due</th></tr></thead>
                <tbody>
                  {isLoading ? <SkeletonRows cols={7} /> :
                    overdue.map((wo) => (
                      <tr key={wo.id}>
                        <td><HumanId id={wo.human_id} /></td>
                        <td className="truncate" style={{ maxWidth: 200 }}>{wo.subject}</td>
                        <td className="text-secondary truncate" style={{ maxWidth: 140 }}>{wo.equipment_name ?? "—"}</td>
                        <td><PriorityLabel priority={wo.priority} /></td>
                        <td><StatusDot status={wo.status} /></td>
                        <td className="text-secondary">{wo.assignee_name ?? "—"}</td>
                        <td style={{ color: "var(--red)", fontWeight: 500, fontSize: "var(--text-sm)" }}>
                          {wo.due_date ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(wo.due_date)) : "—"}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", marginBottom: "var(--space-2)", letterSpacing: "0.04em" }}>UPCOMING ({upcoming.length})</div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>ID</th><th>Subject</th><th>Asset</th><th>Priority</th><th>Stage</th><th>Assignee</th><th>Due</th></tr></thead>
              <tbody>
                {isLoading ? <SkeletonRows cols={7} /> :
                  upcoming.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><p>No upcoming work orders with due dates.</p></div></td></tr> :
                  upcoming.map((wo) => (
                    <tr key={wo.id}>
                      <td><HumanId id={wo.human_id} /></td>
                      <td className="truncate" style={{ maxWidth: 200 }}>{wo.subject}</td>
                      <td className="text-secondary truncate" style={{ maxWidth: 140 }}>{wo.equipment_name ?? "—"}</td>
                      <td><PriorityLabel priority={wo.priority} /></td>
                      <td><StatusDot status={wo.status} /></td>
                      <td className="text-secondary">{wo.assignee_name ?? "—"}</td>
                      <td style={{ fontSize: "var(--text-sm)" }}>
                        {wo.due_date ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(wo.due_date)) : "—"}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
