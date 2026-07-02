"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider } from "@/lib/AuthContext";
import { NotificationProvider } from "@/lib/NotificationContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import CommandPalette from "@/components/CommandPalette";
import ToastContainer from "@/components/ToastContainer";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

// ─── Inner shell (needs AuthContext already mounted) ─────────────────────────
function InnerShell({ children }: { children: ReactNode }) {
  const { agencyId, role, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean | null>(null);

  // Security Center: telefon doğrulanmamışsa doğrulama sayfasına yönlendir
  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.verified_phone === false) router.replace("/guvenlik/dogrula");
  }, [authLoading, profile, router]);

  useEffect(() => {
    if (authLoading || role !== "agency_user" || !agencyId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("is_active")
      .eq("id", agencyId)
      .maybeSingle()
      .then(({ data }: { data: { is_active: boolean | null } | null }) => {
        setIsActive(data?.is_active ?? true);
      });
  }, [agencyId, role, authLoading]);

  // Doğrulanmamışsa korumalı içeriği RENDER ETME (flash önle) — yönlendirme efekti devrede
  if (!authLoading && profile?.verified_phone === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 flex-col">
      {/* ── Pasif acente banner ───────────────────────────────────────────── */}
      {role === "agency_user" && isActive === false && (
        <div className="flex-shrink-0 bg-red-600 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2 z-50">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Hesabınız pasif durumda — Yeni müşteri, teklif ve poliçe eklenemez. Yöneticinizle iletişime geçin.
        </div>
      )}

      <CommandPalette />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function CRMShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <InnerShell>{children}</InnerShell>
        <ToastContainer />
      </NotificationProvider>
    </AuthProvider>
  );
}
