"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Profile = {
  id: string;
  full_name: string | null;
  role: string; // 'super_admin' | 'agency_user'
  agency_id: string | null;
  created_at: string;
};

type AuthCtxType = {
  user: User | null;
  profile: Profile | null;
  role: string | null;
  /** Where the role was resolved from */
  roleSource: "profile" | "jwt" | null;
  /** Non-null when profiles fetch returned an error */
  profileError: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthCtxType>({
  user: null,
  profile: null,
  role: null,
  roleSource: null,
  profileError: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [profileError, setProfileErr] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const router = useRouter();

  // ── Fetch profile row for the given user id ────────────────────────────────
  const fetchProfile = useCallback(async (uid: string) => {
    setProfileErr(null);
    try {
      // Cast to any because the Proxy supabase client loses generic inference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase.from("profiles") as any)
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      const data  = res?.data  ?? null;
      const error = res?.error ?? null;

      if (error) {
        const msg = `profiles fetch error: ${error.message ?? JSON.stringify(error)}`;
        console.error("[AuthContext]", msg, { uid, error });
        setProfileErr(msg);
        return;
      }

      if (!data) {
        // Row doesn't exist yet (trigger may not have fired)
        console.warn("[AuthContext] No profile row for uid:", uid);
        setProfileErr(`profiles tablosunda satır bulunamadı (uid: ${uid.slice(0, 8)}…)`);
        return;
      }

      console.log("[AuthContext] Profile loaded:", data);
      setProfile(data as Profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AuthContext] fetchProfile threw:", msg, { uid });
      setProfileErr(`fetchProfile exception: ${msg}`);
    }
  }, []);

  // ── Bootstrap: read current session once on mount ─────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then((result: any) => {
      const u = result?.data?.session?.user ?? null;
      console.log("[AuthContext] Bootstrap user:", u?.id ?? "none", "app_metadata:", u?.app_metadata);
      setUser(u);
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, [fetchProfile]);

  // ── React to sign-in / sign-out events ────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = (supabase.auth.onAuthStateChange as any)(
      (_event: any, session: any) => {
        const u = session?.user ?? null;
        console.log("[AuthContext] onAuthStateChange:", _event, "user:", u?.id ?? "none");
        setUser(u);
        if (u) {
          fetchProfile(u.id);
        } else {
          setProfile(null);
          setProfileErr(null);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setProfileErr(null);
    router.push("/login");
  }, [router]);

  // ── Role resolution: profiles table first, JWT app_metadata fallback ───────
  const jwtRole = (user?.app_metadata as Record<string, string> | undefined)?.role ?? null;
  const role       = profile?.role ?? jwtRole;
  const roleSource: AuthCtxType["roleSource"] = profile?.role
    ? "profile"
    : jwtRole
    ? "jwt"
    : null;

  console.log("[AuthContext] role:", role, "source:", roleSource, "profile:", profile?.role, "jwt:", jwtRole);

  return (
    <AuthContext.Provider value={{ user, profile, role, roleSource, profileError, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
