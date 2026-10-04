"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Trello, Calendar, HardDrive,
  LogOut, Zap, LogIn, BarChart3,
  Users, Layers, MapPin, ClipboardList, FileText, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [pathname]);

  const handleSignOut = () => {
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  };

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isLandingPage = pathname === "/";
  if (isAuthPage || isLandingPage) return null;

  const getMenuItems = () => {
    const role = user?.role;
    if (role === "admin") {
      return [
        { name: "Dashboard",  icon: <LayoutDashboard size={17} />, href: "/dashboard" },
        { name: "Kanban Board", icon: <Trello size={17} />,         href: "/kanban" },
        { name: "Assets",     icon: <HardDrive size={17} />,        href: "/equipment" },
        { name: "Categories", icon: <Layers size={17} />,           href: "/categories" },
        { name: "Locations",  icon: <MapPin size={17} />,           href: "/locations" },
        { name: "Users",      icon: <Users size={17} />,            href: "/users" },
      ];
    }
    if (role === "manager") {
      return [
        { name: "Dashboard",      icon: <LayoutDashboard size={17} />, href: "/dashboard" },
        { name: "Kanban Board",   icon: <Trello size={17} />,          href: "/kanban" },
        { name: "Assets",         icon: <HardDrive size={17} />,        href: "/equipment" },
        { name: "Asset Requests", icon: <ClipboardList size={17} />,   href: "/requests-management" },
        { name: "Audit Logs",     icon: <FileText size={17} />,        href: "/audit-logs" },
      ];
    }
    if (role === "user") {
      return [
        { name: "Dashboard",   icon: <LayoutDashboard size={17} />, href: "/dashboard" },
        { name: "My Requests", icon: <ClipboardList size={17} />,   href: "/my-requests" },
      ];
    }
    if (role === "technician") {
      return [
        { name: "Dashboard",   icon: <LayoutDashboard size={17} />, href: "/dashboard" },
        { name: "Kanban Board", icon: <Trello size={17} />,         href: "/kanban" },
        { name: "Calendar",    icon: <Calendar size={17} />,        href: "/calendar" },
      ];
    }
    if (role === "auditor") {
      return [
        { name: "Dashboard",   icon: <LayoutDashboard size={17} />, href: "/dashboard" },
        { name: "Kanban Board", icon: <Trello size={17} />,         href: "/kanban" },
        { name: "Reporting",   icon: <BarChart3 size={17} />,       href: "/reporting" },
        { name: "Audit Logs",  icon: <FileText size={17} />,        href: "/audit-logs" },
      ];
    }
    return [
      { name: "Dashboard", icon: <LayoutDashboard size={17} />, href: "/dashboard" }
    ];
  };

  const menuItems = getMenuItems();

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case "admin":      return { text: "Admin",      color: "#f43f5e" };
      case "manager":    return { text: "Manager",    color: "#f59e0b" };
      case "technician": return { text: "Technician", color: "#10b981" };
      case "auditor":    return { text: "Auditor",    color: "#6366f1" };
      case "user":       return { text: "Employee",   color: "#06b6d4" };
      default:           return { text: "Guest",      color: "#64748b" };
    }
  };
  const badge = getRoleBadge(user?.role);

  return (
    <aside
      className="w-64 flex flex-col justify-between h-full shrink-0"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* ── Logo ── */}
      <div className="p-5">
        <div className="flex items-center gap-3 px-1 pt-2 pb-7">
          <div
            className="p-2 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
          >
            <Zap size={18} style={{ color: "#10b981" }} />
          </div>
          <div>
            <span
              className="font-extrabold text-lg tracking-tight leading-none"
              style={{ color: "#e8eaf2" }}
            >
              GearGuard
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="beacon beacon-green" />
              <span style={{ color: "#10b981", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Live Monitoring
              </span>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="space-y-1">
          <p
            style={{ color: "#475569", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
            className="px-3 mb-3"
          >
            Navigation
          </p>
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                style={
                  active
                    ? {
                        background: "linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))",
                        borderLeft: "2px solid #10b981",
                        color: "#10b981",
                        paddingLeft: "10px",
                      }
                    : {
                        color: "#64748b",
                        borderLeft: "2px solid transparent",
                        paddingLeft: "10px",
                      }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                    (e.currentTarget as HTMLElement).style.background = "rgba(30,40,64,0.6)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "#64748b";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {item.icon}
                <span style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}>{item.name}</span>
                {active && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: "#10b981", boxShadow: "0 0 6px #10b981" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── User Panel ── */}
      <div
        className="p-4 space-y-3"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        {user ? (
          <>
            <div className="flex items-center gap-3 px-1 py-2 rounded-xl"
              style={{ background: "rgba(30,40,64,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback
                  className="text-xs font-bold uppercase"
                  style={{ background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44` }}
                >
                  {user.name?.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#e8eaf2" }}>{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Shield size={9} style={{ color: badge.color, flexShrink: 0 }} />
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider truncate"
                    style={{ color: badge.color }}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm font-medium transition-all"
              style={{ color: "#f43f5e" }}
              onClick={handleSignOut}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </Button>
          </>
        ) : (
          <Link href="/login" className="w-full block">
            <Button
              className="w-full justify-start gap-3 text-sm font-medium btn-glow"
            >
              <LogIn size={16} />
              <span>Login</span>
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );
}