"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  AlertTriangle, Plus, Search, MessageSquare, CheckCircle2, 
  Clock, Wrench, ShieldAlert, Send, X, ArrowRight, Filter,
  UserCheck, UserX, HelpCircle, Layers, ArrowUpRight, ChevronRight,
  UserPlus, Check
} from "lucide-react";
import { 
  workOrders, equipment, users, type WorkOrder, type WOStatus, 
  type WOPriority, type Equipment, type User 
} from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { StatusDot, PriorityLabel, HumanId, DateCell, Age, SkeletonRows } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";

export default function ComplaintsDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const isManagerOrAdmin = user?.role === "manager" || user?.role === "admin";
  const [adminDeptFilter, setAdminDeptFilter] = useState<string>("All");

  // Common UI State
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [selectedComplaint, setSelectedComplaint] = useState<WorkOrder | null>(null);
  const [assignModalTicket, setAssignModalTicket] = useState<WorkOrder | null>(null);
  const [commentText, setCommentText] = useState("");

  // Employee "File Complaint" modal state
  const [showFileModal, setShowFileModal] = useState(false);
  const [eqId, setEqId] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<WOPriority>("medium");
  const [description, setDescription] = useState("");

  // Manager Triage Drawer controls state
  const [triageAssignee, setTriageAssignee] = useState<string>("");
  const [triageStatus, setTriageStatus] = useState<WOStatus>("New");
  const [triagePriority, setTriagePriority] = useState<WOPriority>("medium");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");

  // Query: Complaints (Manager gets department employee complaints; Employee gets their own)
  const { data, isLoading } = useQuery({
    queryKey: ["complaints", user?.id, isManagerOrAdmin, adminDeptFilter],
    queryFn: () => workOrders.list({ 
      complaints_only: isManagerOrAdmin,
      department: user?.role === "admin" && adminDeptFilter !== "All" ? adminDeptFilter : undefined,
      page_size: 150 
    }),
    enabled: !!user,
  });

  // Query: Equipment (for employee this returns strictly their allocated assets)
  const { data: eqList, isLoading: eqLoading } = useQuery({
    queryKey: ["equipment-allocated", user?.id],
    queryFn: () => equipment.list(),
    enabled: !!user,
  });

  // Query: Technicians list (for manager assignment - scoped to department)
  const { data: allUsers, isLoading: techsLoading } = useQuery({
    queryKey: ["technicians-list", adminDeptFilter],
    queryFn: () => users.list({
      department: user?.role === "admin" && adminDeptFilter !== "All" ? adminDeptFilter : undefined,
    }),
    enabled: !!user && isManagerOrAdmin,
  });

  const technicians = (allUsers ?? []).filter((u) => u.role === "technician");
  const complaints = data?.items ?? [];
  const allocatedAssets = eqList ?? [];

  // Metrics calculation
  const totalCount = complaints.length;
  const unassignedCount = complaints.filter((c) => !c.assignee_id && c.status === "New").length;
  const underReviewCount = complaints.filter((c) => c.status === "New").length;
  const inProgressCount = complaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "Repaired").length;
  const criticalCount = complaints.filter((c) => c.priority === "critical" && c.status !== "Repaired").length;

  // Filter complaints
  const filtered = complaints.filter((c) => {
    if (statusTab === "unassigned" && (c.assignee_id || c.status !== "New")) return false;
    if (statusTab === "open" && c.status !== "New") return false;
    if (statusTab === "in_progress" && c.status !== "In Progress") return false;
    if (statusTab === "resolved" && c.status !== "Repaired" && c.status !== "Scrap") return false;
    if (statusTab === "critical" && c.priority !== "critical") return false;

    if (filterEmployee !== "all") {
      const matchCreator = c.creator_name?.toLowerCase().includes(filterEmployee.toLowerCase()) || 
                           c.created_by === filterEmployee;
      if (!matchCreator) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSubj = c.subject.toLowerCase().includes(q);
      const matchId = c.human_id.toLowerCase().includes(q);
      const matchEq = (c.equipment_name ?? "").toLowerCase().includes(q);
      const matchEmp = (c.creator_name ?? "").toLowerCase().includes(q);
      const matchTech = (c.assignee_name ?? "").toLowerCase().includes(q);
      if (!matchSubj && !matchId && !matchEq && !matchEmp && !matchTech) return false;
    }
    return true;
  });

  // Unique reporting employees list for manager filter
  const reportingEmployees = Array.from(
    new Set(complaints.map((c) => c.creator_name).filter(Boolean) as string[])
  );

  // Mutation: File new complaint (Employee only, strictly for allocated assets)
  const fileMutation = useMutation({
    mutationFn: async () => {
      if (!eqId) throw new Error("Please select an equipment asset allocated to you");
      if (!subject.trim()) throw new Error("Please provide a complaint subject");
      return workOrders.create({
        equipment_id: eqId,
        subject: subject.trim(),
        type: "Corrective",
        priority,
      });
    },
    onSuccess: (newWo) => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      toast("Complaint submitted directly to Operations Management queue.", "success");
      setShowFileModal(false);
      setEqId("");
      setSubject("");
      setDescription("");
      setPriority("medium");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  // Mutation: Add comment / note to complaint
  const commentMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      return workOrders.comment(id, text);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      setSelectedComplaint(updated);
      setCommentText("");
      toast("Communication update added to complaint log", "success");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  // Mutation: Manager updates work order (Assign Tech, change status, change priority)
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<{ assignee_id: string; status: WOStatus; priority: WOPriority }> }) => {
      return workOrders.update(id, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      if (selectedComplaint && selectedComplaint.id === updated.id) {
        setSelectedComplaint(updated);
      }
      if (assignModalTicket && assignModalTicket.id === updated.id) {
        setAssignModalTicket(null);
      }
      toast(`Updated ${updated.human_id} successfully`, "success");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  // Open drawer and sync triage form state
  const openTriageDrawer = (complaint: WorkOrder) => {
    setSelectedComplaint(complaint);
    setTriageAssignee(complaint.assignee_id || "");
    setTriageStatus(complaint.status);
    setTriagePriority(complaint.priority);
  };

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1300, margin: "0 auto" }}>
        
        {/* Header Bar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className={`badge ${isManagerOrAdmin ? "badge-primary" : "badge-accent"}`} style={{ fontSize: "11px", textTransform: "uppercase" }}>
                {isManagerOrAdmin ? "Operations Management" : "Employee Portal"}
              </span>
              {user?.role === "manager" && (
                <span className="badge badge-accent" style={{ fontSize: "11px" }}>
                  📍 {user?.department || "Production"} Department
                </span>
              )}
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {isManagerOrAdmin 
                  ? `Direct Triage & Dispatch Desk • ${technicians.length} Technicians Available` 
                  : `Allocated Machinery Fault Reporting • ${user?.name}`}
              </span>
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>
              {isManagerOrAdmin ? "Employee Complaints & Incident Desk" : "My Equipment Complaints"}
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>
              {user?.role === "manager"
                ? `Showing breakdown and incident complaints filed by employees and equipment in the ${user?.department || "Production"} Department.`
                : isManagerOrAdmin 
                ? "Triage queue for machinery breakdown and malfunction complaints submitted by shop-floor employees."
                : "Submit fault tickets for equipment allocated to you. All tickets route directly to Operations Management for review and technician dispatch."}
            </p>
          </div>

          {user?.role === "admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Department:</span>
              <select
                className="input input-sm select"
                value={adminDeptFilter}
                onChange={(e) => setAdminDeptFilter(e.target.value)}
                style={{ width: 160, fontSize: "12px" }}
              >
                <option value="All">All Departments</option>
                {["Machining", "Production", "Assembly", "Facilities", "Logistics", "Quality Control"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {!isManagerOrAdmin && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                if (allocatedAssets.length === 0) {
                  toast("You do not have any equipment allocated to your profile yet.", "error");
                  return;
                }
                setShowFileModal(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} />
              <span>File Complaint</span>
            </button>
          )}
        </div>

        {/* Notice for Employees with no allocated equipment */}
        {!isManagerOrAdmin && !eqLoading && allocatedAssets.length === 0 && (
          <div style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            marginBottom: "var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "#f59e0b" }}>
                No Machinery Allocated To Your Profile ({user?.name})
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                As an employee, company policy permits filing maintenance complaints only for equipment assigned to your custody. Contact your supervisor to request an asset allocation before submitting tickets.
              </div>
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isManagerOrAdmin ? "repeat(5, 1fr)" : "repeat(4, 1fr)", 
          gap: "var(--space-3)", 
          marginBottom: "var(--space-5)" 
        }}>
          <div className="card" style={{ padding: "14px var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Complaints
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4 }}>{totalCount}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
              {isManagerOrAdmin ? "Submitted across all stations" : "Filed by your profile"}
            </div>
          </div>

          {isManagerOrAdmin ? (
            <div 
              className="card" 
              style={{ 
                padding: "14px var(--space-4)", 
                border: unassignedCount > 0 ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid var(--border)",
                background: unassignedCount > 0 ? "rgba(239, 68, 68, 0.05)" : "var(--surface)",
                cursor: "pointer"
              }}
              onClick={() => setStatusTab("unassigned")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-xs)", color: unassignedCount > 0 ? "#ef4444" : "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Action Needed (Unassigned)
                </span>
                {unassignedCount > 0 && (
                  <span className="badge badge-danger" style={{ fontSize: "10px", padding: "1px 6px" }}>P1</span>
                )}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4, color: unassignedCount > 0 ? "#ef4444" : "inherit" }}>
                {unassignedCount}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>Click to filter unassigned tickets</div>
            </div>
          ) : (
            <div className="card" style={{ padding: "14px var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Under Review
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4, color: "#3b82f6" }}>{underReviewCount}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>In queue for dispatch</div>
            </div>
          )}

          <div className="card" style={{ padding: "14px var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active In Repair
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4, color: "#f59e0b" }}>{inProgressCount}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>Technicians actively working</div>
          </div>

          <div className="card" style={{ padding: "14px var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Resolved
            </div>
            <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4, color: "#10b981" }}>{resolvedCount}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>Restored & tested</div>
          </div>

          {isManagerOrAdmin && (
            <div className="card" style={{ padding: "14px var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Critical Escalations
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: 4, color: criticalCount > 0 ? "#ef4444" : "var(--text-muted)" }}>
                {criticalCount}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>Urgent downtime risks</div>
            </div>
          )}
        </div>

        {/* Unassigned Banner Alert if tab is unassigned */}
        {isManagerOrAdmin && statusTab === "unassigned" && (
          <div style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "12px 18px",
            marginBottom: "var(--space-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={18} color="#ef4444" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#ef4444" }}>
                Triage Filter Active: Showing {filtered.length} Unassigned Complaints Awaiting Technician Dispatch
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Select a technician from any row dropdown or click &quot;Assign&quot; to dispatch.
            </span>
          </div>
        )}

        {/* Filter Bar & Controls */}
        <div className="card" style={{ padding: "12px var(--space-4)", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 4, background: "var(--surface-sunken)", padding: 4, borderRadius: "var(--radius-md)" }}>
              <button 
                className={`btn btn-sm ${statusTab === "all" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setStatusTab("all")}
                style={{ fontSize: "12px", height: 28, padding: "0 10px" }}
              >
                All ({complaints.length})
              </button>
              
              {isManagerOrAdmin && (
                <button 
                  className={`btn btn-sm ${statusTab === "unassigned" ? "btn-danger" : "btn-ghost"}`}
                  onClick={() => setStatusTab("unassigned")}
                  style={{ fontSize: "12px", height: 28, padding: "0 10px" }}
                >
                  Unassigned ({unassignedCount})
                </button>
              )}

              <button 
                className={`btn btn-sm ${statusTab === "in_progress" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setStatusTab("in_progress")}
                style={{ fontSize: "12px", height: 28, padding: "0 10px" }}
              >
                In Repair ({inProgressCount})
              </button>
              
              <button 
                className={`btn btn-sm ${statusTab === "resolved" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setStatusTab("resolved")}
                style={{ fontSize: "12px", height: 28, padding: "0 10px" }}
              >
                Resolved ({resolvedCount})
              </button>
              
              <button 
                className={`btn btn-sm ${statusTab === "critical" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setStatusTab("critical")}
                style={{ fontSize: "12px", height: 28, padding: "0 10px" }}
              >
                Critical ({criticalCount})
              </button>
            </div>

            {/* Search & Employee Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end", minWidth: 320 }}>
              {isManagerOrAdmin && reportingEmployees.length > 0 && (
                <select
                  className="input"
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  style={{ height: 32, fontSize: "12px", padding: "0 8px", width: 170 }}
                >
                  <option value="all">All Employees</option>
                  {reportingEmployees.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              )}

              <div style={{ position: "relative", width: 240 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search complaints, machinery, tech..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, height: 32, fontSize: "12px" }}
                />
                {search && (
                  <button 
                    onClick={() => setSearch("")} 
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Complaints Data Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Ticket</th>
                  {isManagerOrAdmin && <th style={{ width: 180 }}>Reported By</th>}
                  <th>Allocated Asset</th>
                  <th>Complaint Subject & Malfunction</th>
                  <th style={{ width: 95 }}>Priority</th>
                  <th style={{ width: isManagerOrAdmin ? 220 : 160 }}>Assigned Tech</th>
                  <th style={{ width: 105 }}>Status</th>
                  <th style={{ width: 100 }}>Filed</th>
                  <th style={{ width: 100, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows rows={5} cols={isManagerOrAdmin ? 9 : 8} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isManagerOrAdmin ? 9 : 8} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                      <AlertTriangle size={32} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                      <div style={{ fontWeight: 600 }}>No complaints match your criteria</div>
                      <div style={{ fontSize: "12px", marginTop: 4 }}>
                        {isManagerOrAdmin 
                          ? "Any machinery complaints filed by employees will appear directly in this triage queue." 
                          : "You have not filed any complaints matching this filter."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isUnassigned = !c.assignee_id && c.status === "New";
                    return (
                      <tr 
                        key={c.id} 
                        style={{ 
                          cursor: "pointer",
                          background: isUnassigned && isManagerOrAdmin ? "rgba(239, 68, 68, 0.03)" : undefined 
                        }}
                        onClick={() => openTriageDrawer(c)}
                      >
                        <td>
                          <HumanId id={c.human_id} />
                        </td>

                        {isManagerOrAdmin && (
                          <td>
                            <div style={{ fontWeight: 500, fontSize: "13px" }}>
                              {c.creator_name || "Employee"}
                            </div>
                            {c.creator_email && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {c.creator_email}
                              </div>
                            )}
                          </td>
                        )}

                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {c.equipment_name || "Unknown Machine"}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                            {c.equipment_human_id && <span>{c.equipment_human_id}</span>}
                            {c.equipment_department && <span>• {c.equipment_department}</span>}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, color: "var(--text)" }}>{c.subject}</div>
                          {c.comments && c.comments.length > 0 && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <MessageSquare size={11} />
                              <span>{c.comments.length} communication updates</span>
                            </div>
                          )}
                        </td>

                        <td>
                          <PriorityLabel priority={c.priority} />
                        </td>

                        {/* Interactive Technician Cell */}
                        <td onClick={(e) => e.stopPropagation()}>
                          {isManagerOrAdmin ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <select
                                className="input"
                                value={c.assignee_id || ""}
                                onChange={(e) => {
                                  const newTechId = e.target.value;
                                  updateMutation.mutate({
                                    id: c.id,
                                    payload: {
                                      assignee_id: newTechId,
                                      status: newTechId && c.status === "New" ? "In Progress" : c.status
                                    }
                                  });
                                }}
                                style={{
                                  height: 28,
                                  fontSize: "11px",
                                  padding: "0 6px",
                                  borderColor: isUnassigned ? "rgba(239, 68, 68, 0.4)" : "var(--border)",
                                  background: isUnassigned ? "rgba(239, 68, 68, 0.05)" : "var(--surface)",
                                  fontWeight: isUnassigned ? 600 : 400,
                                  color: isUnassigned ? "#ef4444" : "var(--text)"
                                }}
                              >
                                <option value="">⚠️ Unassigned</option>
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    🔧 {t.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                className="btn btn-ghost btn-sm"
                                title="Click to view all technicians and assign"
                                onClick={() => setAssignModalTicket(c)}
                                style={{ height: 28, width: 28, padding: 0 }}
                              >
                                <UserPlus size={13} />
                              </button>
                            </div>
                          ) : (
                            c.assignee_name ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px" }}>
                                <UserCheck size={14} color="#10b981" />
                                <span style={{ fontWeight: 500 }}>{c.assignee_name}</span>
                              </div>
                            ) : (
                              <div style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: 5, 
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#ef4444",
                                background: "rgba(239, 68, 68, 0.1)",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid rgba(239, 68, 68, 0.2)"
                              }}>
                                <UserX size={12} />
                                <span>Under Review</span>
                              </div>
                            )
                          )}
                        </td>

                        <td>
                          <StatusDot status={c.status} />
                        </td>

                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          <Age date={c.created_at} />
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTriageDrawer(c);
                            }}
                            style={{ fontSize: "12px", height: 26, padding: "0 8px" }}
                          >
                            {isManagerOrAdmin ? "Triage" : "View"}
                            <ChevronRight size={13} style={{ marginLeft: 2 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Assign Technician Modal for Manager */}
        {assignModalTicket && (
          <div className="modal-backdrop" onClick={() => setAssignModalTicket(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
                    Dispatch Technician to {assignModalTicket.human_id}
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                    Asset: <strong>{assignModalTicket.equipment_name}</strong> • Reported by: <strong>{assignModalTicket.creator_name}</strong>
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setAssignModalTicket(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Available Certified Maintenance Technicians ({technicians.length})
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                  {technicians.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                      No active technician accounts found in system.
                    </div>
                  ) : (
                    technicians.map((t) => {
                      const isAssignedToThis = assignModalTicket.assignee_id === t.id;
                      return (
                        <div
                          key={t.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "var(--radius-md)",
                            border: isAssignedToThis ? "1px solid #10b981" : "1px solid var(--border)",
                            background: isAssignedToThis ? "rgba(16, 185, 129, 0.06)" : "var(--surface-sunken)",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Wrench size={14} color="var(--primary)" />
                              <strong style={{ fontSize: "13px" }}>{t.name}</strong>
                              {isAssignedToThis && (
                                <span className="badge badge-success" style={{ fontSize: "10px", padding: "1px 6px" }}>
                                  Currently Assigned
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
                              {t.email}
                            </div>
                          </div>

                          <button
                            className={`btn btn-sm ${isAssignedToThis ? "btn-outline" : "btn-primary"}`}
                            disabled={updateMutation.isPending || isAssignedToThis}
                            onClick={() => {
                              updateMutation.mutate({
                                id: assignModalTicket.id,
                                payload: {
                                  assignee_id: t.id,
                                  status: assignModalTicket.status === "New" ? "In Progress" : assignModalTicket.status
                                }
                              });
                            }}
                            style={{ height: 28, fontSize: "11px", padding: "0 10px" }}
                          >
                            {isAssignedToThis ? "Assigned" : "Assign to Ticket"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {assignModalTicket.assignee_id && (
                  <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        updateMutation.mutate({
                          id: assignModalTicket.id,
                          payload: { assignee_id: "" }
                        });
                      }}
                      style={{ fontSize: "11px" }}
                    >
                      Unassign Technician
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline btn-sm" onClick={() => setAssignModalTicket(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Employee Files Complaint (Strictly for Allocated Assets) */}
        {showFileModal && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 560 }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>File Equipment Complaint</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                    Report a breakdown, malfunction, or safety issue. Dispatched directly to Operations Management.
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowFileModal(false)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                
                {/* Employee Info Header */}
                <div style={{ 
                  background: "var(--surface-sunken)", 
                  padding: "8px 12px", 
                  borderRadius: "var(--radius-md)", 
                  fontSize: "12px", 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center" 
                }}>
                  <span>Reporting Employee: <strong>{user?.name}</strong></span>
                  <span className="badge badge-accent" style={{ fontSize: "11px" }}>
                    {allocatedAssets.length} Allocated Machinery Assets
                  </span>
                </div>

                {/* Equipment Selector (Restricted to Employee's Allocated Equipment) */}
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>
                    Select Allocated Machinery <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select 
                    className="input"
                    value={eqId}
                    onChange={(e) => setEqId(e.target.value)}
                    disabled={allocatedAssets.length === 0}
                  >
                    <option value="">
                      {allocatedAssets.length === 0 
                        ? "-- No machinery allocated to your profile --" 
                        : "-- Choose your allocated equipment --"}
                    </option>
                    {allocatedAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.human_id}: {asset.name} ({asset.department})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
                    {allocatedAssets.length > 0
                      ? `Only machinery allocated to your custody (${user?.name}) is authorized for complaint filing.`
                      : `You cannot submit a complaint because you currently have no equipment allocated to you.`}
                  </span>
                </div>

                {/* Urgency / Priority */}
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>Severity Level</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {(["low", "medium", "high", "critical"] as WOPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-sm ${priority === p ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setPriority(p)}
                        style={{ textTransform: "capitalize", fontSize: "12px" }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="form-group">
                  <label className="label" style={{ fontWeight: 600 }}>
                    Malfunction Summary <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Axis 3 servomotor overheating error, hydraulic cylinder creeping..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Operational Details */}
                <div className="form-group">
                  <label className="label">Observed Symptoms / Operator Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Describe unusual noises, alarm codes, when the issue began, or if the machine is unsafe to operate..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ 
                  background: "var(--surface-sunken)", 
                  padding: "10px 14px", 
                  borderRadius: "var(--radius-md)", 
                  fontSize: "12px", 
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)"
                }}>
                  🛡️ <strong>Direct Management Routing:</strong> Submitting this ticket will immediately alert the Operations Manager triage board to dispatch a certified maintenance technician.
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowFileModal(false)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => fileMutation.mutate()}
                  disabled={fileMutation.isPending || !eqId || !subject.trim() || allocatedAssets.length === 0}
                >
                  {fileMutation.isPending ? "Filing..." : "Submit Complaint to Manager"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Side Drawer: Complaint Details & Manager Triage / Communication */}
        {selectedComplaint && (
          <div className="modal-backdrop" style={{ justifyContent: "flex-end" }} onClick={() => setSelectedComplaint(null)}>
            <div 
              className="card" 
              style={{ 
                width: "100%", 
                maxWidth: 580, 
                height: "100vh", 
                borderRadius: 0, 
                margin: 0, 
                display: "flex", 
                flexDirection: "column", 
                padding: 0,
                borderLeft: "1px solid var(--border)",
                animation: "slideInRight 0.2s ease-out"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <HumanId id={selectedComplaint.human_id} />
                    <span className="badge badge-accent" style={{ fontSize: "11px" }}>Complaint Ticket</span>
                    <StatusDot status={selectedComplaint.status} />
                  </div>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginTop: 4 }}>
                    {selectedComplaint.subject}
                  </h3>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedComplaint(null)}>
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                
                {/* Meta details grid */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: 12, 
                  background: "var(--surface-sunken)", 
                  padding: "14px", 
                  borderRadius: "var(--radius-md)", 
                  marginBottom: 16 
                }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Reported By Employee</span>
                    <strong style={{ fontSize: "13px" }}>{selectedComplaint.creator_name || "Employee"}</strong>
                    {selectedComplaint.creator_email && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                        {selectedComplaint.creator_email}
                      </span>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Allocated Machinery</span>
                    <strong style={{ fontSize: "13px" }}>{selectedComplaint.equipment_name || "Asset"}</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                      {selectedComplaint.equipment_human_id} • {selectedComplaint.equipment_department || "Plant"}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Reported Urgency</span>
                    <PriorityLabel priority={selectedComplaint.priority} />
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Time Submitted</span>
                    <span style={{ fontSize: "12px" }}>
                      <DateCell date={selectedComplaint.created_at} /> (<Age date={selectedComplaint.created_at} />)
                    </span>
                  </div>
                </div>

                {/* Manager Action Center */}
                {isManagerOrAdmin && (
                  <div style={{ 
                    border: "1px solid var(--border)", 
                    borderRadius: "var(--radius-md)", 
                    padding: "16px", 
                    marginBottom: 20,
                    background: "var(--surface)" 
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Wrench size={16} color="var(--primary)" />
                        <span style={{ fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Operations Manager Triage Controls
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {technicians.length} Technicians Available
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      
                      {/* Assign Technician */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                          Dispatch / Assign Technician
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            className="input"
                            value={triageAssignee}
                            onChange={(e) => setTriageAssignee(e.target.value)}
                            style={{ flex: 1, fontSize: "12px", height: 34 }}
                          >
                            <option value="">-- Unassigned (Needs Dispatch) --</option>
                            {technicians.map((t) => (
                              <option key={t.id} value={t.id}>
                                🔧 {t.name} ({t.email})
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={updateMutation.isPending || triageAssignee === (selectedComplaint.assignee_id || "")}
                            onClick={() => {
                              updateMutation.mutate({
                                id: selectedComplaint.id,
                                payload: { 
                                  assignee_id: triageAssignee,
                                  status: triageAssignee && selectedComplaint.status === "New" ? "In Progress" : selectedComplaint.status
                                }
                              });
                            }}
                            style={{ height: 34, fontSize: "12px", padding: "0 12px" }}
                          >
                            Save Tech
                          </button>
                        </div>
                      </div>

                      {/* Status & Priority Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>Workflow Status</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <select
                              className="input"
                              value={triageStatus}
                              onChange={(e) => setTriageStatus(e.target.value as WOStatus)}
                              style={{ flex: 1, fontSize: "12px", height: 32 }}
                            >
                              <option value="New">New</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Repaired">Repaired</option>
                              <option value="Scrap">Scrap</option>
                            </select>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={updateMutation.isPending || triageStatus === selectedComplaint.status}
                              onClick={() => {
                                updateMutation.mutate({
                                  id: selectedComplaint.id,
                                  payload: { status: triageStatus }
                                });
                              }}
                              style={{ height: 32, fontSize: "11px", padding: "0 8px" }}
                            >
                              Update
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>Severity Priority</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <select
                              className="input"
                              value={triagePriority}
                              onChange={(e) => setTriagePriority(e.target.value as WOPriority)}
                              style={{ flex: 1, fontSize: "12px", height: 32 }}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={updateMutation.isPending || triagePriority === selectedComplaint.priority}
                              onClick={() => {
                                updateMutation.mutate({
                                  id: selectedComplaint.id,
                                  payload: { priority: triagePriority }
                                });
                              }}
                              style={{ height: 32, fontSize: "11px", padding: "0 8px" }}
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* Communication & Activity Thread */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: "13px" }}>
                      Incident Log & Communications ({selectedComplaint.comments?.length || 0})
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Live thread between Employee, Manager, & Tech
                    </span>
                  </div>

                  {(!selectedComplaint.comments || selectedComplaint.comments.length === 0) ? (
                    <div style={{ 
                      padding: "20px", 
                      textAlign: "center", 
                      background: "var(--surface-sunken)", 
                      borderRadius: "var(--radius-md)", 
                      color: "var(--text-muted)", 
                      fontSize: "12px" 
                    }}>
                      No communication updates posted yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedComplaint.comments.map((cm, idx) => (
                        <div 
                          key={idx}
                          style={{
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 14px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text)" }}>
                              {cm.author_name}
                            </span>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                              <DateCell date={cm.created_at} /> (<Age date={cm.created_at} />)
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            {cm.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Note / Directive Input */}
                  <div style={{ marginTop: 14 }}>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder={isManagerOrAdmin ? "Post an official directive or instruction..." : "Add observation, symptom update, or question..."}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{ resize: "vertical", fontSize: "12px", width: "100%", marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={commentMutation.isPending || !commentText.trim()}
                        onClick={() => {
                          commentMutation.mutate({
                            id: selectedComplaint.id,
                            text: commentText.trim(),
                          });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px" }}
                      >
                        <Send size={13} />
                        <span>{isManagerOrAdmin ? "Post Manager Directive" : "Add Update"}</span>
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* Drawer Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Last modified <Age date={selectedComplaint.updated_at} />
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedComplaint(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
