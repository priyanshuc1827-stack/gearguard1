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
  X,
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

function matchesDateRange(dateStr: string | null | undefined, startDate: string, endDate: string) {
  if (!startDate && !endDate) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  if (startDate) {
    const start = new Date(startDate + "T00:00:00");
    if (d < start) return false;
  }
  if (endDate) {
    const end = new Date(endDate + "T23:59:59.999");
    if (d > end) return false;
  }
  return true;
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "All Time";
  const format = (dStr: string) => {
    const parts = dStr.split("-");
    if (parts.length !== 3) return dStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  if (startDate && endDate) {
    if (startDate === endDate) return format(startDate);
    return `${format(startDate)} — ${format(endDate)}`;
  }
  if (startDate) return `From ${format(startDate)}`;
  return `Until ${format(endDate)}`;
}

function getPresetDates(preset: "all" | "today" | "7days" | "30days" | "thisMonth") {
  if (preset === "all") return { start: "", end: "" };
  const today = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const endStr = formatYMD(today);

  if (preset === "today") {
    return { start: endStr, end: endStr };
  } else if (preset === "7days") {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { start: formatYMD(past), end: endStr };
  } else if (preset === "30days") {
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    return { start: formatYMD(past), end: endStr };
  } else if (preset === "thisMonth") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: formatYMD(firstDay), end: endStr };
  }
  return { start: "", end: "" };
}

function DateRangeFilterBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activePreset,
  onSelectPreset,
  onClear,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  totalCount,
  filteredCount,
  itemLabel,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  activePreset: string;
  onSelectPreset: (preset: "all" | "today" | "7days" | "30days" | "thisMonth") => void;
  onClear: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder: string;
  totalCount: number;
  filteredCount: number;
  itemLabel: string;
}) {
  const isFiltered = Boolean(startDate || endDate || searchQuery.trim());

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        marginBottom: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Top Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Left: Date inputs and Quick Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text)", fontWeight: 600, fontSize: "12px" }}>
            <Calendar size={14} style={{ color: "var(--accent)" }} />
            <span>Date Range:</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              aria-label="From date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="input input-sm"
              style={{
                width: 135,
                height: 30,
                fontSize: "12px",
                padding: "2px 8px",
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>to</span>
            <input
              type="date"
              aria-label="To date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="input input-sm"
              style={{
                width: 135,
                height: 30,
                fontSize: "12px",
                padding: "2px 8px",
              }}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: 2,
              gap: 2,
            }}
          >
            {(
              [
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "7days", label: "Last 7D" },
                { id: "30days", label: "Last 30D" },
                { id: "thisMonth", label: "This Month" },
              ] as const
            ).map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreset(p.id)}
                  className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
                  style={{
                    fontSize: "11px",
                    height: 24,
                    padding: "0 8px",
                    borderRadius: "calc(var(--radius-sm) - 1px)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Clear Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={onClear}
              className="btn btn-sm btn-ghost"
              style={{
                fontSize: "11px",
                height: 26,
                padding: "0 8px",
                color: "var(--text-muted)",
              }}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Search Box */}
        <div style={{ position: "relative", minWidth: 260, flex: "1 1 240px", maxWidth: 340 }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            className="input input-sm"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              paddingLeft: 28,
              paddingRight: searchQuery ? 24 : 8,
              height: 30,
              fontSize: "12px",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "12px",
                padding: "2px",
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Status Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "var(--text-muted)",
          paddingTop: 6,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div>
          <span>
            Showing <strong style={{ color: "var(--text)" }}>{filteredCount}</strong> of{" "}
            <strong style={{ color: "var(--text)" }}>{totalCount}</strong> {itemLabel}
            {isFiltered && " (filtered)"}
          </span>
        </div>

        {(startDate || endDate) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className="badge badge-accent"
              style={{
                fontSize: "11px",
                padding: "1px 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Calendar size={11} />
              <span>{formatDateRangeLabel(startDate, endDate)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"custody" | "pending" | "approved" | "rejected">("custody");

  // Custody tab filter states
  const [custodyFilter, setCustodyFilter] = useState<"all" | "allocated" | "returned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [custodyStartDate, setCustodyStartDate] = useState("");
  const [custodyEndDate, setCustodyEndDate] = useState("");

  // Approved tab filter states
  const [approvedStartDate, setApprovedStartDate] = useState("");
  const [approvedEndDate, setApprovedEndDate] = useState("");
  const [approvedSearchQuery, setApprovedSearchQuery] = useState("");
  const [approvedPreset, setApprovedPreset] = useState<"all" | "today" | "7days" | "30days" | "thisMonth" | "custom">("all");

  // Rejected tab filter states
  const [rejectedStartDate, setRejectedStartDate] = useState("");
  const [rejectedEndDate, setRejectedEndDate] = useState("");
  const [rejectedSearchQuery, setRejectedSearchQuery] = useState("");
  const [rejectedPreset, setRejectedPreset] = useState<"all" | "today" | "7days" | "30days" | "thisMonth" | "custom">("all");

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

    const targetDate = r.status === "Returned" ? (r.return_date || r.allocated_date) : r.allocated_date;
    if (!matchesDateRange(targetDate, custodyStartDate, custodyEndDate)) return false;

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

  // Filtered approved records
  const filteredApproved = approved.filter((r) => {
    const targetDate = r.approval_date || r.request_date;
    if (!matchesDateRange(targetDate, approvedStartDate, approvedEndDate)) return false;

    if (!approvedSearchQuery.trim()) return true;
    const q = approvedSearchQuery.toLowerCase();
    return (
      (r.asset_name && r.asset_name.toLowerCase().includes(q)) ||
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_email && r.employee_email.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  // Filtered rejected records
  const filteredRejected = rejected.filter((r) => {
    const targetDate = r.rejection_date || r.request_date;
    if (!matchesDateRange(targetDate, rejectedStartDate, rejectedEndDate)) return false;

    if (!rejectedSearchQuery.trim()) return true;
    const q = rejectedSearchQuery.toLowerCase();
    return (
      (r.asset_name && r.asset_name.toLowerCase().includes(q)) ||
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_email && r.employee_email.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  // Preset handlers
  const handleApprovedPreset = (preset: "all" | "today" | "7days" | "30days" | "thisMonth") => {
    setApprovedPreset(preset);
    const { start, end } = getPresetDates(preset);
    setApprovedStartDate(start);
    setApprovedEndDate(end);
  };

  const handleClearApproved = () => {
    setApprovedStartDate("");
    setApprovedEndDate("");
    setApprovedSearchQuery("");
    setApprovedPreset("all");
  };

  const handleRejectedPreset = (preset: "all" | "today" | "7days" | "30days" | "thisMonth") => {
    setRejectedPreset(preset);
    const { start, end } = getPresetDates(preset);
    setRejectedStartDate(start);
    setRejectedEndDate(end);
  };

  const handleClearRejected = () => {
    setRejectedStartDate("");
    setRejectedEndDate("");
    setRejectedSearchQuery("");
    setRejectedPreset("all");
  };

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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

                {/* Custody Date Range Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  <Calendar size={13} style={{ color: "var(--accent)" }} />
                  <input
                    type="date"
                    value={custodyStartDate}
                    onChange={(e) => setCustodyStartDate(e.target.value)}
                    className="input input-sm"
                    style={{ width: 130, height: 26, fontSize: "11px", padding: "0 6px" }}
                    title="From date"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>to</span>
                  <input
                    type="date"
                    value={custodyEndDate}
                    onChange={(e) => setCustodyEndDate(e.target.value)}
                    className="input input-sm"
                    style={{ width: 130, height: 26, fontSize: "11px", padding: "0 6px" }}
                    title="To date"
                  />
                  {(custodyStartDate || custodyEndDate) && (
                    <button
                      onClick={() => { setCustodyStartDate(""); setCustodyEndDate(""); }}
                      className="btn btn-sm btn-ghost"
                      style={{ height: 24, padding: "0 6px", fontSize: "11px" }}
                      title="Clear custody date filter"
                    >
                      ✕
                    </button>
                  )}
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
              Approved Requisitions Ready for Equipment Allocation ({filteredApproved.length} of {approved.length})
            </div>

            <DateRangeFilterBar
              startDate={approvedStartDate}
              endDate={approvedEndDate}
              onStartDateChange={(d) => {
                setApprovedStartDate(d);
                setApprovedPreset("custom");
              }}
              onEndDateChange={(d) => {
                setApprovedEndDate(d);
                setApprovedPreset("custom");
              }}
              activePreset={approvedPreset}
              onSelectPreset={handleApprovedPreset}
              onClear={handleClearApproved}
              searchQuery={approvedSearchQuery}
              onSearchChange={setApprovedSearchQuery}
              searchPlaceholder="Search by asset, employee, email, reason..."
              totalCount={approved.length}
              filteredCount={filteredApproved.length}
              itemLabel="approved requisitions"
            />

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th>Approval Date</th>
                    <th style={{ textAlign: "right" }}>Manager Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reqsLoading ? (
                    <SkeletonRows cols={6} rows={3} />
                  ) : approved.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No approved requests waiting for asset allocation.
                      </td>
                    </tr>
                  ) : filteredApproved.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "36px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Calendar size={28} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "14px" }}>
                            No approved requisitions match the selected date or search filter.
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {approvedStartDate || approvedEndDate
                              ? `No records between ${formatDateRangeLabel(approvedStartDate, approvedEndDate)}.`
                              : "Try adjusting your search criteria."}
                          </div>
                          <button className="btn btn-sm btn-primary" onClick={handleClearApproved} style={{ marginTop: 4 }}>
                            Reset Filter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredApproved.map((req) => (
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
                        <td className="text-secondary" style={{ maxWidth: 240, fontSize: "12px", lineHeight: 1.4 }}>
                          {req.reason ?? "Standard operations requisition"}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: "12px", fontWeight: 500 }}>
                              {formatDateTime(req.approval_date || req.request_date)}
                            </span>
                            {req.request_date && req.approval_date && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                Req: {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(req.request_date))}
                              </span>
                            )}
                          </div>
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
              Rejected Requisitions History ({filteredRejected.length} of {rejected.length})
            </div>

            <DateRangeFilterBar
              startDate={rejectedStartDate}
              endDate={rejectedEndDate}
              onStartDateChange={(d) => {
                setRejectedStartDate(d);
                setRejectedPreset("custom");
              }}
              onEndDateChange={(d) => {
                setRejectedEndDate(d);
                setRejectedPreset("custom");
              }}
              activePreset={rejectedPreset}
              onSelectPreset={handleRejectedPreset}
              onClear={handleClearRejected}
              searchQuery={rejectedSearchQuery}
              onSearchChange={setRejectedSearchQuery}
              searchPlaceholder="Search by asset, employee, reason..."
              totalCount={rejected.length}
              filteredCount={filteredRejected.length}
              itemLabel="rejected requisitions"
            />

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested Asset</th>
                    <th>Category</th>
                    <th>Reason Given</th>
                    <th>Status</th>
                    <th>Rejection Date</th>
                    <th>Requested Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                        No rejected requisitions on record.
                      </td>
                    </tr>
                  ) : filteredRejected.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Calendar size={28} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                          <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "14px" }}>
                            No rejected requisitions match the selected date or search filter.
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {rejectedStartDate || rejectedEndDate
                              ? `No records between ${formatDateRangeLabel(rejectedStartDate, rejectedEndDate)}.`
                              : "Try adjusting your search criteria."}
                          </div>
                          <button className="btn btn-sm btn-primary" onClick={handleClearRejected} style={{ marginTop: 4 }}>
                            Reset Filter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRejected.map((req) => (
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
                        <td className="text-secondary">{req.category ?? "—"}</td>
                        <td className="text-secondary" style={{ maxWidth: 260, fontSize: "12px", lineHeight: 1.4 }}>
                          {req.reason ?? "—"}
                        </td>
                        <td>
                          <span className="badge badge-danger" style={{ fontSize: "11px", padding: "2px 8px" }}>
                            Rejected
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text)" }}>
                              {formatDateTime(req.rejection_date || req.request_date)}
                            </span>
                            {!req.rejection_date && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Decision recorded</span>
                            )}
                          </div>
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
