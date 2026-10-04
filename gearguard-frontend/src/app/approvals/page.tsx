"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assetRequests, equipment, type AssetRequest, type Equipment } from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { HumanId, DateCell, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ShieldCheck,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  User,
  ArrowRightLeft,
  Calendar,
  Box,
} from "lucide-react";

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDurationStr(startDateStr: string | null, endDateStr: string | null) {
  if (!startDateStr) return "—";
  const start = new Date(startDateStr).getTime();
  const end = endDateStr ? new Date(endDateStr).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays} days`;
  }
  if (diffHours > 0) return `${diffHours} hours`;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  return `${Math.max(1, diffMins)} mins`;
}

export default function ApprovalsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"custody" | "pending" | "approved" | "rejected">("custody");
  const [custodyFilter, setCustodyFilter] = useState<"all" | "allocated" | "returned">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingAction, setPendingAction] = useState<{ req: AssetRequest; action: "approve" | "reject" } | null>(null);
  const [allocateTarget, setAllocateTarget] = useState<AssetRequest | null>(null);
  const [selectedEq, setSelectedEq] = useState("");
  const [returnConfirmAsset, setReturnConfirmAsset] = useState<{ id: string; name: string; human_id?: string; employee: string } | null>(null);

  const { data: reqs, isLoading: reqsLoading } = useQuery({
    queryKey: ["asset-requests"],
    queryFn: assetRequests.list,
  });

  const { data: eqList, isLoading: eqLoading } = useQuery({
    queryKey: ["equipment", "all"],
    queryFn: () => equipment.list({ all: true }),
  });

  const allRequests = reqs ?? [];
  const pending = allRequests.filter((r) => r.status === "Pending");
  const approved = allRequests.filter((r) => r.status === "Approved");
  const rejected = allRequests.filter((r) => r.status === "Rejected");

  // Custody records: Records where an asset was allocated or returned
  const custodyRecords = allRequests.filter(
    (r) => r.status === "Allocated" || r.status === "Returned" || r.allocated_date != null
  );

  const activeAllocatedCount = custodyRecords.filter((r) => r.status === "Allocated").length;
  const returnedCount = custodyRecords.filter((r) => r.status === "Returned" || r.return_date != null).length;

  // Filtered custody records
  const filteredCustody = custodyRecords.filter((r) => {
    if (custodyFilter === "allocated" && r.status !== "Allocated") return false;
    if (custodyFilter === "returned" && r.status !== "Returned") return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.asset_name && r.asset_name.toLowerCase().includes(q)) ||
      (r.allocated_asset_name && r.allocated_asset_name.toLowerCase().includes(q)) ||
      (r.allocated_asset_human_id && r.allocated_asset_human_id.toLowerCase().includes(q)) ||
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_email && r.employee_email.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q))
    );
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => assetRequests.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-requests"] });
      toast("Requisition approved. Ready for asset allocation.", "success");
      setPendingAction(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => assetRequests.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-requests"] });
      toast("Requisition rejected.", "success");
      setPendingAction(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const allocateMutation = useMutation({
    mutationFn: ({ id, eq_id }: { id: string; eq_id: string }) => assetRequests.allocate(id, eq_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-requests"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      toast("Asset successfully allocated to employee. Custody record initiated.", "success");
      setAllocateTarget(null);
      setSelectedEq("");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const managerReturnMutation = useMutation({
    mutationFn: (eqId: string) => equipment.return(eqId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["asset-requests"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      toast(`Asset "${updated.name}" officially returned to plant storage. Custody record closed.`, "success");
      setReturnConfirmAsset(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const availableEq = (eqList ?? []).filter(
    (e) => e.is_usable && (e.assigned_employee === "Unassigned" || !e.assigned_employee)
  );

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1280, margin: "0 auto" }}>
        
        {/* Page Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="badge badge-accent" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                Operations Management
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Plant Machinery & Custody Administration
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Asset Approvals & Custody Ledger
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
              Review employee machinery requests, manage allocations, and track complete asset custody assignment and return records.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: "var(--space-6)" }}>
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={14} style={{ color: "var(--accent)" }} />
              Active In Custody
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: 6, color: "var(--text)" }}>
              {activeAllocatedCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
              Equipment currently in employee possession
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} style={{ color: "#10b981" }} />
              Returned Cycles
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: 6, color: "var(--text)" }}>
              {returnedCount}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
              Past allocations returned to plant inventory
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={14} style={{ color: "#f59e0b" }} />
              Pending Requisitions
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: 6, color: pending.length > 0 ? "#f59e0b" : "var(--text)" }}>
              {pending.length}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
              Awaiting supervisor approval decision
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Box size={14} style={{ color: "#3b82f6" }} />
              Awaiting Allocation
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: 6, color: approved.length > 0 ? "#3b82f6" : "var(--text)" }}>
              {approved.length}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
              Approved requests ready for machinery assignment
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", marginBottom: "var(--space-5)" }}>
          <button
            onClick={() => setActiveTab("custody")}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "custody" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "custody" ? "var(--text)" : "var(--text-muted)",
              fontWeight: activeTab === "custody" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ArrowRightLeft size={15} />
            <span>Asset Custody & Return Record</span>
            <span className="badge" style={{ fontSize: "10px", padding: "1px 6px", background: "var(--surface-hover)" }}>
              {custodyRecords.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pending")}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "pending" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "pending" ? "var(--text)" : "var(--text-muted)",
              fontWeight: activeTab === "pending" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Clock size={15} />
            <span>Pending Requests</span>
            {pending.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {pending.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("approved")}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "approved" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "approved" ? "var(--text)" : "var(--text-muted)",
              fontWeight: activeTab === "approved" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={15} />
            <span>Approved (Awaiting Allocation)</span>
            {approved.length > 0 && (
              <span className="badge badge-accent" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {approved.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("rejected")}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "rejected" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "rejected" ? "var(--text)" : "var(--text-muted)",
              fontWeight: activeTab === "rejected" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            <span>Rejected / Closed</span>
            {rejected.length > 0 && (
              <span className="badge" style={{ fontSize: "10px", padding: "1px 6px", background: "var(--surface-hover)" }}>
                {rejected.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Asset Custody & Return Record */}
        {activeTab === "custody" && (
          <div>
            {/* Filter and Search Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Filter View:</span>
                <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 2 }}>
                  <button
                    onClick={() => setCustodyFilter("all")}
                    className={`btn btn-sm ${custodyFilter === "all" ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "11px", height: 26, padding: "0 10px" }}
                  >
                    All Records ({custodyRecords.length})
                  </button>
                  <button
                    onClick={() => setCustodyFilter("allocated")}
                    className={`btn btn-sm ${custodyFilter === "allocated" ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "11px", height: 26, padding: "0 10px" }}
                  >
                    🟢 In Custody ({activeAllocatedCount})
                  </button>
                  <button
                    onClick={() => setCustodyFilter("returned")}
                    className={`btn btn-sm ${custodyFilter === "returned" ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "11px", height: 26, padding: "0 10px" }}
                  >
                    ✓ Returned ({returnedCount})
                  </button>
                </div>
              </div>

              <div style={{ position: "relative", minWidth: 280 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search by asset, ID, employee, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 30, height: 32, fontSize: "12px", width: "100%" }}
                />
              </div>
            </div>

            {/* Custody Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machinery / Asset</th>
                    <th>Employee (Custodian)</th>
                    <th>Status</th>
                    <th>Assigned Date & Time</th>
                    <th>Returned Date & Time</th>
                    <th>Duration</th>
                    <th style={{ textAlign: "right" }}>Manager Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reqsLoading ? (
                    <SkeletonRows cols={7} rows={5} />
                  ) : filteredCustody.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No custody assignment or return records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustody.map((record) => {
                      const isReturned = record.status === "Returned" || record.return_date != null;
                      const assetName = record.allocated_asset_name || record.asset_name;
                      const assetHumanId = record.allocated_asset_human_id;
                      const duration = getDurationStr(record.allocated_date, record.return_date);

                      return (
                        <tr key={record.id}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {assetHumanId ? <HumanId id={assetHumanId} /> : <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>}
                                <span style={{ fontWeight: 600, color: "var(--text)" }}>{assetName}</span>
                              </div>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {record.allocated_asset_department || record.category || "General Operations"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontWeight: 500, color: "var(--text)" }}>{record.employee_name}</span>
                              {record.employee_email && (
                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{record.employee_email}</span>
                              )}
                            </div>
                          </td>

                          <td>
                            {isReturned ? (
                              <span className="badge badge-success" style={{ fontSize: "11px", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span>✓</span> Returned to Storage
                              </span>
                            ) : (
                              <span className="badge badge-accent" style={{ fontSize: "11px", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                                Active Custody
                              </span>
                            )}
                          </td>

                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: "12px", fontWeight: 500 }}>
                                {formatDateTime(record.allocated_date)}
                              </span>
                              {record.allocated_date && (
                                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                  Initiated
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            {isReturned ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)" }}>
                                  {formatDateTime(record.return_date)}
                                </span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                  Relinquished back to plant
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                Currently in employee custody
                              </span>
                            )}
                          </td>

                          <td>
                            <span className="mono" style={{ fontSize: "12px", color: isReturned ? "var(--text-muted)" : "var(--accent)" }}>
                              {duration}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            {!isReturned && record.allocated_asset_id ? (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() =>
                                  setReturnConfirmAsset({
                                    id: record.allocated_asset_id!,
                                    name: assetName,
                                    human_id: assetHumanId ?? undefined,
                                    employee: record.employee_name,
                                  })
                                }
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11px", height: 26, padding: "0 8px" }}
                                title="Reclaim or return asset back to inventory"
                              >
                                <RotateCcw size={12} />
                                <span>Return to Storage</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Pending Requests */}
        {activeTab === "pending" && (
          <div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Requisitions Awaiting Decision ({pending.length})
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th>Requested Date</th>
                    <th style={{ textAlign: "right" }}>Decision Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reqsLoading ? (
                    <SkeletonRows cols={6} rows={3} />
                  ) : pending.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No pending asset requests awaiting manager action.
                      </td>
                    </tr>
                  ) : (
                    pending.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600 }}>{req.employee_name}</span>
                            {req.employee_email && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{req.employee_email}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{req.asset_name}</td>
                        <td className="text-secondary">{req.category ?? "General"}</td>
                        <td className="text-secondary" style={{ maxWidth: 260, fontSize: "12px", lineHeight: 1.4 }}>
                          {req.reason ?? "Standard operations assignment"}
                        </td>
                        <td>
                          <DateCell date={req.request_date} />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setPendingAction({ req, action: "approve" })}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setPendingAction({ req, action: "reject" })}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Approved — Awaiting Allocation */}
        {activeTab === "approved" && (
          <div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Approved Requisitions Ready for Equipment Allocation ({approved.length})
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Approval Date</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reqsLoading ? (
                    <SkeletonRows cols={5} rows={3} />
                  ) : approved.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No approved requests waiting for asset allocation.
                      </td>
                    </tr>
                  ) : (
                    approved.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600 }}>{req.employee_name}</span>
                            {req.employee_email && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{req.employee_email}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{req.asset_name}</td>
                        <td className="text-secondary">{req.category ?? "General"}</td>
                        <td>
                          <DateCell date={req.approval_date} />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setAllocateTarget(req);
                              setSelectedEq("");
                            }}
                          >
                            Allocate Asset
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Rejected / Closed */}
        {activeTab === "rejected" && (
          <div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Rejected Requisitions History ({rejected.length})
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Reason Given</th>
                    <th>Status</th>
                    <th>Requested Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No rejected requisitions on record.
                      </td>
                    </tr>
                  ) : (
                    rejected.map((req) => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 500 }}>{req.employee_name}</td>
                        <td>{req.asset_name}</td>
                        <td className="text-secondary">{req.category ?? "—"}</td>
                        <td className="text-secondary" style={{ maxWidth: 260, fontSize: "12px" }}>{req.reason ?? "—"}</td>
                        <td>
                          <span className="badge badge-danger" style={{ fontSize: "11px", padding: "1px 6px" }}>
                            Rejected
                          </span>
                        </td>
                        <td>
                          <DateCell date={req.request_date} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirm Approve / Reject Dialog */}
        {pendingAction && (
          <ConfirmDialog
            title={pendingAction.action === "approve" ? "Approve Asset Requisition?" : "Reject Asset Requisition?"}
            description={`This will ${pendingAction.action} the machinery requisition for "${pendingAction.req.asset_name}" from employee ${pendingAction.req.employee_name}.`}
            confirmLabel={pendingAction.action === "approve" ? "Approve Requisition" : "Reject Requisition"}
            danger={pendingAction.action === "reject"}
            onConfirm={() => {
              if (pendingAction.action === "approve") approveMutation.mutate(pendingAction.req.id);
              else rejectMutation.mutate(pendingAction.req.id);
            }}
            onCancel={() => setPendingAction(null)}
          />
        )}

        {/* Modal: Allocate Available Equipment */}
        {allocateTarget && (
          <div className="modal-backdrop" onClick={() => setAllocateTarget(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Box size={18} style={{ color: "var(--accent)" }} />
                  <h3 className="modal-title">Allocate Machinery to Employee</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setAllocateTarget(null)}>✕</button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ padding: "12px 14px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Requisition Target:</div>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginTop: 2 }}>{allocateTarget.asset_name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 4 }}>
                    Requested by: <strong>{allocateTarget.employee_name}</strong> {allocateTarget.employee_email ? `(${allocateTarget.employee_email})` : ""}
                  </div>
                </div>

                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>Select Available Plant Equipment *</label>
                  <select
                    className="input select"
                    value={selectedEq}
                    onChange={(e) => setSelectedEq(e.target.value)}
                  >
                    <option value="">-- Choose an unassigned plant asset ({availableEq.length} available) --</option>
                    {availableEq.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.human_id} — {e.name} ({e.department} / {e.category ?? "General"})
                      </option>
                    ))}
                  </select>
                  {availableEq.length === 0 && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
                      ⚠️ No unassigned usable equipment currently in inventory. Check equipment status or return an allocated asset.
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setAllocateTarget(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!selectedEq || allocateMutation.isPending}
                  onClick={() => allocateMutation.mutate({ id: allocateTarget.id, eq_id: selectedEq })}
                >
                  {allocateMutation.isPending ? "Allocating..." : "Confirm Machinery Allocation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirm Manager Return of Asset */}
        {returnConfirmAsset && (
          <div className="modal-backdrop" onClick={() => setReturnConfirmAsset(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={18} style={{ color: "var(--accent)" }} />
                  <h3 className="modal-title">Return Machinery to Storage</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setReturnConfirmAsset(null)}>✕</button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: "14px", lineHeight: 1.5 }}>
                  Are you sure you want to reclaim and return <strong>{returnConfirmAsset.name}</strong> {returnConfirmAsset.human_id ? `(${returnConfirmAsset.human_id})` : ""} from employee <strong>{returnConfirmAsset.employee}</strong> back to plant storage?
                </p>
                <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(100, 116, 139, 0.08)", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  ℹ️ This will reset the machinery status to "Unassigned" and record the exact return timestamp in this Custody Record.
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setReturnConfirmAsset(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => managerReturnMutation.mutate(returnConfirmAsset.id)}
                  disabled={managerReturnMutation.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <RotateCcw size={14} />
                  <span>{managerReturnMutation.isPending ? "Returning..." : "Confirm Return to Plant"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
