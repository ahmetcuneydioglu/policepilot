"use client";

/**
 * Executive Command Center layout — yalnız super_admin.
 * Acente CRM kabuğundan (CRMShell) bağımsız; AuthProvider'ı kendisi mount
 * eder (CRMShell'deki provider yalnız (crm) segmentini kapsar).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, loading, user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    // Security Center kapısı /admin grubunu da kapsamalı — super_admin de doğrulanmamışsa geçemez
    if (profile?.verified_phone === false) {
      router.replace("/guvenlik/dogrula");
      return;
    }
    if (role && role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, user, profile, router]);

  if (loading || role !== "super_admin" || profile?.verified_phone === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Command Center yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 min-w-0 px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
