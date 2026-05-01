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

// --- localStorage cache helpers (no-ops on server) ---
const CACHE_PROFILE = "nexus_profile";
const CACHE_ROLE = "nexus_role";

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function clearProfileCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_PROFILE);
    window.localStorage.removeItem(CACHE_ROLE);
  } catch {}
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  // Initialise from cache so returning users never see the loading spinner
  const [profile, setProfile] = React.useState<NexusProfile | null>(
    () => readCache<NexusProfile>(CACHE_PROFILE),
  );
  const [role, setRole] = React.useState<AppRole | null>(
    () => readCache<AppRole>(CACHE_ROLE),
  );
  // Skip loading state if we already have cached data
  const [loading, setLoading] = React.useState(
    () => readCache<NexusProfile>(CACHE_PROFILE) === null,
  );
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfileAndRole = React.useCallback(async (userId: string) => {
    const [profileResult, roleResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, department, job_title, avatar_url, is_active")
        .eq("id", userId)
        .maybeSingle(),
      fetchUserRolesWithRetry(userId),
    ]);

    if (profileResult.error) {
      logSupabaseClientError({
        scope: "auth-context:profileLookup",
        error: profileResult.error,
        matchers: ["/rest/v1/profiles", `id=eq.${userId}`],
        extra: { userId },
      });
      console.warn("Failed to load user profile", profileResult.error);
    } else if (profileResult.data) {
      const p = profileResult.data as NexusProfile;
      setProfile(p);
      writeCache(CACHE_PROFILE, p);
    }

    if (roleResult.error) {
      logSupabaseClientError({
        scope: "auth-context:roleLookup",
        error: roleResult.error,
        matchers: ["/rest/v1/user_roles", `user_id=eq.${userId}`],
        extra: { userId },
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
      const picked = pickTopRole(roleResult.roles as { role: AppRole }[]);
      setRole(picked);
      writeCache(CACHE_ROLE, picked);
    }
  }, []);

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => void loadProfileAndRole(newSession.user.id), 0);
      } else {
        clearProfileCache();
        setProfile(null);
        setRole(null);
      }
    });

    // Safety: cap loading at 4s even on total network failure
    const safetyTimer = setTimeout(() => setLoading(false), 4000);

    // getSession() reads Supabase's own localStorage cache — nearly instant
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(safetyTimer);
      setSession(s);
      if (s?.user) {
        const hasCache = readCache<NexusProfile>(CACHE_PROFILE) !== null;
        if (hasCache) {
          // Show UI immediately; refresh data silently in background
          setLoading(false);
          void loadProfileAndRole(s.user.id);
        } else {
          // First visit — wait for profile before showing dashboard
          void loadProfileAndRole(s.user.id).finally(() => setLoading(false));
        }
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
        clearProfileCache();
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
