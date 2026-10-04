"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workOrders } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, PriorityLabel, HumanId, DateCell, SkeletonRows } from "@/components/custom/display";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/components/ui/toast";

export default function MyWorkPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-work", user?.id],
    queryFn: () => workOrders.list({ assignee_id: user?.id, page_size: 200 }),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      workOrders.update(id, body as Parameters<typeof workOrders.update>[1]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-work"] }); toast("Updated", "success"); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => workOrders.comment(id, text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-work"] }); setComment(""); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const items = data?.items ?? [];
  const selected = items.find((w) => w.id === selectedId) ?? null;
  const open = items.filter((w) => w.status !== "Repaired" && w.status !== "Scrap");
  const done = items.filter((w) => w.status === "Repaired" || w.status === "Scrap");

  const nextStatus = (s: string) =>
    s === "New" ? "In Progress" : s === "In Progress" ? "Repaired" : null;

  return (
    <AppShell>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="topbar">
            <h1 style={{ fontSize: "var(--text-md)", fontWeight: 500 }}>My Work</h1>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{open.length} open</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
            {open.length > 0 && (
              <>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", marginBottom: "var(--space-2)", letterSpacing: "0.04em" }}>OPEN</div>
                <div className="table-container" style={{ marginBottom: "var(--space-6)" }}>
                  <table className="data-table">
                    <thead><tr><th>ID</th><th>Subject</th><th>Asset</th><th>Priority</th><th>Stage</th><th>Due</th><th>Action</th></tr></thead>
                    <tbody>
                      {isLoading ? <SkeletonRows cols={7} /> : open.map((wo) => {
                        const next = nextStatus(wo.status);
                        return (
                          <tr key={wo.id} onClick={() => setSelectedId(wo.id === selectedId ? null : wo.id)} style={{ cursor: "pointer" }} className={selectedId === wo.id ? "selected" : ""}>
                            <td><HumanId id={wo.human_id} /></td>
                            <td className="truncate" style={{ maxWidth: 220 }}>{wo.subject}</td>
                            <td className="truncate text-secondary" style={{ maxWidth: 140, fontSize: "var(--text-sm)" }}>{wo.equipment_name ?? "—"}</td>
                            <td><PriorityLabel priority={wo.priority} /></td>
                            <td><StatusDot status={wo.status} /></td>
                            <td><DateCell date={wo.due_date} /></td>
                            <td>
                              {next && (
                                <button className="btn btn-default btn-sm" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: wo.id, body: { status: next } }); }}>
                                  → {next}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {done.length > 0 && (
              <>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", marginBottom: "var(--space-2)", letterSpacing: "0.04em" }}>COMPLETED</div>
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>ID</th><th>Subject</th><th>Stage</th><th>Downtime</th></tr></thead>
                    <tbody>
                      {done.map((wo) => (
                        <tr key={wo.id}>
                          <td><HumanId id={wo.human_id} /></td>
                          <td className="truncate" style={{ maxWidth: 280 }}>{wo.subject}</td>
                          <td><StatusDot status={wo.status} /></td>
                          <td className="mono" style={{ fontSize: "var(--text-sm)" }}>{wo.downtime_minutes != null ? `${wo.downtime_minutes} min` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!isLoading && items.length === 0 && <div className="empty-state"><p>No work orders assigned to you.</p></div>}
          </div>
        </div>

        {/* Inspector */}
        {selected && (
          <div className="inspector">
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><HumanId id={selected.human_id} /><button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>Close</button></div>
              <div style={{ fontWeight: 500 }}>{selected.subject}</div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}><StatusDot status={selected.status} /><PriorityLabel priority={selected.priority} /></div>
              <div className="divider" />
              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px var(--space-4)", fontSize: "var(--text-sm)" }}>
                {[["Asset", selected.equipment_name ?? "—"], ["Type", selected.type], ["Downtime", selected.downtime_minutes != null ? `${selected.downtime_minutes} min` : "—"]].map(([k, v]) => (
                  <React.Fragment key={k}><dt style={{ color: "var(--text-muted)" }}>{k}</dt><dd>{v}</dd></React.Fragment>
                ))}
              </dl>
              <div className="divider" />
              <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {selected.comments.map((c, i) => (
                  <div key={i} style={{ fontSize: "var(--text-sm)" }}>
                    <span style={{ fontWeight: 500 }}>{c.author_name}</span>{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>{new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                    <div style={{ marginTop: 2, color: "var(--text-secondary)" }}>{c.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <input className="input input-sm" placeholder="Add comment…" value={comment} onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate({ id: selected.id, text: comment }); }} style={{ flex: 1 }} />
                <button className="btn btn-default btn-sm" onClick={() => commentMutation.mutate({ id: selected.id, text: comment })} disabled={!comment.trim()}>Post</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
