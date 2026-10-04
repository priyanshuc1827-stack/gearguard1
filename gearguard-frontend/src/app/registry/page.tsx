"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  users,
  equipment,
  workOrders,
  teams,
  categories,
  locations,
  type User,
  type Team,
  type Category,
  type Location,
  type UserRole,
} from "@/lib/api";
import { AppShell } from "@/components/custom/app-shell";
import { SkeletonRows, HumanId, StatusDot } from "@/components/custom/display";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Trash2,
  Plus,
  Users,
  Building2,
  Shield,
  Layers,
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
} from "lucide-react";

type MainTab = "staff" | "departments_db" | "teams" | "categories" | "locations";
const DEPARTMENTS = ["Machining", "Production", "Assembly", "Facilities", "Logistics", "Quality Control"];

export default function RegistryPage() {
  const [tab, setTab] = useState<MainTab>("staff");

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1280, margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="badge badge-accent" style={{ fontSize: "11px", textTransform: "uppercase" }}>
              System Administration
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              Central Operational Registry & Multi-Departmental Partitioning
            </span>
          </div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Plant Registry & Directory
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
            Manage departmental divisions, staff access roles (managers, technicians, auditors, employees), and plant infrastructure definitions.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
          <button
            onClick={() => setTab("staff")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "staff" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "staff" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: tab === "staff" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={15} />
            <span>Staff by Department & Role</span>
          </button>

          <button
            onClick={() => setTab("departments_db")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "departments_db" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "departments_db" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: tab === "departments_db" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Building2 size={15} />
            <span>Department Databases</span>
          </button>

          <button
            onClick={() => setTab("teams")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "teams" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "teams" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: tab === "teams" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Wrench size={15} />
            <span>Maintenance Teams</span>
          </button>

          <button
            onClick={() => setTab("categories")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "categories" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "categories" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: tab === "categories" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={15} />
            <span>Categories</span>
          </button>

          <button
            onClick={() => setTab("locations")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "locations" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "locations" ? "var(--text)" : "var(--text-secondary)",
              fontWeight: tab === "locations" ? 600 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Building2 size={15} />
            <span>Locations</span>
          </button>
        </div>

        {tab === "staff" && <StaffRegistryTab />}
        {tab === "departments_db" && <DepartmentDatabasesTab />}
        {tab === "teams" && <TeamsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "locations" && <LocationsTab />}
      </div>
    </AppShell>
  );
}

// ── Tab 1: Staff Registry by Department & Role ──────────────────────────────

function StaffRegistryTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: userList, isLoading } = useQuery({
    queryKey: ["users", selectedDept],
    queryFn: () => users.list({ department: selectedDept }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role, department }: { id: string; role?: UserRole; department?: string }) =>
      users.update(id, { role, department }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast("Staff record updated successfully", "success");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => users.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast("User removed from plant directory", "success");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const allUsers = userList ?? [];

  // Filtered users
  const filteredUsers = allUsers.filter((u) => {
    if (selectedRole !== "all" && u.role !== selectedRole) return false;
    if (selectedDept !== "All" && u.department !== selectedDept && u.role !== "admin") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Role counts
  const managers = filteredUsers.filter((u) => u.role === "manager");
  const employees = filteredUsers.filter((u) => u.role === "user");
  const technicians = filteredUsers.filter((u) => u.role === "technician");
  const auditors = filteredUsers.filter((u) => u.role === "auditor");
  const admins = filteredUsers.filter((u) => u.role === "admin");

  return (
    <div>
      {/* Top Filter and Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        
        {/* Department Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...DEPARTMENTS].map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`btn btn-sm ${selectedDept === dept ? "btn-primary" : "btn-outline"}`}
              style={{ fontSize: "11px", height: 28, padding: "0 10px" }}
            >
              {dept === "All" ? "🏢 All Departments" : dept}
            </button>
          ))}
        </div>

        {/* Action & View Mode */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 2 }}>
            <button
              onClick={() => setViewMode("grouped")}
              className={`btn btn-sm ${viewMode === "grouped" ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: "11px", height: 26, padding: "0 8px" }}
            >
              Group by Dept
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: "11px", height: 26, padding: "0 8px" }}
            >
              Detailed Table
            </button>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Role Sub-Filter & Search */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: `All Staff (${filteredUsers.length})` },
            { id: "manager", label: `Managers (${managers.length})` },
            { id: "user", label: `Employees / Operators (${employees.length})` },
            { id: "technician", label: `Technicians (${technicians.length})` },
            { id: "auditor", label: `Auditors (${auditors.length})` },
            { id: "admin", label: `Admins (${admins.length})` },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`btn btn-sm ${selectedRole === r.id ? "btn-default" : "btn-ghost"}`}
              style={{ fontSize: "11px", height: 26, padding: "0 8px" }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="input"
            placeholder="Search staff by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30, height: 30, fontSize: "12px", width: "100%" }}
          />
        </div>
      </div>

      {/* GROUPED VIEW */}
      {viewMode === "grouped" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {(selectedDept === "All" ? DEPARTMENTS : [selectedDept]).map((deptName) => {
            const deptStaff = filteredUsers.filter((u) => u.department === deptName || (u.role === "admin" && deptName === "Production"));
            const deptMgrs = deptStaff.filter((u) => u.role === "manager");
            const deptTechs = deptStaff.filter((u) => u.role === "technician");
            const deptEmps = deptStaff.filter((u) => u.role === "user");
            const deptAuditors = deptStaff.filter((u) => u.role === "auditor");

            return (
              <div key={deptName} className="card" style={{ padding: "18px 20px" }}>
                {/* Department Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={18} style={{ color: "var(--accent)" }} />
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                      {deptName} Department
                    </h3>
                    <span className="badge" style={{ fontSize: "11px", padding: "1px 7px" }}>
                      {deptStaff.length} Members
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, fontSize: "11px", color: "var(--text-muted)" }}>
                    <span>Managers: <strong>{deptMgrs.length}</strong></span>
                    <span>•</span>
                    <span>Technicians: <strong>{deptTechs.length}</strong></span>
                    <span>•</span>
                    <span>Employees: <strong>{deptEmps.length}</strong></span>
                    <span>•</span>
                    <span>Auditors: <strong>{deptAuditors.length}</strong></span>
                  </div>
                </div>

                {/* Sub-grid: Department Role Columns */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                  
                  {/* Department Managers */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#3b82f6", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>👔 Department Managers</span> ({deptMgrs.length})
                    </div>
                    {deptMgrs.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>None assigned</span>
                    ) : (
                      deptMgrs.map((u) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "4px 0", borderBottom: "1px dashed var(--border)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(u)} title="Remove user">
                            <Trash2 size={12} style={{ color: "var(--red)" }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Department Technicians */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#f59e0b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🔧 Service Technicians</span> ({deptTechs.length})
                    </div>
                    {deptTechs.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>None assigned</span>
                    ) : (
                      deptTechs.map((u) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "4px 0", borderBottom: "1px dashed var(--border)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(u)} title="Remove user">
                            <Trash2 size={12} style={{ color: "var(--red)" }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Department Employees / Operators */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>👷 Plant Operators & Employees</span> ({deptEmps.length})
                    </div>
                    {deptEmps.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>None assigned</span>
                    ) : (
                      deptEmps.map((u) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "4px 0", borderBottom: "1px dashed var(--border)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(u)} title="Remove user">
                            <Trash2 size={12} style={{ color: "var(--red)" }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Department Auditors */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#8b5cf6", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🛡️ Compliance Auditors</span> ({deptAuditors.length})
                    </div>
                    {deptAuditors.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Central / None in bay</span>
                    ) : (
                      deptAuditors.map((u) => (
                        <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "4px 0", borderBottom: "1px dashed var(--border)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(u)} title="Remove user">
                            <Trash2 size={12} style={{ color: "var(--red)" }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th style={{ width: 80, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={5} rows={6} />
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-muted)" }}>
                    No staff members found for the selected department and role filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td className="text-secondary">{u.email}</td>
                    <td>
                      <select
                        className="input input-sm select"
                        style={{ width: 140, fontSize: "11px" }}
                        value={u.department ?? "Production"}
                        onChange={(e) => updateMutation.mutate({ id: u.id, department: e.target.value })}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input input-sm select"
                        style={{ width: 130, fontSize: "11px" }}
                        value={u.role}
                        onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value as UserRole })}
                      >
                        {["admin", "manager", "technician", "user", "auditor"].map((r) => (
                          <option key={r} value={r}>
                            {r === "user" ? "user (employee)" : r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setDeleteTarget(u)}
                        title="Delete user"
                      >
                        <Trash2 size={13} style={{ color: "var(--red)" }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewUserModal
          defaultDept={selectedDept !== "All" ? selectedDept : "Production"}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["users"] });
            toast("New staff member registered", "success");
            setShowNew(false);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Remove staff member?"
          description={`Permanently remove ${deleteTarget.name} (${deleteTarget.email}) from the plant registry? This cannot be undone.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Tab 2: Department Databases ─────────────────────────────────────────────

function DepartmentDatabasesTab() {
  const [selectedDept, setSelectedDept] = useState<string>("Machining");

  const { data: deptEq, isLoading: eqLoading } = useQuery({
    queryKey: ["equipment", "dept", selectedDept],
    queryFn: () => equipment.list({ department: selectedDept, all: true }),
  });

  const { data: deptWos, isLoading: woLoading } = useQuery({
    queryKey: ["work-orders", "dept", selectedDept],
    queryFn: () => workOrders.list({ department: selectedDept, page_size: 50 }),
  });

  const { data: deptUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["users", "dept", selectedDept],
    queryFn: () => users.list({ department: selectedDept }),
  });

  const assets = deptEq ?? [];
  const wos = deptWos?.items ?? [];
  const staff = deptUsers ?? [];

  const allocatedAssets = assets.filter((a) => a.assigned_employee !== "Unassigned" && a.assigned_employee);
  const openComplaints = wos.filter((w) => w.status !== "Repaired" && w.status !== "Scrap");

  return (
    <div>
      {/* Department Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-5)" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>Inspect Department:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`btn btn-sm ${selectedDept === dept ? "btn-primary" : "btn-outline"}`}
              style={{ fontSize: "12px", height: 30, padding: "0 12px" }}
            >
              {dept} Database
            </button>
          ))}
        </div>
      </div>

      {/* Department Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: "var(--space-6)" }}>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Machinery
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: 4 }}>{assets.length}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
            Registered in {selectedDept}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            In Employee Custody
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: 4, color: "var(--accent)" }}>
            {allocatedAssets.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
            Allocated to operators
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Active Tickets / Complaints
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: 4, color: openComplaints.length > 0 ? "#f59e0b" : "var(--text)" }}>
            {openComplaints.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
            Under maintenance review
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Department Staff
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: 4 }}>{staff.length}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 2 }}>
            Total personnel in division
          </div>
        </div>
      </div>

      {/* Department Assets Table */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
          {selectedDept} Plant Machinery Inventory ({assets.length})
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine / Equipment</th>
                <th>Serial Number</th>
                <th>Category</th>
                <th>Location</th>
                <th>Assigned Custody</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {eqLoading ? (
                <SkeletonRows cols={6} rows={4} />
              ) : assets.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No equipment registered in {selectedDept}.</td></tr>
              ) : (
                assets.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <HumanId id={a.human_id} />
                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                      </div>
                    </td>
                    <td className="mono">{a.serial_number}</td>
                    <td className="text-secondary">{a.category ?? "General"}</td>
                    <td className="text-secondary">{a.location ?? "—"}</td>
                    <td>
                      {a.assigned_employee && a.assigned_employee !== "Unassigned" ? (
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>{a.assigned_employee}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>Unassigned (In Storage)</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ fontSize: "10px", padding: "1px 6px" }}>
                        Operational
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Work Orders & Complaints Table */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
          {selectedDept} Work Orders & Complaints ({wos.length})
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Subject / Malfunction</th>
                <th>Equipment</th>
                <th>Filed By</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {woLoading ? (
                <SkeletonRows cols={7} rows={4} />
              ) : wos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No work orders or complaints in {selectedDept}.</td></tr>
              ) : (
                wos.map((w) => (
                  <tr key={w.id}>
                    <td><HumanId id={w.human_id} /></td>
                    <td style={{ fontWeight: 500 }}>{w.subject}</td>
                    <td className="text-secondary">{w.equipment_name ?? "—"}</td>
                    <td className="text-secondary">{w.creator_name ?? "Operator"}</td>
                    <td className="text-secondary">{w.assignee_name ?? "Unassigned"}</td>
                    <td>
                      <span className={`badge ${w.priority === "critical" ? "badge-danger" : w.priority === "high" ? "badge-warning" : "badge"}`} style={{ fontSize: "10px", padding: "1px 6px" }}>
                        {w.priority}
                      </span>
                    </td>
                    <td><StatusDot status={w.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Add User Modal ──────────────────────────────────────────────────────────

function NewUserModal({ defaultDept, onClose, onCreated }: { defaultDept: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [role, setRole] = useState<UserRole>("user");
  const [department, setDepartment] = useState(defaultDept);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      await users.create({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        department,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Register New Staff Member</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label className="label">Full Name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="label">Corporate Email Address *</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="label">Temporary Password *</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="label">Department Assignment *</label>
              <select className="input select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Access Role *</label>
              <select className="input select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="user">Employee (Plant Operator)</option>
                <option value="manager">Department Manager</option>
                <option value="technician">Service Technician</option>
                <option value="auditor">Compliance Auditor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {error && <div style={{ color: "var(--red)", fontSize: "12px" }}>⚠️ {error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Registering..." : "Register Staff Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 3: Teams Tab ────────────────────────────────────────────────────────

function TeamsTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const { data: teamList, isLoading } = useQuery({ queryKey: ["teams"], queryFn: teams.list });

  const createMutation = useMutation({
    mutationFn: () => teams.create({ name: newName.trim(), description: newDesc.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast("Team created successfully", "success");
      setNewName("");
      setNewDesc("");
      setShowAddModal(false);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teams.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teams"] }); toast("Team deleted", "success"); setDeleteTarget(null); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Manage cross-functional maintenance teams and dispatch specialties across plant facilities.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />
          <span>Add Maintenance Team</span>
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Description</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {isLoading ? <SkeletonRows cols={3} /> :
              (teamList ?? []).map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td className="text-secondary">{t.description ?? "—"}</td>
                  <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(t)} title="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Maintenance Team</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="label">Team Name *</label>
                  <input className="input" placeholder="e.g. Electrical & Controls Team" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="label">Description / Specialty</label>
                  <input className="input" placeholder="e.g. High voltage, PLC controls, servo drives" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim() || createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && <ConfirmDialog title="Delete team" description={`Delete team "${deleteTarget.name}"?`} confirmLabel="Delete" danger onConfirm={() => deleteMutation.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ── Tab 4: Categories Tab ───────────────────────────────────────────────────

function CategoriesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: catList, isLoading } = useQuery({ queryKey: ["categories"], queryFn: categories.list });

  const createMutation = useMutation({
    mutationFn: () => categories.create({ name: newName.trim(), description: newDesc.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast("Category created successfully", "success");
      setNewName("");
      setNewDesc("");
      setShowAddModal(false);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categories.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast("Deleted", "success"); setDeleteTarget(null); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Categorize machinery, diagnostic tools, and production plant equipment.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />
          <span>Add Category</span>
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Description</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {isLoading ? <SkeletonRows cols={3} /> :
              (catList ?? []).map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td className="text-secondary">{c.description ?? "—"}</td>
                  <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(c)} title="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Equipment Category</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="label">Category Name *</label>
                  <input className="input" placeholder="e.g. CNC Machine Centers" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="label">Description</label>
                  <input className="input" placeholder="e.g. Computer numerical control milling and turning machinery" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim() || createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && <ConfirmDialog title="Delete category" description={`Delete category "${deleteTarget.name}"?`} confirmLabel="Delete" danger onConfirm={() => deleteMutation.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ── Tab 5: Locations Tab ────────────────────────────────────────────────────

function LocationsTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const { data: locList, isLoading } = useQuery({ queryKey: ["locations"], queryFn: locations.list });

  const createMutation = useMutation({
    mutationFn: () => locations.create({ name: newName.trim(), address: newAddress.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast("Location created successfully", "success");
      setNewName("");
      setNewAddress("");
      setShowAddModal(false);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => locations.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast("Deleted", "success"); setDeleteTarget(null); },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
          Manage work centers, factory cleanrooms, assembly bays, and warehouse locations.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />
          <span>Add Location</span>
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Address</th><th style={{ width: 50 }} /></tr></thead>
          <tbody>
            {isLoading ? <SkeletonRows cols={3} /> :
              (locList ?? []).map((l) => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 500 }}>{l.name}</td>
                  <td className="text-secondary">{l.address ?? "—"}</td>
                  <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(l)} title="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Work Center Location</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label className="label">Location / Area Name *</label>
                  <input className="input" placeholder="e.g. Plant Bay C - East" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="label">Work Center Address / Notes</label>
                  <input className="input" placeholder="e.g. Building 2, Floor 1, Near Logistics Dock" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim() || createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && <ConfirmDialog title="Delete location" description={`Delete location "${deleteTarget.name}"?`} confirmLabel="Delete" danger onConfirm={() => deleteMutation.mutate(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
