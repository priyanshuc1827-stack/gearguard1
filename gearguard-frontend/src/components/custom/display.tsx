import React from "react";
import type { WOStatus, WOPriority, RequestStatus } from "@/lib/api";

// ── Status dot (static, never animated) ──────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  "New": "status-new",
  "In Progress": "status-progress",
  "Repaired": "status-repaired",
  "Scrap": "status-scrap",
  "Pending": "status-pending",
  "Approved": "status-approved",
  "Rejected": "status-rejected",
  "Allocated": "status-approved",
  "Returned": "status-pending",
};

export function StatusDot({ status }: { status: WOStatus | RequestStatus }) {
  const cls = STATUS_CLASS[status] ?? "";
  return (
    <span className={`status ${cls}`}>
      <span className="status-dot" aria-hidden />
      {status}
    </span>
  );
}

// ── Priority label ────────────────────────────────────────────────────────

const PRIORITY_CLASS: Record<WOPriority, string> = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
  critical: "priority-critical",
};

export function PriorityLabel({ priority }: { priority: WOPriority }) {
  return (
    <span className={PRIORITY_CLASS[priority]} style={{ fontSize: "var(--text-sm)", textTransform: "capitalize" }}>
      {priority}
    </span>
  );
}

// ── Human-readable ID (monospace) ─────────────────────────────────────────

export function HumanId({ id }: { id: string }) {
  return <span className="mono">{id}</span>;
}

// ── Age from date ─────────────────────────────────────────────────────────

export function Age({ date }: { date: string }) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor(ms / 3_600_000);
  const label = days > 0 ? `${days}d` : `${hours}h`;
  return <span className="mono text-secondary" style={{ fontSize: "var(--text-sm)" }}>{label}</span>;
}

// ── Formatted date ────────────────────────────────────────────────────────

export function DateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted">—</span>;
  return (
    <span style={{ fontSize: "var(--text-sm)" }}>
      {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date))}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────

export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "10px 12px" }}>
              <div className="skeleton" style={{ height: 14, width: `${60 + Math.random() * 30}%`, borderRadius: "var(--radius-sm)" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
