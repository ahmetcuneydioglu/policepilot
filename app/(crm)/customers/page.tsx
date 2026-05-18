"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/database.types";
import CustomersTable from "@/components/CustomersTable";
import AddCustomerModal from "@/components/AddCustomerModal";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setFetchError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("customers") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("CUSTOMERS_FETCH_ERROR", error);
      let msg = error.message ?? "Bilinmeyen hata";
      if (error.code === "42501" || msg.toLowerCase().includes("rls") || msg.toLowerCase().includes("policy")) {
        msg = `RLS hatası: 'customers' tablosuna SELECT izni yok. Supabase Dashboard → Authentication → Policies bölümünden SELECT policy ekleyin. (${msg})`;
      } else if (error.code === "42P01") {
        msg = `Tablo bulunamadı: 'customers' tablosu Supabase'de mevcut değil. schema.sql dosyasını çalıştırın. (${msg})`;
      }
      setFetchError(msg);
      setLoading(false);
      return;
    }

    setCustomers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleClose() {
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {loading ? "Yükleniyor..." : fetchError ? "Veri alınamadı" : `${customers.length} müşteri kayıtlı`}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Müşteri
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 leading-relaxed break-words">
          <span className="font-semibold block mb-0.5">Veri çekme hatası</span>
          {fetchError}
        </div>
      )}

      {loading ? (
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
          <CustomersTable customers={customers} />
        </div>
      )}

      {showAdd && <AddCustomerModal onClose={handleClose} />}
    </div>
  );
}
