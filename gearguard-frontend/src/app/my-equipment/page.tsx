"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  equipment, workOrders, assetRequests, 
  type Equipment, type WorkOrder, type AssetRequest, type WOPriority 
} from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, DateCell, Age, HumanId, PriorityLabel, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import { 
  Plus, AlertTriangle, ShieldCheck, Wrench, Clock, CheckCircle2, 
  Send, X, Monitor, ChevronRight, MessageSquare, RotateCcw
} from "lucide-react";
import Link from "next/link";

export default function MyEquipmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [complaintTargetAsset, setComplaintTargetAsset] = useState<Equipment | null>(null);
  const [confirmReturnAsset, setConfirmReturnAsset] = useState<Equipment | null>(null);

  // Complaint Form state
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintPriority, setComplaintPriority] = useState<WOPriority>("medium");
  const [complaintNotes, setComplaintNotes] = useState("");

  // Request new asset form state
  const [reqAssetName, setReqAssetName] = useState("");
  const [reqCategory, setReqCategory] = useState("");
  const [reqReason, setReqReason] = useState("");

  // Query: Machinery strictly allocated to this employee
  const { data: myAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ["equipment-allocated", user?.id],
    queryFn: () => equipment.list(),
    enabled: !!user,
  });

  // Query: Complaints on my equipment
  const { data: myComplaintsData, isLoading: complaintsLoading } = useQuery({
    queryKey: ["complaints", user?.id],
    queryFn: () => workOrders.list({ page_size: 50 }),
    enabled: !!user,
  });

  // Query: Asset requests history
  const { data: reqs, isLoading: reqsLoading } = useQuery({ 
    queryKey: ["asset-requests", "mine"], 
    queryFn: assetRequests.list,
    enabled: !!user 
  });

  // Mutation: File complaint for an assigned asset
  const complaintMutation = useMutation({
    mutationFn: async () => {
      if (!complaintTargetAsset) throw new Error("No equipment selected");
      if (!complaintSubject.trim()) throw new Error("Please specify the malfunction issue");
      return workOrders.create({
        equipment_id: complaintTargetAsset.id,
        subject: complaintSubject.trim(),
        type: "Corrective",
        priority: complaintPriority,
      });
    },
    onSuccess: (newWo) => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["equipment-allocated"] });
      toast(`Complaint filed for ${complaintTargetAsset?.name}. Routed directly to Operations Management.`, "success");
      setComplaintTargetAsset(null);
      setComplaintSubject("");
      setComplaintNotes("");
      setComplaintPriority("medium");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  // Mutation: Request new asset
  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!reqAssetName.trim()) throw new Error("Please enter asset name or equipment type");
      return assetRequests.create({
        asset_name: reqAssetName.trim(),
        category: reqCategory.trim() || undefined,
        reason: reqReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-requests", "mine"] });
      toast("Asset request submitted to Operations Supervisor", "success");
      setShowRequestModal(false);
      setReqAssetName("");
      setReqCategory("");
      setReqReason("");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  // Mutation: Return assigned asset
  const returnMutation = useMutation({
    mutationFn: async (eqId: string) => {
      return equipment.return(eqId);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["equipment-allocated"] });
      qc.invalidateQueries({ queryKey: ["asset-requests"] });
      toast(`Returned ${updated.name} to plant storage. Custody record updated.`, "success");
      setConfirmReturnAsset(null);
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  const assignedList = myAssets ?? [];
  const activeComplaints = myComplaintsData?.items ?? [];
  const requestHistory = reqs ?? [];

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="badge badge-accent" style={{ fontSize: "11px", textTransform: "uppercase" }}>
                Assigned Custody
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Employee: {user?.name}
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>My Equipment Section</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 2 }}>
              Plant machinery assigned to your station. As an employee, you can only register maintenance complaints for equipment assigned to your custody.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/complaints" className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span>Complaints Desk</span>
            </Link>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowRequestModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Request Asset</span>
            </button>
          </div>
        </div>

        {/* Section 1: Assigned Machinery Cards & Table */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Currently Assigned Equipment ({assignedList.length})
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Other plant equipment maintenance is overseen by Operations Management
            </span>
          </div>

          {assetsLoading ? (
            <div className="card" style={{ padding: 20 }}>
              <SkeletonRows rows={3} cols={6} />
            </div>
          ) : assignedList.length === 0 ? (
            <div className="card" style={{ padding: "36px 20px", textAlign: "center" }}>
              <Monitor size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>
                No Machinery Currently Allocated
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: 460, margin: "6px auto 16px" }}>
                You currently do not have any plant machinery assigned to your custody. You can submit an asset request to your supervisor below.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowRequestModal(true)}>
                <Plus size={14} style={{ marginRight: 4 }} />
                Request Equipment Allocation
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
              {assignedList.map((asset) => {
                const openWoCount = asset.open_work_order_count || 0;
                return (
                  <div 
                    key={asset.id} 
                    className="card" 
                    style={{ 
                      padding: "16px 18px", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: "space-between",
                      border: openWoCount > 0 ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border)",
                      background: openWoCount > 0 ? "rgba(245, 158, 11, 0.02)" : "var(--surface)"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <HumanId id={asset.human_id} />
                        {openWoCount > 0 ? (
                          <span className="badge badge-warning" style={{ fontSize: "10px", padding: "1px 7px" }}>
                            ⚠️ {openWoCount} Open Incident
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: "10px", padding: "1px 7px" }}>
                            ✓ Operational
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
                        {asset.name}
                      </h3>

                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div>Department: <strong style={{ color: "var(--text-secondary)" }}>{asset.department}</strong></div>
                        <div>Serial: <span className="mono">{asset.serial_number}</span></div>
                        {asset.location && <div>Location: <span>{asset.location}</span></div>}
                      </div>
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {asset.last_service_date ? `Last Serviced: ${new Date(asset.last_service_date).toLocaleDateString()}` : "Service record active"}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setConfirmReturnAsset(asset)}
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", height: 28, padding: "0 8px" }}
                          title="Relinquish and return asset to plant storage"
                        >
                          <RotateCcw size={12} />
                          <span>Return Asset</span>
                        </button>

                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            setComplaintTargetAsset(asset);
                            setComplaintSubject("");
                            setComplaintPriority("medium");
                            setComplaintNotes("");
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", height: 28, padding: "0 10px" }}
                        >
                          <AlertTriangle size={13} />
                          <span>Report Issue</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Active Complaints Filed on My Equipment */}
        {activeComplaints.length > 0 && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>
              Active Incidents on My Equipment ({activeComplaints.length})
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Ticket</th>
                      <th>Equipment</th>
                      <th>Reported Malfunction</th>
                      <th style={{ width: 100 }}>Priority</th>
                      <th style={{ width: 170 }}>Technician Assigned</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 110 }}>Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeComplaints.map((c) => (
                      <tr key={c.id}>
                        <td><HumanId id={c.human_id} /></td>
                        <td>
                          <strong>{c.equipment_name}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{c.equipment_human_id}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{c.subject}</div>
                          {c.comments && c.comments.length > 0 && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              💬 {c.comments.length} updates logged
                            </span>
                          )}
                        </td>
                        <td><PriorityLabel priority={c.priority} /></td>
                        <td>
                          {c.assignee_name ? (
                            <span style={{ fontWeight: 500, fontSize: "12px", color: "#10b981" }}>
                              🔧 {c.assignee_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>
                              ⚠️ Under Review by Manager
                            </span>
                          )}
                        </td>
                        <td><StatusDot status={c.status} /></td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}><Age date={c.created_at} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Asset Request History */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Asset Request History
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(true)} style={{ fontSize: "11px" }}>
              + New Request
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 120 }}>Requested Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reqsLoading ? (
                    <SkeletonRows rows={2} cols={5} />
                  ) : requestHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "12px" }}>
                        No asset requests on record.
                      </td>
                    </tr>
                  ) : (
                    requestHistory.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.asset_name}</strong></td>
                        <td style={{ color: "var(--text-secondary)" }}>{r.category || "—"}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{r.reason || "—"}</td>
                        <td><StatusDot status={r.status} /></td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}><DateCell date={r.request_date} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal: Report Issue / Complain on Assigned Asset */}
        {complaintTargetAsset && (
          <div className="modal-backdrop" onClick={() => setComplaintTargetAsset(null)}>
            <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
                    Report Issue on Assigned Machinery
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                    This complaint will be routed directly to Operations Management for technician dispatch.
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setComplaintTargetAsset(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                
                {/* Locked target equipment info */}
                <div style={{
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Selected Assigned Equipment
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <HumanId id={complaintTargetAsset.human_id} />
                    <strong style={{ fontSize: "14px" }}>{complaintTargetAsset.name}</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                    Department: {complaintTargetAsset.department} • Serial: {complaintTargetAsset.serial_number}
                  </div>
                </div>

                {/* Urgency Level */}
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>Severity Level</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {(["low", "medium", "high", "critical"] as WOPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-sm ${complaintPriority === p ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setComplaintPriority(p)}
                        style={{ textTransform: "capitalize", fontSize: "12px" }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Malfunction Subject */}
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>
                    Malfunction Summary <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Spindle bearing overheating, pneumatic cylinder leak..."
                    value={complaintSubject}
                    onChange={(e) => setComplaintSubject(e.target.value)}
                  />
                </div>

                {/* Details */}
                <div className="form-group">
                  <label className="label">Observed Symptoms / Operator Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Describe alarm codes, unusual vibrations, sounds, or if the unit was halted for safety..."
                    value={complaintNotes}
                    onChange={(e) => setComplaintNotes(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ 
                  background: "rgba(59, 130, 246, 0.08)", 
                  padding: "10px 14px", 
                  borderRadius: "var(--radius-md)", 
                  fontSize: "12px", 
                  color: "#3b82f6",
                  border: "1px solid rgba(59, 130, 246, 0.2)"
                }}>
                  🛡️ <strong>Direct Manager Triage:</strong> Submitting this ticket enters the Operations Manager triage desk for technician assignment. Other plant machinery is maintained by the manager.
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setComplaintTargetAsset(null)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => complaintMutation.mutate()}
                  disabled={complaintMutation.isPending || !complaintSubject.trim()}
                >
                  {complaintMutation.isPending ? "Submitting..." : "Submit Complaint to Manager"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Request New Asset Allocation */}
        {showRequestModal && (
          <div className="modal-backdrop" onClick={() => setShowRequestModal(false)}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Request Equipment Allocation</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowRequestModal(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>Equipment / Asset Needed *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. CNC Turning Center, Forklift, Air Dryer..."
                    value={reqAssetName}
                    onChange={(e) => setReqAssetName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Category</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Machining, Hydraulics, Handling..."
                    value={reqCategory}
                    onChange={(e) => setReqCategory(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Operational Reason</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Explain why this equipment is needed for your shift or workstation..."
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => requestMutation.mutate()}
                  disabled={requestMutation.isPending || !reqAssetName.trim()}
                >
                  {requestMutation.isPending ? "Submitting..." : "Submit Request to Supervisor"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirm Return Asset */}
        {confirmReturnAsset && (
          <div className="modal-backdrop" onClick={() => setConfirmReturnAsset(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RotateCcw size={18} style={{ color: "var(--accent)" }} />
                  <h3 className="modal-title">Return Machinery to Storage</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReturnAsset(null)}>✕</button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: "14px", lineHeight: 1.5 }}>
                  Are you sure you want to return <strong>{confirmReturnAsset.name}</strong> (<HumanId id={confirmReturnAsset.human_id} />) back to plant inventory?
                </p>
                <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(100, 116, 139, 0.08)", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  ℹ️ This action will immediately release the asset from your active custody and log the exact return timestamp in the Operations Management Custody Record.
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setConfirmReturnAsset(null)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => returnMutation.mutate(confirmReturnAsset.id)}
                  disabled={returnMutation.isPending}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <RotateCcw size={14} />
                  <span>{returnMutation.isPending ? "Returning..." : "Confirm Return"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
