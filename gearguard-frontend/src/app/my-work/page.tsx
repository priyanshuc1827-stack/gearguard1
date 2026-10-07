"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workOrders, ApiError } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { PriorityLabel, HumanId, DateCell, SkeletonRows } from "@/components/custom/display";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/components/ui/toast";

// ── Types ────────────────────────────────────────────────────────────────────
type TechAction = {
  label: string;
  nextStatus: string;
  variant: "default" | "danger" | "success";
  requiresNote: boolean;
  icon: string;
  confirmLabel: string;
  placeholder: string;
};

function getActions(status: string): TechAction[] {
  if (status === "New") {
    return [{
      label: "Start Work",
      nextStatus: "In Progress",
      variant: "default",
      requiresNote: false,
      icon: "▶",
      confirmLabel: "Start Work",
      placeholder: "Any preparation notes… (optional)",
    }];
  }
  if (status === "In Progress") {
    return [
      {
        label: "Mark as Repaired",
        nextStatus: "Repaired",
        variant: "success",
        requiresNote: false,
        icon: "✓",
        confirmLabel: "Confirm Repair",
        placeholder: "What was done to fix the issue… (optional)",
      },
      {
        label: "Scrap Equipment",
        nextStatus: "Scrap",
        variant: "danger",
        requiresNote: true,
        icon: "✕",
        confirmLabel: "Confirm Scrap",
        placeholder: "Explain why the equipment cannot be repaired…",
      },
    ];
  }
  return [];
}

// ── Stage badge ───────────────────────────────────────────────────────────────
function StageBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    "New":         { label: "New",         color: "#2563eb", bg: "rgba(37,99,235,0.08)"   },
    "In Progress": { label: "In Progress", color: "#d97706", bg: "rgba(217,119,6,0.08)"  },
    "Repaired":    { label: "Repaired",    color: "#16a34a", bg: "rgba(22,163,74,0.08)"  },
    "Scrap":       { label: "Scrapped",    color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
  };
  const c = map[status] ?? { label: status, color: "var(--text-muted)", bg: "transparent" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
      background: c.bg, color: c.color, border: `1px solid ${c.color}25`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
      {c.label}
    </span>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ActionModal({
  action, subject, onConfirm, onClose, isPending,
}: {
  action: TechAction;
  subject: string;
  onConfirm: (opts: { downtime_minutes?: number; note?: string }) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [downtime, setDowntime] = useState("");
  const [note, setNote] = useState("");
  const canSubmit = !isPending && (!action.requiresNote || note.trim().length > 0);

  const accent =
    action.variant === "danger"  ? "#ef4444" :
    action.variant === "success" ? "#22c55e" :
    "var(--accent, #d97706)";

  const accentBg =
    action.variant === "danger"  ? "rgba(239,68,68,0.08)" :
    action.variant === "success" ? "rgba(34,197,94,0.08)"  :
    "rgba(217,119,6,0.08)";

  return (
    <div
      onClick={() => !isPending && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm({
            downtime_minutes: downtime ? parseInt(downtime, 10) : undefined,
            note: note.trim() || undefined,
          });
        }}
        style={{
          background: "var(--bg-elevated, #fff)",
          border: "1px solid var(--border, #e8e7e5)",
          borderRadius: 10, width: "100%", maxWidth: 420,
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Colour stripe */}
        <div style={{ height: 3, background: accent }} />

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700,
              background: accentBg, color: accent, border: `1px solid ${accent}30`,
            }}>
              {action.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                {action.label}
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-muted)", marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300,
              }}>
                {subject}
              </div>
            </div>
          </div>

          {/* Downtime */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              Downtime (minutes)
              <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>— optional</span>
            </label>
            <input
              className="input"
              type="number" min={0} max={99999}
              placeholder="e.g. 90"
              value={downtime}
              onChange={(e) => setDowntime(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              {action.requiresNote ? "Reason" : "Resolution Notes"}
              {action.requiresNote
                ? <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
                : <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>— optional</span>
              }
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder={action.placeholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: "100%", resize: "vertical", minHeight: 76, fontSize: 13 }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={isPending}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm"
              disabled={!canSubmit}
              style={{
                background: canSubmit ? accent : "var(--text-muted)",
                color: "#fff", border: "none", minWidth: 120,
                opacity: canSubmit ? 1 : 0.55,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {isPending ? "Saving…" : action.confirmLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyWorkPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    action: TechAction; woId: string; subject: string;
  } | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-work", user?.id],
    queryFn: () => workOrders.list({ assignee_id: user?.id, page_size: 200 }),
    enabled: !!user,
    retry: (n, err) =>
      !(err instanceof ApiError && (err.status === 401 || err.status === 403)) && n < 2,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({
      id, status, downtime_minutes, note,
    }: { id: string; status: string; downtime_minutes?: number; note?: string }) => {
      const body: Parameters<typeof workOrders.update>[1] = {
        status: status as Parameters<typeof workOrders.update>[1]["status"],
      };
      if (downtime_minutes !== undefined) body.downtime_minutes = downtime_minutes;
      const updated = await workOrders.update(id, body);
      if (note?.trim()) await workOrders.comment(id, `[${status}] ${note.trim()}`);
      return updated;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["my-work"] });
      setPendingAction(null);
      toast(`Marked as "${vars.status}"`, "success");
    },
    onError: (err: unknown) => {
      setPendingAction(null);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403))
        toast("Session expired — please log in again.", "error");
      else if (err instanceof ApiError)
        toast(`Error ${err.status}: ${err.message}`, "error");
      else if (err instanceof TypeError)
        toast("Network error — check the backend is running.", "error");
      else
        toast("Unexpected error. Please try again.", "error");
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      workOrders.comment(id, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-work"] }); setComment(""); },
    onError: () => toast("Could not post comment.", "error"),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const items   = data?.items ?? [];
  const selected = items.find((w) => w.id === selectedId) ?? null;
  const open    = items.filter((w) => w.status !== "Repaired" && w.status !== "Scrap");
  const done    = items.filter((w) => w.status === "Repaired" || w.status === "Scrap");

  const fetchError = (() => {
    if (!error) return null;
    if (error instanceof ApiError && (error.status === 401 || error.status === 403))
      return "Session expired. Please log in again.";
    if (error instanceof TypeError)
      return "Cannot connect to the server. Make sure the backend is running.";
    return "Failed to load work orders.";
  })();

  return (
    <AppShell>
      {/* Confirm modal */}
      {pendingAction && (
        <ActionModal
          action={pendingAction.action}
          subject={pendingAction.subject}
          isPending={updateMutation.isPending}
          onClose={() => !updateMutation.isPending && setPendingAction(null)}
          onConfirm={({ downtime_minutes, note }) =>
            updateMutation.mutate({
              id: pendingAction.woId,
              status: pendingAction.action.nextStatus,
              downtime_minutes,
              note,
            })
          }
        />
      )}

      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        {/* ── List panel ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Topbar */}
          <div className="topbar">
            <h1 style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>My Work</h1>
            <div style={{ flex: 1 }} />
            {!fetchError && !isLoading && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500 }}>
                {open.length} open · {done.length} done
              </span>
            )}
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => refetch()}
              disabled={isLoading}
              title="Refresh"
              style={{ marginLeft: 8 }}
            >
              ↺
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

            {/* Error banner */}
            {fetchError && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "var(--red-subtle, #fef2f2)",
                border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
                padding: "10px 14px", marginBottom: 16,
                fontSize: 13, color: "#dc2626",
              }}>
                <span>⚠</span>
                <span style={{ flex: 1 }}>{fetchError}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => refetch()}
                  style={{ color: "#dc2626", fontSize: 12 }}>Retry</button>
              </div>
            )}

            {/* ── Open orders ────────────────────────────────────────── */}
            {(isLoading || open.length > 0) && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
                }}>
                  Open Work Orders
                  {!isLoading && <span style={{ fontWeight: 400, marginLeft: 6 }}>({open.length})</span>}
                </div>

                {isLoading ? (
                  <div className="table-container">
                    <table className="data-table">
                      <tbody><SkeletonRows cols={4} rows={3} /></tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {open.map((wo) => {
                      const acts = getActions(wo.status);
                      const isSel = wo.id === selectedId;
                      return (
                        <div
                          key={wo.id}
                          onClick={() => setSelectedId(isSel ? null : wo.id)}
                          style={{
                            background: isSel
                              ? "var(--accent-subtle, #fef3c7)"
                              : "var(--bg-elevated, #fff)",
                            border: `1px solid ${isSel ? "var(--accent, #d97706)" : "var(--border, #e8e7e5)"}`,
                            borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                            transition: "border-color 0.12s, background 0.12s",
                          }}
                        >
                          {/* Row: id + subject + badges */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: acts.length > 0 ? 10 : 0 }}>
                            <HumanId id={wo.human_id} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: 500, fontSize: 13, color: "var(--text)", marginBottom: 2,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {wo.subject}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {wo.equipment_name ?? "No asset"}
                                {wo.due_date && (
                                  <span style={{ marginLeft: 8 }}>· Due <DateCell date={wo.due_date} /></span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                              <StageBadge status={wo.status} />
                              <PriorityLabel priority={wo.priority} />
                            </div>
                          </div>

                          {/* Action buttons */}
                          {acts.length > 0 && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "flex", gap: 6, flexWrap: "wrap",
                                paddingTop: 10, borderTop: "1px solid var(--border, #e8e7e5)",
                              }}
                            >
                              {acts.map((act) => (
                                <button
                                  key={act.nextStatus}
                                  disabled={updateMutation.isPending}
                                  onClick={() => setPendingAction({ action: act, woId: wo.id, subject: wo.subject })}
                                  style={{
                                    fontSize: 12, fontWeight: 500,
                                    padding: "4px 12px", borderRadius: 6,
                                    display: "inline-flex", alignItems: "center", gap: 5,
                                    cursor: updateMutation.isPending ? "not-allowed" : "pointer",
                                    background:
                                      act.variant === "danger"  ? "rgba(220,38,38,0.06)"  :
                                      act.variant === "success" ? "rgba(22,163,74,0.06)"  :
                                      "var(--bg-sunken, #f5f5f4)",
                                    color:
                                      act.variant === "danger"  ? "#dc2626" :
                                      act.variant === "success" ? "#15803d" :
                                      "var(--text-secondary)",
                                    border: `1px solid ${
                                      act.variant === "danger"  ? "rgba(220,38,38,0.25)" :
                                      act.variant === "success" ? "rgba(22,163,74,0.25)" :
                                      "var(--border, #e8e7e5)"
                                    }`,
                                  }}
                                >
                                  <span style={{ fontSize: 10 }}>{act.icon}</span>
                                  {act.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Done orders ─────────────────────────────────────────── */}
            {done.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
                }}>
                  Completed ({done.length})
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Subject</th>
                        <th>Asset</th>
                        <th>Outcome</th>
                        <th style={{ textAlign: "right" }}>Downtime</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {done.map((wo) => (
                        <tr
                          key={wo.id}
                          onClick={() => setSelectedId(wo.id === selectedId ? null : wo.id)}
                          style={{ cursor: "pointer" }}
                          className={selectedId === wo.id ? "selected" : ""}
                        >
                          <td><HumanId id={wo.human_id} /></td>
                          <td className="truncate" style={{ maxWidth: 220 }}>{wo.subject}</td>
                          <td className="text-secondary truncate" style={{ maxWidth: 130, fontSize: 12 }}>
                            {wo.equipment_name ?? "—"}
                          </td>
                          <td><StageBadge status={wo.status} /></td>
                          <td className="mono" style={{ textAlign: "right", fontSize: 12 }}>
                            {wo.downtime_minutes != null ? `${wo.downtime_minutes} min` : "—"}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <DateCell date={wo.completed_at ?? wo.updated_at} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !fetchError && items.length === 0 && (
              <div className="empty-state">
                <p>No work orders assigned to you.</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Contact your manager if you expected tasks here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Inspector panel ─────────────────────────────────────────── */}
        {selected && (
          <div className="inspector" style={{ minWidth: 280, maxWidth: 320 }}>
            <div style={{
              padding: 16, display: "flex", flexDirection: "column",
              gap: 14, height: "100%", overflowY: "auto",
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <HumanId id={selected.human_id} />
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>✕</button>
              </div>

              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.45, color: "var(--text)" }}>
                {selected.subject}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StageBadge status={selected.status} />
                <PriorityLabel priority={selected.priority} />
              </div>

              <div style={{ height: 1, background: "var(--border)" }} />

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  ["Asset",      selected.equipment_name ?? "—"],
                  ["Department", selected.equipment_department ?? "—"],
                  ["Location",   selected.equipment_location as string ?? "—"],
                  ["Type",       selected.type],
                  ["Due date",   selected.due_date ? new Date(selected.due_date).toLocaleDateString("en-IN") : "—"],
                  ["Started",    selected.started_at ? new Date(selected.started_at).toLocaleDateString("en-IN") : "Not started"],
                  ["Downtime",   selected.downtime_minutes != null ? `${selected.downtime_minutes} min` : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{
                      fontSize: 12, color: "var(--text-secondary)", textAlign: "right",
                      maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              {getActions(selected.status).length > 0 && (
                <>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                    letterSpacing: "0.07em", textTransform: "uppercase",
                  }}>
                    Actions
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {getActions(selected.status).map((act) => (
                      <button
                        key={act.nextStatus}
                        className="btn btn-sm"
                        disabled={updateMutation.isPending}
                        onClick={() => setPendingAction({ action: act, woId: selected.id, subject: selected.subject })}
                        style={{
                          textAlign: "left", justifyContent: "flex-start", gap: 8,
                          fontSize: 12, fontWeight: 500,
                          background:
                            act.variant === "danger"  ? "rgba(220,38,38,0.05)"  :
                            act.variant === "success" ? "rgba(22,163,74,0.05)"  :
                            "var(--bg-sunken)",
                          color:
                            act.variant === "danger"  ? "#dc2626" :
                            act.variant === "success" ? "#15803d" :
                            "var(--text-secondary)",
                          border: `1px solid ${
                            act.variant === "danger"  ? "rgba(220,38,38,0.2)"  :
                            act.variant === "success" ? "rgba(22,163,74,0.2)"  :
                            "var(--border)"
                          }`,
                        }}
                      >
                        <span>{act.icon}</span> {act.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div style={{ height: 1, background: "var(--border)" }} />

              {/* Activity */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                letterSpacing: "0.07em", textTransform: "uppercase",
              }}>
                Activity
              </div>

              {selected.comments.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No comments yet.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 180, overflowY: "auto" }}>
                {selected.comments.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                        {c.author_name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(c.created_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {c.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Post comment */}
              <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 4 }}>
                <input
                  className="input input-sm"
                  placeholder="Add comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && comment.trim())
                      commentMutation.mutate({ id: selected.id, text: comment });
                  }}
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button
                  className="btn btn-default btn-sm"
                  onClick={() => commentMutation.mutate({ id: selected.id, text: comment })}
                  disabled={!comment.trim() || commentMutation.isPending}
                  style={{ fontSize: 12 }}
                >
                  {commentMutation.isPending ? "…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
