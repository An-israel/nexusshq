import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { fetchUserRolesWithRetry, pickTopRole } from "@/lib/role-access";
import { logSupabaseClientError } from "@/lib/supabase-diagnostics";

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
  const [roleLoading, setRoleLoading] = React.useState(false);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfileAndRole = React.useCallback(async (userId: string) => {
    setRoleLoading(true);
    const [profileResult, roleResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      fetchUserRolesWithRetry(userId),
    ]);

    if (profileResult.error) {
      logSupabaseClientError({
        scope: "auth-context:profileLookup",
        error: profileResult.error,
        matchers: ["/rest/v1/profiles", `id=eq.${userId}`],
        extra: {
          userId,
          query: "select * from profiles where id = ?",
        },
      });
      console.warn("Failed to load user profile", profileResult.error);
    } else {
      setProfile((profileResult.data as NexusProfile) ?? null);
    }

    if (roleResult.error) {
      logSupabaseClientError({
        scope: "auth-context:roleLookup",
        error: roleResult.error,
        matchers: ["/rest/v1/user_roles", `user_id=eq.${userId}`],
        extra: {
          userId,
          query: "select role from user_roles where user_id = ?",
        },
      });
      console.warn("Failed to load user role", roleResult.error);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        void loadProfileAndRole(userId);
      }, 2500);
    } else {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setRole(pickTopRole(roleResult.roles as { role: AppRole }[]));
    }

    setRoleLoading(false);
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

    // Safety: never stay loading longer than 8s regardless of network issues
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    // 2) THEN check existing
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(safetyTimer);
      setSession(s);
      if (s?.user) {
        loadProfileAndRole(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndRole]);

  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

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
    [loading, roleLoading, session, profile, role, loadProfileAndRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
