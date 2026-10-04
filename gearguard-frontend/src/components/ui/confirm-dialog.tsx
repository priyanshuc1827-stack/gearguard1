"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel} role="dialog" aria-modal aria-labelledby="dialog-title">
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          {danger && <AlertTriangle size={18} style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }} aria-hidden />}
          <div>
            <h2 id="dialog-title" style={{ fontSize: "var(--text-md)", fontWeight: 500, marginBottom: 4 }}>{title}</h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{description}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <button className="btn btn-default" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
