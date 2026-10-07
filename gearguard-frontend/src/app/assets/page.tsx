"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipment, type Equipment } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { HumanId, DateCell, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import Link from "next/link";
import { Plus, Search, ShieldCheck, ClipboardCheck } from "lucide-react";

export default function AssetsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [usableFilter, setUsableFilter] = useState<"" | "true" | "false">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: assets, isLoading } = useQuery({ queryKey: ["equipment"], queryFn: equipment.list });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Equipment> }) => equipment.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast("Updated", "success"); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const canEdit = user?.role === "admin" || user?.role === "manager";

  const filtered = (assets ?? []).filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.serial_number.toLowerCase().includes(search.toLowerCase()) && !a.human_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (usableFilter !== "" && String(a.is_usable) !== usableFilter) return false;
    return true;
  });

  const selected = filtered.find((a) => a.id === selectedId) ?? null;

  return (
    <AppShell>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="topbar">
            <h1 style={{ fontSize: "var(--text-md)", fontWeight: 500 }}>Assets</h1>
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input className="input input-sm" style={{ paddingLeft: 26, width: 200 }} placeholder="Search assets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input input-sm select" value={usableFilter} onChange={(e) => setUsableFilter(e.target.value as "" | "true" | "false")} style={{ width: 130 }}>
              <option value="">All status</option>
              <option value="true">Serviceable</option>
              <option value="false">Out of service</option>
            </select>
            {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={12} /> Add asset</button>}
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Serial</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Assigned to</th>
                    <th>Last service</th>
                    <th style={{ width: 80, textAlign: "right" }}>Open WOs</th>
                    <th>Compliance</th>
                    <th>Serviceable</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? <SkeletonRows cols={11} /> :
                    filtered.length === 0 ? <tr><td colSpan={11}><div className="empty-state"><p>No assets found.</p></div></td></tr> :
                    filtered.map((a) => (
                      <tr key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)} style={{ cursor: "pointer" }} className={selectedId === a.id ? "selected" : ""}>
                        <td><HumanId id={a.human_id} /></td>
                        <td style={{ fontWeight: 450 }}>{a.name}</td>
                        <td className="mono text-secondary" style={{ fontSize: "var(--text-xs)" }}>{a.serial_number}</td>
                        <td className="text-secondary">{a.department}</td>
                        <td className="text-secondary">{a.category ?? "—"}</td>
                        <td className="text-secondary">{a.location ?? "—"}</td>
                        <td>{a.assigned_employee === "Unassigned" ? <span className="text-muted">Unassigned</span> : a.assigned_employee}</td>
                        <td><DateCell date={a.last_service_date} /></td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {a.open_work_order_count > 0 ? <span style={{ color: "var(--amber)", fontWeight: 500 }}>{a.open_work_order_count}</span> : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          {a.audit_status === "passed" ? (
                            <span className="status status-repaired"><span className="status-dot" aria-hidden />Certified</span>
                          ) : a.audit_status === "conditional" ? (
                            <span style={{ color: "var(--amber)", fontSize: "var(--text-xs)", fontWeight: 500 }}>Conditional</span>
                          ) : a.audit_status === "failed" ? (
                            <span className="status status-scrap"><span className="status-dot" aria-hidden />Non-Compliant</span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: "var(--text-xs)" }}>Uninspected</span>
                          )}
                        </td>
                        <td>
                          <span className={`status ${a.is_usable ? "status-repaired" : "status-scrap"}`}>
                            <span className="status-dot" aria-hidden />
                            {a.is_usable ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: "var(--space-2) var(--space-4)", borderTop: "1px solid var(--border)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {filtered.length} assets
          </div>
        </div>

        {selected && (canEdit || user?.role === "auditor") && (
          <div className="inspector">
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><HumanId id={selected.human_id} /><button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>Close</button></div>
              <div style={{ fontWeight: 500 }}>{selected.name}</div>
              <div className="divider" />

              {/* Compliance & Audit Box */}
              <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 5 }}>
                    <ShieldCheck size={14} style={{ color: "var(--primary)" }} /> Audit Status
                  </span>
                  <span style={{ textTransform: "capitalize", fontWeight: 600, fontSize: "var(--text-xs)", color: selected.audit_status === "passed" ? "var(--green)" : selected.audit_status === "failed" ? "var(--red)" : "inherit" }}>
                    {selected.audit_status || "Uninspected"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Last audit: {selected.last_audit_date ? new Date(selected.last_audit_date).toLocaleDateString("en-IN") : "Never"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Next due: {selected.next_audit_due ? new Date(selected.next_audit_due).toLocaleDateString("en-IN") : "Not scheduled"}
                </div>
                {(user?.role === "auditor" || user?.role === "admin") && (
                  <Link
                    href="/compliance"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "11px" }}
                  >
                    <ClipboardCheck size={12} /> Open in Audit Portal
                  </Link>
                )}
              </div>

              {canEdit && (
                <>
                  <div className="field">
                    <label className="label">Serviceable</label>
                    <select className="input input-sm select" value={String(selected.is_usable)} onChange={(e) => updateMutation.mutate({ id: selected.id, body: { is_usable: e.target.value === "true" } })}>
                      <option value="true">Yes</option><option value="false">No</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Assigned employee</label>
                    <input className="input input-sm" defaultValue={selected.assigned_employee} onBlur={(e) => { if (e.target.value !== selected.assigned_employee) updateMutation.mutate({ id: selected.id, body: { assigned_employee: e.target.value } }); }} />
                  </div>
                </>
              )}

              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px var(--space-4)", fontSize: "var(--text-sm)" }}>
                {[["Serial", selected.serial_number], ["Department", selected.department], ["Category", selected.category ?? "—"], ["Location", selected.location ?? "—"], ["Open WOs", String(selected.open_work_order_count)]].map(([k, v]) => (
                  <React.Fragment key={k}><dt style={{ color: "var(--text-muted)" }}>{k}</dt><dd className={k === "Serial" ? "mono" : ""}>{v}</dd></React.Fragment>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewAssetForm onClose={() => setShowNew(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast("Asset added", "success"); setShowNew(false); }} />}
    </AppShell>
  );
}

function NewAssetForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", serial_number: "", department: "General Operations", category: "", location: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError("");
    try { await equipment.create({ name: form.name, serial_number: form.serial_number, department: form.department, category: form.category || undefined, location: form.location || undefined }); onCreated(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 500, marginBottom: "var(--space-4)" }}>Add asset</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {(["name", "serial_number", "department", "category", "location"] as const).map((k) => (
            <div key={k} className="field">
              <label className="label" htmlFor={k}>{k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
              <input id={k} className="input input-sm" value={form[k]} onChange={set(k)} required={k === "name" || k === "serial_number"} />
            </div>
          ))}
          {error && <div role="alert" style={{ color: "var(--red)", fontSize: "var(--text-sm)" }}>{error}</div>}
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-default" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}
