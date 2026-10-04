/**
 * lib/api.ts — Typed API client.
 * All requests go through fetch with credentials:"include" so the httpOnly
 * JWT cookie is sent automatically. Never reads or writes localStorage.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const b = await res.json(); detail = b.detail ?? detail; } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "technician" | "user" | "auditor";
export interface User { id: string; name: string; email: string; role: UserRole; department?: string | null; }

export type WOStatus = "New" | "In Progress" | "Repaired" | "Scrap";
export type WOPriority = "low" | "medium" | "high" | "critical";
export type WOType = "Corrective" | "Preventive";

export interface Comment { author_id: string; author_name: string; text: string; created_at: string; }

export interface WorkOrder {
  id: string; human_id: string; subject: string; type: WOType; status: WOStatus;
  priority: WOPriority; is_complaint?: boolean; equipment_id: string | null; equipment_name: string | null;
  equipment_human_id: string | null; equipment_department?: string | null;
  equipment_location?: string | null; equipment_assigned_to?: string | null;
  team_id: string | null;
  created_by: string | null; creator_name: string | null;
  creator_email?: string | null; creator_role?: string | null;
  assignee_id: string | null; assignee_name: string | null;
  scheduled_date: string | null; due_date: string | null;
  started_at: string | null; completed_at: string | null;
  downtime_minutes: number | null; duration: number; cost: number | null;
  comments: Comment[]; created_at: string; updated_at: string;
}

export interface WorkOrderListResponse { total: number; page: number; page_size: number; items: WorkOrder[]; }
export interface WorkOrderFilters {
  page?: number; page_size?: number; status?: WOStatus; priority?: WOPriority;
  assignee_id?: string; equipment_id?: string; search?: string; complaints_only?: boolean;
  department?: string; sort_by?: string; sort_dir?: 1 | -1;
}

export interface Equipment {
  id: string; human_id: string; name: string; serial_number: string; department: string;
  category: string | null; location: string | null; maintenance_team_id: string | null;
  assigned_employee: string; last_service_date: string | null;
  is_usable: boolean; open_work_order_count: number; created_at: string;
}

export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Allocated" | "Returned";
export interface AssetRequest {
  id: string; employee_id: string; employee_name: string; employee_email?: string | null;
  asset_name: string; category: string | null; reason: string | null; status: RequestStatus;
  allocated_asset_id: string | null; allocated_asset_name: string | null;
  allocated_asset_human_id: string | null; allocated_asset_department?: string | null;
  request_date: string;
  approval_date: string | null; allocated_date: string | null; return_date: string | null;
}

export interface Team { id: string; name: string; description: string | null; }
export interface Category { id: string; name: string; description: string | null; }
export interface Location { id: string; name: string; address: string | null; }

export interface AuditLog {
  id: string; actor_id: string; actor_name: string; action: string;
  entity_type: string; entity_id: string; entity_label: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  timestamp: string;
}

// ── API namespaces ────────────────────────────────────────────────────────

export const auth = {
  signup: (b: { name: string; email: string; password: string; confirm_password: string }) =>
    request<User>("/auth/signup", { method: "POST", body: JSON.stringify(b) }),
  login: (b: { email: string; password: string }) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify(b) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
};

export const workOrders = {
  list: (f: WorkOrderFilters = {}) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== null) p.set(k, String(v)); });
    return request<WorkOrderListResponse>(`/work-orders/?${p}`);
  },
  get: (id: string) => request<WorkOrder>(`/work-orders/${id}`),
  create: (b: { equipment_id: string; subject: string; type?: WOType; priority?: WOPriority; assignee_id?: string; due_date?: string }) =>
    request<WorkOrder>("/work-orders/", { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: Partial<{ subject: string; status: WOStatus; priority: WOPriority; assignee_id: string; due_date: string; downtime_minutes: number; duration: number; cost: number }>) =>
    request<WorkOrder>(`/work-orders/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  comment: (id: string, text: string) =>
    request<WorkOrder>(`/work-orders/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  delete: (id: string) => request<void>(`/work-orders/${id}`, { method: "DELETE" }),
};

export const equipment = {
  list: (opts?: { all?: boolean; department?: string } | unknown) => {
    const isAll = typeof opts === "object" && opts !== null && "all" in opts && Boolean((opts as { all?: boolean }).all);
    const dept = typeof opts === "object" && opts !== null && "department" in opts ? (opts as { department?: string }).department : undefined;
    const p = new URLSearchParams();
    if (isAll) p.set("all_assets", "true");
    if (dept && dept !== "All") p.set("department", dept);
    const qs = p.toString();
    return request<Equipment[]>(`/equipment/${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Equipment>(`/equipment/${id}`),
  create: (b: Partial<Equipment> & { name: string; serial_number: string }) =>
    request<Equipment>("/equipment/", { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: Partial<Equipment>) =>
    request<Equipment>(`/equipment/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  return: (id: string) =>
    request<Equipment>(`/equipment/${id}/return`, { method: "POST" }),
  delete: (id: string) => request<void>(`/equipment/${id}`, { method: "DELETE" }),
};

export const users = {
  list: (opts?: { department?: string } | unknown) => {
    const dept = typeof opts === "object" && opts !== null && "department" in opts ? (opts as { department?: string }).department : undefined;
    const qs = dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : "";
    return request<User[]>(`/users/${qs}`);
  },
  get: (id: string) => request<User>(`/users/${id}`),
  create: (b: { name: string; email: string; password: string; role: UserRole; department?: string }) =>
    request<User>("/users/", { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: Partial<{ name: string; email: string; role: UserRole; department?: string }>) =>
    request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  delete: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
};

export const assetRequests = {
  list: (opts?: { department?: string } | unknown) => {
    const dept = typeof opts === "object" && opts !== null && "department" in opts ? (opts as { department?: string }).department : undefined;
    const qs = dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : "";
    return request<AssetRequest[]>(`/asset-requests/${qs}`);
  },
  create: (b: { asset_name: string; category?: string; reason?: string }) =>
    request<AssetRequest>("/asset-requests/", { method: "POST", body: JSON.stringify(b) }),
  approve: (id: string) => request<AssetRequest>(`/asset-requests/${id}/approve`, { method: "PATCH", body: "{}" }),
  reject: (id: string) => request<AssetRequest>(`/asset-requests/${id}/reject`, { method: "PATCH", body: "{}" }),
  allocate: (id: string, equipment_id: string) =>
    request<AssetRequest>(`/asset-requests/${id}/allocate`, { method: "PATCH", body: JSON.stringify({ equipment_id }) }),
  return: (id: string) => request<AssetRequest>(`/asset-requests/${id}/return`, { method: "PATCH", body: "{}" }),
};

export const teams = {
  list: () => request<Team[]>("/teams/"),
  create: (b: { name: string; description?: string }) =>
    request<Team>("/teams/", { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: { name: string; description?: string }) =>
    request<Team>(`/teams/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  delete: (id: string) => request<void>(`/teams/${id}`, { method: "DELETE" }),
};

export interface ReportSummary {
  totalWorkOrders: number;
  openWorkOrders: number;
  inProgress: number;
  repaired: number;
  scrapped: number;
  overdue: number;
  totalDowntimeMinutes: number;
  totalAssets: number;
  outOfServiceAssets: number;
  totalTechnicians: number;
  repairRate: number;
  department?: string;
}

export const reports = {
  summary: (dept?: string) => request<ReportSummary>(`/reports/summary${dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : ""}`),
  highRisk: (dept?: string) => request<Record<string, unknown>[]>(`/reports/high-risk${dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : ""}`),
  technicianPerformance: (dept?: string) => request<Record<string, unknown>[]>(`/reports/technician-performance${dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : ""}`),
  downtimeTrend: (dept?: string) => request<Record<string, unknown>[]>(`/reports/downtime-trend${dept && dept !== "All" ? `?department=${encodeURIComponent(dept)}` : ""}`),
};

export const auditLogs = {
  list: (params?: { page?: number; page_size?: number; entity_type?: string; action?: string }) => {
    const p = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined) p.set(k, String(v)); });
    return request<{ total: number; page: number; page_size: number; items: AuditLog[] }>(`/audit-logs/?${p}`);
  },
};

export const categories = {
  list: () => request<Category[]>("/categories/"),
  create: (b: { name: string; description?: string }) =>
    request<Category>("/categories/", { method: "POST", body: JSON.stringify(b) }),
  delete: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),
};

export const locations = {
  list: () => request<Location[]>("/locations/"),
  create: (b: { name: string; address?: string }) =>
    request<Location>("/locations/", { method: "POST", body: JSON.stringify(b) }),
  delete: (id: string) => request<void>(`/locations/${id}`, { method: "DELETE" }),
};