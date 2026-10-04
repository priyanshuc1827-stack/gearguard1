"use client";

import React from "react";
import { Sidebar } from "@/components/custom/sidebar";
import { useAuth } from "@/features/auth/auth-context";
import { CommandPalette } from "@/components/custom/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" }}>
        <div className="skeleton" style={{ width: 180, height: 20, borderRadius: "var(--radius)" }} />
      </div>
    );
  }

  if (!user) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}
