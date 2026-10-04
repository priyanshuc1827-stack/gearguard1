"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "var(--space-6)" }}>
        <div style={{ marginBottom: "var(--space-8)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-lg)", letterSpacing: "-0.02em", marginBottom: "var(--space-2)" }}>GearGuard</div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 500 }}>Sign in</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>Equipment maintenance and asset management</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div role="alert" style={{ padding: "var(--space-3)", background: "var(--red-subtle)", border: "1px solid var(--red)", borderRadius: "var(--radius)", fontSize: "var(--text-sm)", color: "var(--red)" }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: "center", padding: "8px" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: "var(--space-6)", fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          Enterprise internal access. Employee accounts are provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}