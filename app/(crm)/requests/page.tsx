"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withScopeFilter, withRequestScope } from "@/lib/tenant";
import type { Request, Customer } from "@/lib/database.types";
import AddRequestModal from "@/components/AddRequestModal";

const statusStyles: Record<string, string> = {
  Yeni: "bg-blue-100 text-blue-700",
  İşlemde: "bg-indigo-100 text-indigo-700",
  Tamamlandı: "bg-emerald-100 text-emerald-700",
  İptal: "bg-red-100 text-red-700",
};

type RequestWithCustomer = Request & { customers: { name: string } | null };

export default function RequestsPage() {
  const { role, agencyId, profile } = useAuth();
  const [requests, setRequests] = useState<RequestWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    // requests'te created_by yok → bağlı müşterinin created_by'si üzerinden scope.
    // Non-managerial: yalnız kendi müşterilerinin talepleri görünür.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reqQuery = (supabase.from("requests") as any)
      .select("*, customers!inner(name, created_by)")
      .order("created_at", { ascending: false });
    reqQuery = withRequestScope(reqQuery, role, agencyId, profile?.id, profile?.agency_role);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let custQuery = (supabase.from("customers") as any)
      .select("id, name, phone, insurance_type, note, created_at")
      .order("name");
    custQuery = withScopeFilter(custQuery, role, agencyId, profile?.id, profile?.agency_role);
    const [{ data: reqs }, { data: custs }] = await Promise.all([reqQuery, custQuery]);
    setRequests((reqs as RequestWithCustomer[]) ?? []);
    setCustomers((custs as Customer[]) ?? []);
    setLoading(false);
  }

  // re-fetch when auth resolves (role/agencyId may be null on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [role, agencyId, profile?.id, profile?.agency_role]);

  async function updateStatus(id: string, status: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("requests") as any).update({ status }).eq("id", id);
    load();
  }

  function handleClose() {
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teklif Talepleri</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {loading ? "Yükleniyor..." : `${requests.length} talep`}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Teklif Oluştur
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" />
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Henüz teklif talebi yok</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Müşteri</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tür</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teklif (₺)</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req, i) => (
                  <tr key={req.id} className="hover:bg-blue-50/30 transition-colors animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                          {(req.customers?.name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-medium text-slate-800">{req.customers?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{req.request_type}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {req.price_offer ? `₺${Number(req.price_offer).toLocaleString("tr-TR")}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(req.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {req.status === "Yeni" && (
                          <button onClick={() => updateStatus(req.id, "İşlemde")} className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            İşleme Al
                          </button>
                        )}
                        {req.status === "İşlemde" && (
                          <button onClick={() => updateStatus(req.id, "Tamamlandı")} className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                            Tamamla
                          </button>
                        )}
                        {(req.status === "Yeni" || req.status === "İşlemde") && (
                          <button onClick={() => updateStatus(req.id, "İptal")} className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                            İptal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddRequestModal customers={customers} onClose={handleClose} agencyId={agencyId} />}
    </div>
  );
}
