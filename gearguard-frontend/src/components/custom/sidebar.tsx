"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wrench, CalendarDays, Package, Inbox,
  Monitor, BarChart2, Shield, LogOut, ChevronLeft, ChevronRight, Moon, Sun,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/components/ui/theme-provider";
import type { UserRole } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { label: "Command Center", href: "/dashboard",    icon: LayoutDashboard, roles: ["admin", "manager"] },
  { label: "Work Queue",     href: "/work-orders",  icon: Wrench,          roles: ["admin", "manager", "technician", "auditor"] },
  { label: "Complaints",     href: "/complaints",   icon: AlertTriangle,   roles: ["user", "manager", "admin"] },
  { label: "My Equipment",   href: "/my-equipment", icon: Monitor,         roles: ["user"] },
  { label: "Schedule",       href: "/schedule",     icon: CalendarDays,    roles: ["admin", "manager"] },
  { label: "My Work",        href: "/my-work",      icon: Wrench,          roles: ["technician"] },
  { label: "Custody & Approvals", href: "/approvals", icon: Inbox,       roles: ["admin", "manager"] },
  { label: "Assets",         href: "/assets",       icon: Package,         roles: ["admin", "manager", "technician", "auditor"] },
  { label: "Registry",       href: "/registry",     icon: Shield,          roles: ["admin"] },
  { label: "Ledger",         href: "/ledger",       icon: BarChart2,       roles: ["admin", "auditor", "manager"] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { resolved, setTheme } = useTheme();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;
  const visible = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <aside
      className="sidebar"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
      aria-label="Main navigation"
    >
      <div style={{ padding: "12px var(--space-3)", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {!collapsed && (
          <span style={{ fontWeight: 600, fontSize: "var(--text-md)", letterSpacing: "-0.02em" }}>GearGuard</span>
        )}
        <button className="btn btn-ghost btn-icon" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "var(--space-2)", display: "flex", flexDirection: "column", gap: 2 }}>
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`sidebar-nav-item ${active ? "active" : ""}`} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
              <Icon size={14} aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "var(--space-2)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
        <button className="sidebar-nav-item" onClick={() => setTheme(resolved === "dark" ? "light" : "dark")} title="Toggle theme">
          {resolved === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && <span>{resolved === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>
        {!collapsed && (
          <div style={{ padding: "6px var(--space-3)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <div style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{user.name}</div>
            <div style={{ textTransform: "capitalize" }}>{user.role === "user" ? "Employee" : user.role}</div>
          </div>
        )}
        <button className="sidebar-nav-item" onClick={logout} title="Sign out">
          <LogOut size={14} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}