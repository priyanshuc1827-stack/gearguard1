"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const mutation = useMutation({
    mutationFn: (data: any) => authRequest("login", data),
    onSuccess: (user) => {
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dashboard");
    },
    onError: (error: any) => alert(error.message),
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0b0f19" }}
    >
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative w-full max-w-[420px] space-y-8 p-6 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="p-3 rounded-2xl"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <Zap size={24} style={{ color: "#10b981" }} />
            </div>
            <span className="text-3xl font-extrabold tracking-tight" style={{ color: "#e8eaf2" }}>
              GearGuard
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="beacon beacon-green" />
            <span style={{ color: "#10b981", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              System Online
            </span>
          </div>
          <p style={{ color: "#64748b" }} className="text-sm mt-2">
            Enter your credentials to access the control panel
          </p>
        </div>

        {/* Card */}
        <div
          className="p-8 rounded-2xl space-y-6"
          style={{
            background: "rgba(19,25,41,0.9)",
            border: "1px solid rgba(148,163,184,0.1)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: "#64748b" }}
              >
                <Mail size={10} /> Work Email
              </label>
              <Input
                className="h-11 rounded-xl text-sm"
                style={{
                  background: "rgba(30,40,64,0.6)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  color: "#e8eaf2",
                }}
                placeholder="name@company.com"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: "#64748b" }}
              >
                <Lock size={10} /> Access Password
              </label>
              <Input
                type="password"
                className="h-11 rounded-xl text-sm"
                style={{
                  background: "rgba(30,40,64,0.6)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  color: "#e8eaf2",
                }}
                placeholder="••••••••"
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <Button
            className="w-full h-11 font-bold text-sm rounded-xl btn-glow"
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              "Access Control Panel →"
            )}
          </Button>


        </div>

        <p className="text-center text-[9px] uppercase tracking-widest" style={{ color: "#334155" }}>
          Secure Terminal Access Protocol v4.0
        </p>
      </div>
    </div>
  );
}