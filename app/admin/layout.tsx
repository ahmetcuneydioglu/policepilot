"use client";

/**
 * Executive Command Center layout — yalnız super_admin.
 * Acente CRM kabuğundan (CRMShell) tamamen bağımsız deneyim.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role && role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, router]);

  if (loading || role !== "super_admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
