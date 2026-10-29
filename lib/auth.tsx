"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, refreshSession, setAccessToken, type User } from "./api";

type Ctx = {
  user: User | null;
  ready: boolean; // false until the first session check finishes
  startSession: (data: { user: User; accessToken: string }) => void;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    refreshSession().then((s) => {
      setUser(s?.user ?? null);
      setReady(true);
    });
  }, []);

  const startSession = useCallback((d: { user: User; accessToken: string }) => {
    setAccessToken(d.accessToken);
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", "POST").catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, startSession, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** For pages that need a logged-in student: sends guests to /login. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.ready && !auth.user) router.replace("/login");
  }, [auth.ready, auth.user, router]);
  return auth;
}
