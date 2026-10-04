"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Wrench, Package, LayoutDashboard } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const cmds = [
    { label: "Command Center", icon: LayoutDashboard, action: () => router.push("/dashboard") },
    { label: "Work Queue",     icon: Wrench,          action: () => router.push("/work-orders") },
    { label: "Assets",         icon: Package,         action: () => router.push("/assets") },
    { label: "New work order", icon: Plus,            action: () => router.push("/work-orders?new=1") },
    { label: "New asset request", icon: Plus,         action: () => router.push("/my-equipment?new=1") },
  ];

  const filtered = query
    ? cmds.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : cmds;

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal aria-label="Command palette">
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)", borderBottom: "1px solid var(--border)" }}>
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            style={{ padding: "var(--space-3) 0" }}
            placeholder="Jump to…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <kbd style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 5px" }}>Esc</kbd>
        </div>
        <div className="cmdk-list" role="listbox">
          {filtered.length === 0 && (
            <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>No results</div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <div
                key={i}
                className="cmdk-item"
                role="option"
                tabIndex={0}
                onClick={() => { cmd.action(); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { cmd.action(); setOpen(false); } }}
              >
                <Icon size={14} style={{ color: "var(--text-muted)" }} />
                {cmd.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
