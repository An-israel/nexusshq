import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "employee";

export interface NexusProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: NexusProfile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<NexusProfile | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfileAndRole = React.useCallback(async (userId: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as NexusProfile) ?? null);
    const list = ((roles as { role: AppRole }[]) ?? []).map((r) => r.role);
    const top: AppRole | null = list.includes("admin")
      ? "admin"
      : list.includes("manager")
        ? "manager"
        : list.includes("employee")
          ? "employee"
          : null;
    setRole(top);
  }, []);

  React.useEffect(() => {
    // 1) Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlocks
        setTimeout(() => loadProfileAndRole(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    // 2) THEN check existing
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfileAndRole(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfileAndRole]);

  const value: AuthContextValue = React.useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role,
      isAdmin: role === "admin",
      isManager: role === "manager" || role === "admin",
      isEmployee: role === "employee",
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        if (session?.user) await loadProfileAndRole(session.user.id);
      },
    }),
    [loading, session, profile, role, loadProfileAndRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
