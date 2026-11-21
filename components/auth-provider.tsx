"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User, UserRole } from "@/lib/services/authService";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isExaminer: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch (err) {
      console.warn("Failed to check auth state:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUser(data.user);
          return { success: true };
        }
        return { success: false, error: data.error || "Login failed" };
      } catch (err: any) {
        return { success: false, error: err?.message || "Network error" };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  }, []);

  const switchUser = useCallback(
    async (role: UserRole) => {
      let email = "student@papercheck.ai";
      let password = "student123";

      if (role === "examiner") {
        email = "nitin@codebrahmastra.com";
        password = "examiner123";
      } else if (role === "admin") {
        email = "admin@papercheck.ai";
        password = "admin123";
      }

      await login(email, password);
    },
    [login]
  );

  const isExaminer = user?.role === "examiner" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const isAuthenticated = !!user;

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      isExaminer,
      isAdmin,
      isStudent,
      login,
      logout,
      switchUser,
      refreshUser,
    }),
    [user, isLoading, isAuthenticated, isExaminer, isAdmin, isStudent, login, logout, switchUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
