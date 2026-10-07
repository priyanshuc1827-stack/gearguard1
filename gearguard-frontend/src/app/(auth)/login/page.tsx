"use client";

import React, { useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";

/* ── inline keyframes injected once ──────────────────────────────────────── */
const STYLE = `
  @keyframes gg-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes gg-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes gg-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes gg-pulse-ring {
    0%   { box-shadow: 0 0 0 0   rgba(217,119,6,0.35); }
    70%  { box-shadow: 0 0 0 8px rgba(217,119,6,0);    }
    100% { box-shadow: 0 0 0 0   rgba(217,119,6,0);    }
  }
  .gg-login-btn {
    position: relative; overflow: hidden;
    width: 100%; padding: 11px 0;
    font-size: 14px; font-weight: 600; letter-spacing: 0.01em;
    border: none; border-radius: 6px; cursor: pointer;
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    color: #fff;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .gg-login-btn::after {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
    background-size: 200% 100%;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .gg-login-btn:hover:not(:disabled)::after {
    opacity: 1;
    animation: gg-shimmer 0.65s ease forwards;
  }
  .gg-login-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(217,119,6,0.38);
    filter: brightness(1.06);
  }
  .gg-login-btn:active:not(:disabled) {
    transform: translateY(0px) scale(0.985);
    box-shadow: 0 2px 8px rgba(217,119,6,0.25);
    filter: brightness(0.97);
  }
  .gg-login-btn:focus-visible {
    outline: none;
    animation: gg-pulse-ring 1s ease-out;
    box-shadow: 0 0 0 3px rgba(217,119,6,0.45);
  }
  .gg-login-btn:disabled {
    opacity: 0.7; cursor: not-allowed;
  }
  .gg-input {
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .gg-input:focus {
    border-color: var(--accent, #d97706) !important;
    box-shadow: 0 0 0 3px rgba(217,119,6,0.12);
    outline: none;
  }
  .gg-card {
    animation: gg-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }
  .gg-spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: gg-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 8px;
  }
`;

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{STYLE}</style>

      {/* Full-viewport split background */}
      <div style={{
        display: "flex", minHeight: "100dvh",
        background: "var(--bg, #fafaf9)",
      }}>

        {/* ── Left accent panel (hidden on small screens) ───────────────── */}
        <div style={{
          display: "none",
          flex: "0 0 420px",
          background: "linear-gradient(155deg, #1c1b17 0%, #292519 60%, #3d2e0a 100%)",
          position: "relative", overflow: "hidden",
        }}
          className="gg-left-panel"
        >
          {/* decorative grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `
              linear-gradient(rgba(217,119,6,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(217,119,6,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }} />
          {/* glow orb */}
          <div style={{
            position: "absolute", top: "30%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(217,119,6,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{
            position: "relative", zIndex: 1,
            padding: "48px 40px", display: "flex",
            flexDirection: "column", height: "100%",
          }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "auto" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "linear-gradient(135deg, #d97706, #92400e)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, boxShadow: "0 4px 14px rgba(217,119,6,0.4)",
              }}>⚙</div>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#fafaf9", letterSpacing: "-0.02em" }}>
                GearGuard
              </span>
            </div>

            {/* Tagline */}
            <div style={{ paddingBottom: 48 }}>
              <div style={{
                fontSize: 28, fontWeight: 700, color: "#fafaf9",
                letterSpacing: "-0.03em", lineHeight: 1.25, marginBottom: 14,
              }}>
                Industrial<br />Maintenance<br />Intelligence
              </div>
              <p style={{ fontSize: 13, color: "rgba(250,250,249,0.5)", lineHeight: 1.7, maxWidth: 280 }}>
                Real-time work orders, predictive asset tracking, and ISO-compliant audit logs — all in one platform.
              </p>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
                {[["99.2%", "Uptime SLA"], ["−60%", "MTTR"], ["ISO 55001", "Compliant"]].map(([val, lab]) => (
                  <div key={lab}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#d97706" }}>{val}</div>
                    <div style={{ fontSize: 11, color: "rgba(250,250,249,0.45)", marginTop: 2 }}>{lab}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right login panel ─────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex",
          alignItems: "center", justifyContent: "center",
          padding: "32px 24px",
        }}>
          <div
            className="gg-card"
            style={{
              width: "100%", maxWidth: 380,
              background: "var(--bg-elevated, #fff)",
              border: "1px solid var(--border, #e8e7e5)",
              borderRadius: 12,
              padding: "36px 32px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {/* Card header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: "linear-gradient(135deg, #d97706, #b45309)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, boxShadow: "0 3px 10px rgba(217,119,6,0.3)",
                }}>⚙</div>
                <span style={{
                  fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em",
                  color: "var(--text)",
                }}>GearGuard</span>
              </div>

              <h1 style={{
                fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
                color: "var(--text)", margin: 0,
              }}>
                Welcome back
              </h1>
              <p style={{
                fontSize: 13, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.5,
              }}>
                Sign in to your maintenance operations account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: "block", fontSize: 12, fontWeight: 600,
                    color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.01em",
                  }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input gg-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  style={{ width: "100%", fontSize: 13 }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: "block", fontSize: 12, fontWeight: 600,
                    color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.01em",
                  }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    className="input gg-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{ width: "100%", fontSize: 13, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    style={{
                      position: "absolute", right: 10, top: "50%",
                      transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-muted)", fontSize: 14, padding: 2,
                      lineHeight: 1,
                    }}
                    title={showPw ? "Hide password" : "Show password"}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "10px 12px",
                    background: "var(--red-subtle, #fef2f2)",
                    border: "1px solid rgba(220,38,38,0.25)",
                    borderRadius: 6, fontSize: 12, color: "#dc2626",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <div style={{ marginTop: 4 }}>
                <button
                  type="submit"
                  className="gg-login-btn"
                  disabled={loading || !email || !password}
                >
                  {loading ? (
                    <>
                      <span className="gg-spinner" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in →"
                  )}
                </button>
              </div>
            </form>

            {/* Footer note */}
            <p style={{
              marginTop: 24,
              fontSize: 11, color: "var(--text-muted)",
              textAlign: "center", lineHeight: 1.6,
              borderTop: "1px solid var(--border)",
              paddingTop: 18,
            }}>
              Enterprise internal access only.<br />
              Employee accounts are provisioned by your system administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Make left panel visible on wider screens */}
      <style>{`
        @media (min-width: 860px) {
          .gg-left-panel { display: flex !important; }
        }
      `}</style>
    </>
  );
}