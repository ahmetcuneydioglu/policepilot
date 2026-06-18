"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Customer } from "@/lib/database.types";
import CustomersTable, { type Member } from "@/components/CustomersTable";
import AddCustomerModal from "@/components/AddCustomerModal";
import BulkPolicyImport from "@/components/BulkPolicyImport";
import { withScopeFilter, isManagerial } from "@/lib/tenant";

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const { role, agencyId, can, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshAll = () => setRefreshKey((k) => k + 1);

  // owner/manager → "Ekleyen" sütunu/filtresi
  const managerial = isManagerial(profile?.agency_role);

  // arama debounce + filtre/arama değişince ilk sayfaya dön
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.replace(/[%,()]/g, " ").trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch, creatorFilter]);

  // ── Sayfa verisi: kapsam + arama + Ekleyen filtresi + .range (1000-cap'siz) ─
  const loadPage = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = withScopeFilter((supabase.from("customers") as any).select("*", { count: "exact" }).order("created_at", { ascending: false }), role, agencyId, profile?.id, profile?.agency_role);
    const s = debouncedSearch;
    if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,insurance_type.ilike.%${s}%`);
    if (creatorFilter !== "all") q = q.eq("created_by", creatorFilter);
    const from = page * PAGE_SIZE;
    const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("CUSTOMERS_FETCH_ERROR", error);
      setFetchError(error.message ?? "Veri alınamadı");
      setLoading(false);
      return;
    }
    setCustomers((data ?? []) as Customer[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [role, agencyId, profile?.id, profile?.agency_role, debouncedSearch, creatorFilter, page]);

  useEffect(() => { loadPage(); }, [loadPage, refreshKey]);

  // Managerial → acente üyelerini çek ("Ekleyen" eşlemesi)
  useEffect(() => {
    if (!managerial) { setMembers([]); return; }
    fetch("/api/agency/members")
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.members)) setMembers(j.members); })
      .catch(() => {});
  }, [managerial, agencyId]);

  function handleClose() { setShowAdd(false); setPage(0); refreshAll(); }

  const showSkeleton = loading && customers.length === 0 && total === 0 && !fetchError;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {showSkeleton ? "Yükleniyor..." : fetchError ? "Veri alınamadı" : `${total} müşteri kayıtlı`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can("policy.create") && (
            <button
              onClick={() => setShowBulk(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-all"
              title="Birden çok poliçeyi OCR ile toplu yükle"
            >
              📦 Toplu Poliçe Yükle
            </button>
          )}
          {can("customer.edit") && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Müşteri
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-relaxed break-words">
          <span className="font-semibold block mb-0.5">Veri çekme hatası</span>
          {fetchError}
        </div>
      )}

      {showSkeleton ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="shimmer w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="shimmer h-3.5 rounded w-40" />
                <div className="shimmer h-3 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : !fetchError && (
        <div className="animate-fade-in-up stagger-1">
          <CustomersTable
            customers={customers}
            members={managerial ? members : undefined}
            search={search}
            onSearch={setSearch}
            creatorFilter={creatorFilter}
            onCreatorFilter={setCreatorFilter}
            total={total}
          />
          {total > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-400">
                {`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} / ${total} kayıt`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                >← Önceki</button>
                <span className="text-xs text-gray-500 tabular-nums">Sayfa {page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE < total ? p + 1 : p))}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
                >Sonraki →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddCustomerModal onClose={handleClose} agencyId={agencyId} role={role} />}

      {showBulk && (
        <BulkPolicyImport
          agencyId={agencyId}
          role={role}
          onClose={() => { setShowBulk(false); setPage(0); refreshAll(); }}
          onDone={refreshAll}
        />
      )}
    </div>
  );
}
