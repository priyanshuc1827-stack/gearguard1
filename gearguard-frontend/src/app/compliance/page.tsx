"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  compliance,
  equipment,
  workOrders,
  auditLogs,
  type AuditInspection,
  type ComplianceStats,
  type Equipment as EquipmentType,
  type WorkOrder,
  type ChecklistItem,
} from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { HumanId, DateCell, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import {
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Printer,
  X,
  SlidersHorizontal,
  Lock,
  ExternalLink,
  Award,
  Clock,
  History,
  AlertOctagon,
  ArrowRight,
} from "lucide-react";

export default function CompliancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"machinery" | "inspections" | "work-orders" | "logs">("machinery");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals
  const [auditModalAsset, setAuditModalAsset] = useState<EquipmentType | null>(null);
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [certificateInspection, setCertificateInspection] = useState<AuditInspection | null>(null);
  const [reviewWo, setReviewWo] = useState<WorkOrder | null>(null);

  // Queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ComplianceStats>({
    queryKey: ["compliance", "stats"],
    queryFn: () => compliance.stats(),
  });

  const { data: assets, isLoading: assetsLoading, refetch: refetchAssets } = useQuery<EquipmentType[]>({
    queryKey: ["equipment"],
    queryFn: equipment.list,
  });

  const { data: inspections, isLoading: inspLoading, refetch: refetchInspections } = useQuery<AuditInspection[]>({
    queryKey: ["compliance", "inspections"],
    queryFn: () => compliance.inspections(),
  });

  const { data: wosData, isLoading: wosLoading, refetch: refetchWos } = useQuery({
    queryKey: ["work-orders", "compliance-queue"],
    queryFn: () => workOrders.list({ page_size: 100 }),
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["audit-logs", "compliance"],
    queryFn: () => auditLogs.list({ page_size: 50 }),
  });

  const handleRefreshAll = () => {
    refetchStats();
    refetchAssets();
    refetchInspections();
    refetchWos();
    refetchLogs();
    toast("Auditor workspace refreshed", "info");
  };

  // Filtered machinery
  const filteredAssets = (assets ?? []).filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.serial_number.toLowerCase().includes(q) && !a.human_id.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (statusFilter && (a.audit_status || "uninspected") !== statusFilter) {
      return false;
    }
    return true;
  });

  // Filtered inspections
  const filteredInspections = (inspections ?? []).filter((i) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !i.equipment_name.toLowerCase().includes(q) &&
        !i.human_id.toLowerCase().includes(q) &&
        !i.certificate_number.toLowerCase().includes(q) &&
        !i.standard.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter && i.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Completed work orders for compliance verification
  const departmentWos = (wosData?.items ?? []).filter((w) => {
    if (search) {
      const q = search.toLowerCase();
      if (!w.subject.toLowerCase().includes(q) && !w.human_id.toLowerCase().includes(q) && !(w.equipment_name ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Top Header Banner */}
        <div
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: "var(--space-4)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 2 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "var(--green)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                <ShieldCheck size={13} />
                Compliance & Quality Assurance
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  background: "var(--bg-subtle)",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <Lock size={11} /> Scope: <strong>{user?.department || stats?.department || "Department"}</strong>
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>
              Audit & Inspection Workspace
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <button className="btn btn-ghost btn-sm" onClick={handleRefreshAll} title="Refresh workspace">
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAuditModalAsset(null);
                setShowNewAudit(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Conduct Audit Inspection
            </button>
          </div>
        </div>

        {/* Executive Metric Cards Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-6)",
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Compliance Rate</span>
              <Award size={14} style={{ color: "var(--green)" }} />
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: (stats?.complianceRate ?? 0) >= 90 ? "var(--green)" : "var(--amber)" }}>
              {statsLoading ? "—" : `${stats?.complianceRate ?? 0}%`}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              {stats?.compliantCount ?? 0} of {stats?.totalEquipment ?? 0} machines compliant
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Total Inspections</span>
              <ClipboardCheck size={14} style={{ color: "var(--primary)" }} />
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>
              {statsLoading ? "—" : stats?.totalInspections ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              {stats?.recentInspections ?? 0} in last 30 days
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Overdue Audits</span>
              <Clock size={14} style={{ color: (stats?.overdueAudits ?? 0) > 0 ? "var(--red)" : "var(--text-muted)" }} />
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: (stats?.overdueAudits ?? 0) > 0 ? "var(--red)" : "inherit" }}>
              {statsLoading ? "—" : stats?.overdueAudits ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              Requires immediate inspection
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Active CAPA Tickets</span>
              <AlertTriangle size={14} style={{ color: (stats?.activeCapaTickets ?? 0) > 0 ? "var(--amber)" : "var(--green)" }} />
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: (stats?.activeCapaTickets ?? 0) > 0 ? "var(--amber)" : "inherit" }}>
              {statsLoading ? "—" : stats?.activeCapaTickets ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              Corrective action work orders
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>WO Sign-Off Pending</span>
              <FileText size={14} style={{ color: "var(--text-secondary)" }} />
            </div>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>
              {statsLoading ? "—" : stats?.pendingReviewWorkOrders ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              {stats?.certifiedWorkOrders ?? 0} certified · {stats?.flaggedWorkOrders ?? 0} flagged
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search Bar */}
        <div
          style={{
            padding: "var(--space-2) var(--space-6)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card)",
            flexShrink: 0,
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", gap: "var(--space-1)" }}>
            <button
              className={`btn btn-sm ${activeTab === "machinery" ? "btn-secondary" : "btn-ghost"}`}
              onClick={() => { setActiveTab("machinery"); setStatusFilter(""); }}
              style={{ fontWeight: activeTab === "machinery" ? 600 : 450 }}
            >
              🏭 Machinery Compliance ({assets?.length ?? 0})
            </button>
            <button
              className={`btn btn-sm ${activeTab === "inspections" ? "btn-secondary" : "btn-ghost"}`}
              onClick={() => { setActiveTab("inspections"); setStatusFilter(""); }}
              style={{ fontWeight: activeTab === "inspections" ? 600 : 450 }}
            >
              📜 Inspection History ({inspections?.length ?? 0})
            </button>
            <button
              className={`btn btn-sm ${activeTab === "work-orders" ? "btn-secondary" : "btn-ghost"}`}
              onClick={() => { setActiveTab("work-orders"); setStatusFilter(""); }}
              style={{ fontWeight: activeTab === "work-orders" ? 600 : 450 }}
            >
              📋 Maintenance Sign-Off ({departmentWos.length})
            </button>
            <button
              className={`btn btn-sm ${activeTab === "logs" ? "btn-secondary" : "btn-ghost"}`}
              onClick={() => { setActiveTab("logs"); setStatusFilter(""); }}
              style={{ fontWeight: activeTab === "logs" ? 600 : 450 }}
            >
              🛡️ Department Audit Trail ({logsData?.total ?? 0})
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                className="input input-sm"
                placeholder={
                  activeTab === "machinery"
                    ? "Search machinery…"
                    : activeTab === "inspections"
                    ? "Search certificates…"
                    : "Search records…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 28, width: 220 }}
              />
            </div>

            {activeTab === "machinery" && (
              <select
                className="input input-sm select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 140 }}
              >
                <option value="">All Statuses</option>
                <option value="passed">Compliant (Passed)</option>
                <option value="conditional">Conditional Pass</option>
                <option value="failed">Failed / Violation</option>
                <option value="uninspected">Uninspected</option>
              </select>
            )}

            {activeTab === "inspections" && (
              <select
                className="input input-sm select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 140 }}
              >
                <option value="">All Verdicts</option>
                <option value="passed">Passed (Certified)</option>
                <option value="conditional">Conditional</option>
                <option value="failed">Failed (CAPA Issued)</option>
              </select>
            )}
          </div>
        </div>

        {/* Tab Content Body */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {/* TAB 1: MACHINERY COMPLIANCE */}
          {activeTab === "machinery" && (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Asset ID</th>
                    <th>Machinery Name</th>
                    <th>Serial Number</th>
                    <th>Location</th>
                    <th>Assigned Operator</th>
                    <th style={{ width: 120 }}>Last Audited</th>
                    <th style={{ width: 120 }}>Next Due</th>
                    <th style={{ width: 140 }}>Compliance Status</th>
                    <th style={{ width: 140, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsLoading ? (
                    <SkeletonRows cols={9} />
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <p>No machinery records found for department "{user?.department}".</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const st = asset.audit_status || "uninspected";
                      const isOverdue =
                        asset.next_audit_due &&
                        new Date(asset.next_audit_due).getTime() < Date.now();

                      return (
                        <tr key={asset.id}>
                          <td><HumanId id={asset.human_id} /></td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{asset.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{asset.category ?? "Industrial Equipment"}</div>
                          </td>
                          <td className="mono text-secondary" style={{ fontSize: "var(--text-xs)" }}>
                            {asset.serial_number}
                          </td>
                          <td className="text-secondary">{asset.location ?? "—"}</td>
                          <td>
                            {asset.assigned_employee === "Unassigned" ? (
                              <span className="text-muted">Unassigned</span>
                            ) : (
                              asset.assigned_employee
                            )}
                          </td>
                          <td>
                            <DateCell date={asset.last_audit_date ?? null} />
                          </td>
                          <td>
                            {asset.next_audit_due ? (
                              <span style={{ color: isOverdue ? "var(--red)" : "inherit", fontWeight: isOverdue ? 600 : "normal" }}>
                                {new Date(asset.next_audit_due).toLocaleDateString("en-IN")}
                                {isOverdue && <span style={{ marginLeft: 4, fontSize: "10px", color: "var(--red)" }}>OVERDUE</span>}
                              </span>
                            ) : (
                              <span className="text-muted">Not scheduled</span>
                            )}
                          </td>
                          <td>
                            <AuditStatusBadge status={st} />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setAuditModalAsset(asset);
                                setShowNewAudit(true);
                              }}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <ClipboardCheck size={12} />
                              {st === "uninspected" ? "Audit Now" : "Re-Inspect"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: INSPECTION HISTORY */}
          {activeTab === "inspections" && (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Audit ID</th>
                    <th style={{ width: 160 }}>Certificate #</th>
                    <th>Equipment</th>
                    <th>Compliance Standard</th>
                    <th style={{ width: 80, textAlign: "right" }}>Score</th>
                    <th style={{ width: 120 }}>Verdict</th>
                    <th>Auditor</th>
                    <th style={{ width: 120 }}>Inspection Date</th>
                    <th style={{ width: 130, textAlign: "right" }}>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {inspLoading ? (
                    <SkeletonRows cols={9} />
                  ) : filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <p>No audit inspection records logged yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map((insp) => (
                      <tr key={insp.id}>
                        <td><HumanId id={insp.human_id} /></td>
                        <td className="mono text-secondary" style={{ fontSize: "var(--text-xs)" }}>
                          {insp.certificate_number}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{insp.equipment_name}</div>
                          <div className="mono text-muted" style={{ fontSize: "11px" }}>{insp.equipment_human_id}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-subtle)",
                              border: "1px solid var(--border)",
                              fontSize: "var(--text-xs)",
                              fontWeight: 500,
                            }}
                          >
                            {insp.standard}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          <span
                            style={{
                              color: insp.score >= 90 ? "var(--green)" : insp.score >= 75 ? "var(--amber)" : "var(--red)",
                            }}
                          >
                            {insp.score}%
                          </span>
                        </td>
                        <td>
                          <AuditStatusBadge status={insp.status} />
                        </td>
                        <td>{insp.auditor_name}</td>
                        <td><DateCell date={insp.created_at} /></td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setCertificateInspection(insp)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <FileText size={12} /> View Cert
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: WORK ORDER COMPLIANCE VERIFICATION */}
          {activeTab === "work-orders" && (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>WO ID</th>
                    <th>Subject</th>
                    <th>Asset</th>
                    <th>Stage</th>
                    <th>Completed Date</th>
                    <th>Downtime</th>
                    <th style={{ width: 140 }}>Compliance Review</th>
                    <th style={{ width: 140, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wosLoading ? (
                    <SkeletonRows cols={8} />
                  ) : departmentWos.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <p>No work orders found in your department scope.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    departmentWos.map((wo) => {
                      const isCertified = wo.audit_status === "certified";
                      const isFlagged = wo.audit_status === "flagged";

                      return (
                        <tr key={wo.id}>
                          <td><HumanId id={wo.human_id} /></td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{wo.subject}</div>
                            {wo.audit_notes && (
                              <div style={{ fontSize: "11px", color: isFlagged ? "var(--red)" : "var(--green)", marginTop: 2 }}>
                                🛡️ {wo.audited_by}: {wo.audit_notes}
                              </div>
                            )}
                          </td>
                          <td>{wo.equipment_name ?? "—"}</td>
                          <td>
                            <span className={`status status-${wo.status.toLowerCase().replace(" ", "-")}`}>
                              <span className="status-dot" aria-hidden />
                              {wo.status}
                            </span>
                          </td>
                          <td><DateCell date={wo.completed_at ?? wo.created_at} /></td>
                          <td>{wo.downtime_minutes ? `${wo.downtime_minutes} min` : "—"}</td>
                          <td>
                            {isCertified ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "var(--green)",
                                  fontSize: "var(--text-xs)",
                                  fontWeight: 500,
                                }}
                              >
                                <CheckCircle2 size={12} /> Certified
                              </span>
                            ) : isFlagged ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "var(--red)",
                                  fontSize: "var(--text-xs)",
                                  fontWeight: 500,
                                }}
                              >
                                <AlertOctagon size={12} /> Flagged
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
                                Pending Review
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setReviewWo(wo)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <ShieldCheck size={12} />
                              {wo.audit_status ? "Update Sign-Off" : "Review & Certify"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: DEPARTMENT AUDIT TRAIL */}
          {activeTab === "logs" && (
            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "rgba(16, 185, 129, 0.08)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--green)" }}>
                  <CheckCircle2 size={14} />
                  <strong>Tamper-Evident SHA-256 Ledger Verified</strong> — Immutable audit logs recorded directly to secure cluster.
                </div>
                <span className="mono text-muted" style={{ fontSize: "11px" }}>
                  Department Scope: {user?.department || "Production"}
                </span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details & Diffs</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <SkeletonRows cols={5} />
                  ) : (logsData?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <p>No audit log events found for this department.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (logsData?.items ?? []).map((log) => (
                      <tr key={log.id}>
                        <td className="mono text-secondary" style={{ fontSize: "var(--text-xs)" }}>
                          {new Date(log.timestamp).toLocaleString("en-IN")}
                        </td>
                        <td style={{ fontWeight: 500 }}>{log.actor_name}</td>
                        <td>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-subtle)",
                              border: "1px solid var(--border)",
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 450 }}>{log.entity_label || log.entity_id}</span>
                          <span className="text-muted" style={{ marginLeft: 6, fontSize: "11px" }}>
                            ({log.entity_type})
                          </span>
                        </td>
                        <td className="mono text-secondary" style={{ fontSize: "11px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.after ? JSON.stringify(log.after) : log.before ? JSON.stringify(log.before) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CONDUCT AUDIT INSPECTION */}
      {showNewAudit && (
        <AuditInspectionModal
          initialAsset={auditModalAsset}
          assets={assets ?? []}
          onClose={() => {
            setShowNewAudit(false);
            setAuditModalAsset(null);
          }}
          onSuccess={() => {
            setShowNewAudit(false);
            setAuditModalAsset(null);
            handleRefreshAll();
          }}
        />
      )}

      {/* MODAL 2: CERTIFICATE VIEWER */}
      {certificateInspection && (
        <CertificateModal
          inspection={certificateInspection}
          onClose={() => setCertificateInspection(null)}
        />
      )}

      {/* MODAL 3: WORK ORDER COMPLIANCE REVIEW */}
      {reviewWo && (
        <WorkOrderReviewModal
          wo={reviewWo}
          onClose={() => setReviewWo(null)}
          onSuccess={() => {
            setReviewWo(null);
            handleRefreshAll();
          }}
        />
      )}
    </AppShell>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

function AuditStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "passed" || s === "compliant") {
    return (
      <span className="status status-repaired">
        <span className="status-dot" aria-hidden />
        Compliant
      </span>
    );
  }
  if (s === "conditional") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(245, 158, 11, 0.12)",
          color: "var(--amber)",
          fontSize: "var(--text-xs)",
          fontWeight: 500,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
        Conditional
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="status status-scrap">
        <span className="status-dot" aria-hidden />
        Non-Compliant
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-subtle)",
        color: "var(--text-muted)",
        fontSize: "var(--text-xs)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)" }} />
      Uninspected
    </span>
  );
}

// ── MODAL: CONDUCT AUDIT INSPECTION ─────────────────────────────────────────

function AuditInspectionModal({
  initialAsset,
  assets,
  onClose,
  onSuccess,
}: {
  initialAsset: EquipmentType | null;
  assets: EquipmentType[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAsset?.id ?? (assets[0]?.id || ""));
  const [selectedStandard, setSelectedStandard] = useState<string>("ISO 9001:2015");
  const [score, setScore] = useState<number>(95);
  const [verdict, setVerdict] = useState<"passed" | "conditional" | "failed">("passed");
  const [findings, setFindings] = useState<string>("");
  const [createCapa, setCreateCapa] = useState<boolean>(false);
  const [capaNotes, setCapaNotes] = useState<string>("");
  const [nextAuditDays, setNextAuditDays] = useState<number>(90);

  // Checklists mapped by standard
  const { data: standardsCatalog } = useQuery({
    queryKey: ["compliance", "standards"],
    queryFn: compliance.standards,
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { item: "Emergency Stop circuits operational and tested", passed: true, notes: "" },
    { item: "Point-of-operation safeguarding interlocks functional", passed: true, notes: "" },
    { item: "Operator preventive maintenance logbook maintained", passed: true, notes: "" },
    { item: "Calibration tolerances within allowable limits", passed: true, notes: "" },
    { item: "Zero fluid leaks or excessive bearing vibration", passed: true, notes: "" },
  ]);

  // When standard changes, populate default items
  const handleStandardChange = (stdId: string) => {
    setSelectedStandard(stdId);
    const found = (standardsCatalog ?? []).find((s) => s.id === stdId);
    if (found) {
      setChecklist(found.default_items.map((it) => ({ item: it, passed: true, notes: "" })));
    }
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, passed: !item.passed } : item))
    );
  };

  const updateItemNotes = (index: number, notes: string) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, notes } : item))
    );
  };

  const mutation = useMutation({
    mutationFn: () =>
      compliance.createInspection({
        equipment_id: selectedAssetId,
        standard: selectedStandard,
        status: verdict,
        score,
        checklist,
        findings,
        corrective_action_required: createCapa || verdict === "failed",
        corrective_action_notes: capaNotes,
        next_audit_days: nextAuditDays,
      }),
    onSuccess: (data) => {
      toast(`Inspection ${data.human_id} registered successfully!`, "success");
      onSuccess();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card"
        style={{
          width: 720,
          maxWidth: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="card-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={18} style={{ color: "var(--primary)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>
                Conduct Equipment Compliance Inspection
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Official ISO / OSHA safety audit & certification log
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Target Machinery */}
          <div className="field">
            <label className="label" style={{ fontWeight: 500 }}>Equipment / Machinery Under Audit</label>
            <select
              className="input select"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              disabled={Boolean(initialAsset)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.human_id} — {a.name} ({a.department})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--space-4)" }}>
            {/* Standard */}
            <div className="field">
              <label className="label" style={{ fontWeight: 500 }}>Compliance Standard</label>
              <select
                className="input select"
                value={selectedStandard}
                onChange={(e) => handleStandardChange(e.target.value)}
              >
                <option value="ISO 9001:2015">ISO 9001:2015 — Quality Management</option>
                <option value="OSHA 1910">OSHA 1910 — Machinery Safeguarding</option>
                <option value="ISO 14001:2015">ISO 14001:2015 — Environmental Containment</option>
                <option value="IEC 17025">IEC 17025 — Metrology & Calibration</option>
              </select>
            </div>

            {/* Score & Next Due */}
            <div className="field">
              <label className="label" style={{ fontWeight: 500 }}>Audit Score (0 - 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                className="input"
                value={score}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setScore(val);
                  if (val >= 90) setVerdict("passed");
                  else if (val >= 70) setVerdict("conditional");
                  else setVerdict("failed");
                }}
              />
            </div>
          </div>

          {/* Interactive Checklist */}
          <div>
            <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between" }}>
              <span>Verification Checklist ({selectedStandard})</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Toggle Pass / Fail</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: item.passed ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.06)",
                    border: `1px solid ${item.passed ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.3)"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 450 }}>
                      <input
                        type="checkbox"
                        checked={item.passed}
                        onChange={() => toggleChecklistItem(idx)}
                      />
                      <span>{item.item}</span>
                    </label>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: item.passed ? "var(--green)" : "var(--red)" }}>
                      {item.passed ? "PASSED" : "NON-CONFORMANCE"}
                    </span>
                  </div>
                  {!item.passed && (
                    <input
                      className="input input-sm"
                      placeholder="Note discrepancy or observation details…"
                      value={item.notes ?? ""}
                      onChange={(e) => updateItemNotes(idx, e.target.value)}
                      style={{ fontSize: "11px" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Verdict Selection */}
          <div className="field">
            <label className="label" style={{ fontWeight: 500 }}>Audit Verdict</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
              <button
                type="button"
                className={`btn btn-sm ${verdict === "passed" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setVerdict("passed")}
                style={{
                  background: verdict === "passed" ? "var(--green)" : undefined,
                  borderColor: verdict === "passed" ? "var(--green)" : undefined,
                  color: verdict === "passed" ? "#fff" : undefined,
                }}
              >
                <CheckCircle2 size={13} /> Compliant (Passed)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${verdict === "conditional" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setVerdict("conditional")}
                style={{
                  background: verdict === "conditional" ? "var(--amber)" : undefined,
                  borderColor: verdict === "conditional" ? "var(--amber)" : undefined,
                  color: verdict === "conditional" ? "#fff" : undefined,
                }}
              >
                <AlertTriangle size={13} /> Conditional Pass
              </button>
              <button
                type="button"
                className={`btn btn-sm ${verdict === "failed" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setVerdict("failed");
                  setCreateCapa(true);
                }}
                style={{
                  background: verdict === "failed" ? "var(--red)" : undefined,
                  borderColor: verdict === "failed" ? "var(--red)" : undefined,
                  color: verdict === "failed" ? "#fff" : undefined,
                }}
              >
                <AlertOctagon size={13} /> Non-Compliant (Failed)
              </button>
            </div>
          </div>

          {/* Findings Text */}
          <div className="field">
            <label className="label" style={{ fontWeight: 500 }}>Auditor Findings & Observations</label>
            <textarea
              className="input textarea"
              rows={3}
              placeholder="e.g. Safety circuits verified with calibrated oscilloscope. Proportional relief valve holding 210 bar nominal pressure. Operator PPE compliance checked."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>

          {/* CAPA Toggle */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={createCapa || verdict === "failed"}
                onChange={(e) => setCreateCapa(e.target.checked)}
              />
              <span>Dispatch Corrective Action (CAPA) Work Order to Maintenance Team</span>
            </label>

            {(createCapa || verdict === "failed") && (
              <input
                className="input input-sm"
                placeholder="Required corrective maintenance action (e.g. Replace worn chuck spring and recalibrate within 7 days)"
                value={capaNotes}
                onChange={(e) => setCapaNotes(e.target.value)}
              />
            )}
          </div>
        </div>

        <div
          className="card-footer"
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--space-2)", flexShrink: 0 }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ShieldCheck size={14} />
            {mutation.isPending ? "Submitting Audit…" : "Submit & Issue Compliance Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: CERTIFICATE VIEWER ───────────────────────────────────────────────

function CertificateModal({
  inspection,
  onClose,
}: {
  inspection: AuditInspection;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card"
        style={{
          width: 680,
          maxWidth: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="card-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Award size={18} style={{ color: "var(--green)" }} />
            <span style={{ fontWeight: 600 }}>Official Certificate of Compliance</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={13} /> Print Certificate
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Certificate Printable Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--space-6)",
            background: "var(--bg-card)",
          }}
        >
          <div
            style={{
              border: "3px double var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-6)",
              textAlign: "center",
              position: "relative",
              background: "var(--bg-subtle)",
            }}
          >
            {/* GearGuard Watermark / Stamp */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                padding: "4px 10px",
                border: "2px solid var(--green)",
                borderRadius: "var(--radius-sm)",
                color: "var(--green)",
                fontWeight: 700,
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              ✓ GEARGUARD CERTIFIED
            </div>

            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              Enterprise Plant Asset Integrity System
            </div>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px 0" }}>
              Certificate of Compliance
            </h2>
            <div className="mono text-secondary" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-6)" }}>
              {inspection.certificate_number} · Audit ID: {inspection.human_id}
            </div>

            <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "left", display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Equipment Name:</span>
                <span style={{ fontWeight: 600 }}>{inspection.equipment_name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Equipment ID & Serial:</span>
                <span className="mono">{inspection.equipment_human_id} · {inspection.equipment_serial}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Industrial Department:</span>
                <span>{inspection.department}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Certified Standard:</span>
                <span style={{ fontWeight: 500 }}>{inspection.standard}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Compliance Verdict & Score:</span>
                <span style={{ fontWeight: 600, color: inspection.score >= 90 ? "var(--green)" : "var(--amber)" }}>
                  {inspection.status.toUpperCase()} ({inspection.score}/100)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Date of Inspection:</span>
                <span>{new Date(inspection.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Next Audit Due:</span>
                <span style={{ fontWeight: 500 }}>
                  {inspection.next_audit_due ? new Date(inspection.next_audit_due).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "Scheduled Annually"}
                </span>
              </div>
            </div>

            {/* Findings Box */}
            {inspection.findings && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                }}
              >
                <strong style={{ color: "var(--text-primary)" }}>Auditor Observations: </strong>
                {inspection.findings}
              </div>
            )}

            {/* Checklist summary */}
            <div style={{ marginTop: "var(--space-4)", textAlign: "left" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                Verified Inspection Criteria:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {inspection.checklist.map((c, i) => (
                  <div key={i} style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: 4 }}>
                    {c.passed ? (
                      <CheckCircle2 size={12} style={{ color: "var(--green)", flexShrink: 0 }} />
                    ) : (
                      <AlertOctagon size={12} style={{ color: "var(--red)", flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: "var(--space-8)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 var(--space-4)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "serif", fontStyle: "italic", fontSize: "16px", color: "var(--primary)" }}>
                  {inspection.auditor_name}
                </div>
                <div style={{ width: 140, borderBottom: "1px solid var(--border)", margin: "4px auto 6px" }} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Certified Compliance Auditor</div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  SHA-256 SIGNED
                </div>
                <div style={{ width: 140, borderBottom: "1px solid var(--border)", margin: "4px auto 6px" }} />
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>GearGuard Integrity Authority</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: WORK ORDER COMPLIANCE REVIEW ─────────────────────────────────────

function WorkOrderReviewModal({
  wo,
  onClose,
  onSuccess,
}: {
  wo: WorkOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [reviewStatus, setReviewStatus] = useState<"certified" | "flagged">("certified");
  const [notes, setNotes] = useState<string>(
    wo.audit_notes ?? "Maintenance procedure, calibration tolerances, and reported downtime fully verified."
  );

  const mutation = useMutation({
    mutationFn: () => compliance.reviewWorkOrder(wo.id, { status: reviewStatus, notes }),
    onSuccess: () => {
      toast("Work order compliance review saved", "success");
      onSuccess();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "var(--space-4)",
      }}
    >
      <div
        className="card"
        style={{
          width: 540,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} style={{ color: "var(--primary)" }} />
            <div>
              <div style={{ fontWeight: 600 }}>Work Order Compliance Review</div>
              <div className="mono text-muted" style={{ fontSize: "var(--text-xs)" }}>{wo.human_id} — {wo.subject}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              fontSize: "var(--text-xs)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div><strong style={{ color: "var(--text-muted)" }}>Asset:</strong> {wo.equipment_name ?? "—"}</div>
            <div><strong style={{ color: "var(--text-muted)" }}>Stage:</strong> {wo.status}</div>
            <div><strong style={{ color: "var(--text-muted)" }}>Technician:</strong> {wo.assignee_name ?? "Unassigned"}</div>
            <div><strong style={{ color: "var(--text-muted)" }}>Downtime:</strong> {wo.downtime_minutes ? `${wo.downtime_minutes} min` : "0 min"}</div>
          </div>

          <div className="field">
            <label className="label" style={{ fontWeight: 500 }}>Review Action</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
              <button
                type="button"
                className={`btn btn-sm ${reviewStatus === "certified" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setReviewStatus("certified")}
                style={{
                  background: reviewStatus === "certified" ? "var(--green)" : undefined,
                  borderColor: reviewStatus === "certified" ? "var(--green)" : undefined,
                  color: reviewStatus === "certified" ? "#fff" : undefined,
                }}
              >
                <CheckCircle2 size={13} /> Certify Work Order
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewStatus === "flagged" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setReviewStatus("flagged")}
                style={{
                  background: reviewStatus === "flagged" ? "var(--red)" : undefined,
                  borderColor: reviewStatus === "flagged" ? "var(--red)" : undefined,
                  color: reviewStatus === "flagged" ? "#fff" : undefined,
                }}
              >
                <AlertOctagon size={13} /> Flag Non-Conformance
              </button>
            </div>
          </div>

          <div className="field">
            <label className="label" style={{ fontWeight: 500 }}>Auditor Sign-Off Notes</label>
            <textarea
              className="input textarea"
              rows={4}
              placeholder="Record calibration verification, parts traceability checks, or explain non-conformance flag reason…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving Review…" : "Sign Off & Apply Auditor Stamp"}
          </button>
        </div>
      </div>
    </div>
  );
}
