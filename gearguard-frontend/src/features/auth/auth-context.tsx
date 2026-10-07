"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type User, type UserRole, ApiError } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await auth.login({ email, password });
    setUser(u);
    // Route to role home
    const home = roleHome(u.role);
    router.push(home);
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
    router.push("/login");
  };

  const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function roleHome(role: UserRole): string {
  switch (role) {
    case "admin":
    case "manager":   return "/dashboard";
    case "technician": return "/my-work";
    case "user":       return "/complaints";
    case "auditor":    return "/compliance";
    default:           return "/login";
  }
}
