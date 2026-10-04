"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "var(--space-6)", textAlign: "center" }}>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 500, marginBottom: "var(--space-2)" }}>Registration Closed</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
          Self-registration is disabled. Employee accounts are provisioned and managed by your facility administrators.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: "inline-flex", textDecoration: "none" }}>
          Go to Sign in
        </Link>
      </div>
    </div>
  );
}