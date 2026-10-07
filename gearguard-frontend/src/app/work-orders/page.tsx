"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search, ShieldCheck, CheckCircle2, AlertOctagon } from "lucide-react";
import { workOrders, equipment, users, compliance, type WorkOrder, type WOStatus, type WOPriority } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, PriorityLabel, HumanId, Age, DateCell, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";

export default function WorkQueuePage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WOStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["work-orders", search, statusFilter, priorityFilter],
    queryFn: () => workOrders.list({
      search: search || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      page_size: 100,
    }),
  });

  const { data: eqList } = useQuery({ queryKey: ["equipment"], queryFn: equipment.list, staleTime: 15 * 60 * 1000 });
  const { data: userList } = useQuery({ queryKey: ["users"], queryFn: users.list, staleTime: 15 * 60 * 1000 });
  const selected = data?.items.find((w) => w.id === selectedId) ?? null;

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<WorkOrder> }) =>
      workOrders.update(id, body as Parameters<typeof workOrders.update>[1]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); toast("Updated", "success"); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const items = data?.items ?? [];

  return (
    <AppShell>
      <div style={{ display: "flex", height: "calc(100dvh - 0px)", overflow: "hidden" }}>
        {/* Main table area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Toolbar */}
          <div className="topbar" style={{ gap: "var(--space-3)", flexShrink: 0 }}>
            <h1 style={{ fontSize: "var(--text-md)", fontWeight: 500 }}>Work Queue</h1>
            <div style={{ flex: 1 }} />
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input className="input input-sm" style={{ paddingLeft: 26, width: 200 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {/* Filters */}
            <select className="input input-sm select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as WOStatus | "")} style={{ width: 120 }}>
              <option value="">All stages</option>
              {["New", "In Progress", "Repaired", "Scrap"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input input-sm select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as WOPriority | "")} style={{ width: 110 }}>
              <option value="">All priorities</option>
              {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>)}
            </select>
            <button className="btn btn-ghost btn-icon" onClick={() => refetch()} title="Refresh"><RefreshCw size={13} /></button>
            {user?.role !== "auditor" && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(true)}>
                <Plus size={12} /> New work order
              </button>
            )}
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>ID</th>
                    <th>Subject</th>
                    <th>Asset</th>
                    <th style={{ width: 90 }}>Type</th>
                    <th style={{ width: 80 }}>Priority</th>
                    <th style={{ width: 110 }}>Stage</th>
                    <th>Assignee</th>
                    <th style={{ width: 100 }}>Due</th>
                    <th style={{ width: 60 }}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={9} />
                  ) : items.length === 0 ? (
                    <tr><td colSpan={9}>
                      <div className="empty-state"><p>No work orders found.</p></div>
                    </td></tr>
                  ) : (
                    items.map((wo) => (
                      <tr
                        key={wo.id}
                        onClick={() => setSelectedId(wo.id === selectedId ? null : wo.id)}
                        style={{ cursor: "pointer" }}
                        className={selectedId === wo.id ? "selected" : ""}
                      >
                        <td><HumanId id={wo.human_id} /></td>
                        <td style={{ maxWidth: 280 }} className="truncate">{wo.subject}</td>
                        <td style={{ maxWidth: 160 }} className="truncate">
                          {wo.equipment_human_id ? <><HumanId id={wo.equipment_human_id} /> <span className="text-secondary">{wo.equipment_name}</span></> : "—"}
                        </td>
                        <td style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{wo.type}</td>
                        <td><PriorityLabel priority={wo.priority} /></td>
                        <td><StatusDot status={wo.status} /></td>
                        <td style={{ fontSize: "var(--text-sm)" }}>{wo.assignee_name ?? <span className="text-muted">Unassigned</span>}</td>
                        <td><DateCell date={wo.due_date} /></td>
                        <td><Age date={wo.created_at} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding: "var(--space-2) var(--space-4)", borderTop: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {data?.total ?? 0} work orders
          </div>
        </div>

        {/* Inspector panel */}
        {selected && (
          <div className="inspector" style={{ width: 360 }}>
            <WorkOrderInspector
              wo={selected}
              eqList={eqList ?? []}
              userList={userList ?? []}
              onUpdate={(body) => updateMutation.mutate({ id: selected.id, body })}
              onClose={() => setSelectedId(null)}
              canEdit={user?.role !== "auditor" && user?.role !== "user"}
            />
          </div>
        )}
      </div>

      {/* New work order modal */}
      {showNewForm && (
        <NewWorkOrderForm
          eqList={eqList ?? []}
          userList={userList ?? []}
          onClose={() => setShowNewForm(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["work-orders"] }); toast("Work order created", "success"); setShowNewForm(false); }}
        />
      )}
    </AppShell>
  );
}

// ── Inspector ─────────────────────────────────────────────────────────────

function WorkOrderInspector({
  wo, eqList, userList, onUpdate, onClose, canEdit,
}: {
  wo: WorkOrder;
  eqList: import("@/lib/api").Equipment[];
  userList: import("@/lib/api").User[];
  onUpdate: (body: Record<string, unknown>) => void;
  onClose: () => void;
  canEdit: boolean;
}) {
  const [comment, setComment] = useState("");
  const toast = useToast();
  const qc = useQueryClient();

  const commentMutation = useMutation({
    mutationFn: () => workOrders.comment(wo.id, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); setComment(""); toast("Comment added", "success"); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const technicians = userList.filter((u) => u.role === "technician");

  return (
    <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <HumanId id={wo.human_id} />
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>

      <div>
        <div style={{ fontWeight: 500, fontSize: "var(--text-md)", marginBottom: "var(--space-1)" }}>{wo.subject}</div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <StatusDot status={wo.status} />
          <PriorityLabel priority={wo.priority} />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{wo.type}</span>
        </div>
      </div>

      <div className="divider" />

      {/* Inline edits */}
      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="field">
            <label className="label">Stage</label>
            <select className="input input-sm select" value={wo.status} onChange={(e) => onUpdate({ status: e.target.value })}>
              {["New", "In Progress", "Repaired", "Scrap"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Priority</label>
            <select className="input input-sm select" value={wo.priority} onChange={(e) => onUpdate({ priority: e.target.value })}>
              {["low", "medium", "high", "critical"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Assignee</label>
            <select className="input input-sm select" value={wo.assignee_id ?? ""} onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}>
              <option value="">Unassigned</option>
              {technicians.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="divider" />

      {/* Meta */}
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px var(--space-4)", fontSize: "var(--text-sm)" }}>
        {[
          ["Asset", wo.equipment_name ?? "—"],
          ["Creator", wo.creator_name ?? "—"],
          ["Due", wo.due_date ? new Date(wo.due_date).toLocaleDateString("en-IN") : "—"],
          ["Downtime", wo.downtime_minutes != null ? `${wo.downtime_minutes} min` : "—"],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>

      <div className="divider" />

      {/* Compliance Review Section */}
      <ComplianceReviewSection wo={wo} />

      <div className="divider" />

      {/* Comments */}
      <div>
        <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>Activity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          {wo.comments.length === 0 && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No comments yet.</p>}
          {wo.comments.map((c, i) => (
            <div key={i} style={{ fontSize: "var(--text-sm)" }}>
              <span style={{ fontWeight: 500 }}>{c.author_name}</span>{" "}
              <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>{new Date(c.created_at).toLocaleDateString("en-IN")}</span>
              <div style={{ marginTop: 2, color: "var(--text-secondary)" }}>{c.text}</div>
            </div>
          ))}
        </div>

        {canEdit && (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <input className="input input-sm" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate(); }} style={{ flex: 1 }} />
            <button className="btn btn-default btn-sm" onClick={() => commentMutation.mutate()} disabled={!comment.trim()}>Post</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New work order form ───────────────────────────────────────────────────

function NewWorkOrderForm({
  eqList, userList, onClose, onCreated,
}: {
  eqList: import("@/lib/api").Equipment[];
  userList: import("@/lib/api").User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ equipment_id: "", subject: "", type: "Corrective", priority: "medium", assignee_id: "" });
  const [error, setError] = useState("");
  const toast = useToast();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await workOrders.create({
        equipment_id: form.equipment_id,
        subject: form.subject,
        type: form.type as import("@/lib/api").WOType,
        priority: form.priority as import("@/lib/api").WOPriority,
        assignee_id: form.assignee_id || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const technicians = userList.filter((u) => u.role === "technician");

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 500, marginBottom: "var(--space-4)" }}>New work order</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="field">
            <label className="label" htmlFor="equipment">Asset</label>
            <select id="equipment" className="input input-sm select" value={form.equipment_id} onChange={set("equipment_id")} required>
              <option value="">Select asset…</option>
              {eqList.filter((e) => e.is_usable).map((e) => <option key={e.id} value={e.id}>{e.human_id} — {e.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="subject">Subject</label>
            <input id="subject" className="input input-sm" value={form.subject} onChange={set("subject")} required placeholder="Describe the work required" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div className="field">
              <label className="label">Type</label>
              <select className="input input-sm select" value={form.type} onChange={set("type")}>
                <option>Corrective</option><option>Preventive</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Priority</label>
              <select className="input input-sm select" value={form.priority} onChange={set("priority")}>
                {["low", "medium", "high", "critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Assignee</label>
            <select className="input input-sm select" value={form.assignee_id} onChange={set("assignee_id")}>
              <option value="">Unassigned</option>
              {technicians.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {error && <div role="alert" style={{ color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</div>}
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-default" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ComplianceReviewSection({ wo }: { wo: WorkOrder }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState("");

  const reviewMutation = useMutation({
    mutationFn: (status: "certified" | "flagged") =>
      compliance.reviewWorkOrder(wo.id, {
        status,
        notes: notes || (status === "certified" ? "Post-repair procedures and downtime verified." : "Flagged non-conformance for investigation."),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast("Compliance review saved", "success");
      setNotes("");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const isCertified = wo.audit_status === "certified";
  const isFlagged = wo.audit_status === "flagged";
  const canAudit = user?.role === "auditor" || user?.role === "admin";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldCheck size={14} style={{ color: "var(--primary)" }} /> Compliance Sign-Off
        </span>
        {isCertified ? (
          <span style={{ color: "var(--green)", fontSize: "var(--text-xs)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={12} /> Certified
          </span>
        ) : isFlagged ? (
          <span style={{ color: "var(--red)", fontSize: "var(--text-xs)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertOctagon size={12} /> Flagged
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Pending Review</span>
        )}
      </div>

      {wo.audited_by && (
        <div style={{ fontSize: "11px", color: isFlagged ? "var(--red)" : "var(--text-secondary)", lineHeight: 1.4 }}>
          🛡️ Reviewed by <strong>{wo.audited_by}</strong>: {wo.audit_notes}
        </div>
      )}

      {canAudit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <input
            className="input input-sm"
            placeholder="Auditor observation note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ fontSize: "11px" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => reviewMutation.mutate("certified")}
              disabled={reviewMutation.isPending}
              style={{ flex: 1, fontSize: "11px", color: "var(--green)" }}
            >
              <CheckCircle2 size={12} /> Certify
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => reviewMutation.mutate("flagged")}
              disabled={reviewMutation.isPending}
              style={{ flex: 1, fontSize: "11px", color: "var(--red)" }}
            >
              <AlertOctagon size={12} /> Flag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
