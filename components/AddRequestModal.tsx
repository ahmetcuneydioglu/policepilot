"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/database.types";

const requestTypes = ["Kasko", "Trafik", "Konut", "Sağlık", "Hayat", "DASK", "Ferdi Kaza"];

type Props = { customers: Customer[]; onClose: () => void };

export default function AddRequestModal({ customers, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    request_type: "",
    price_offer: "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.request_type) {
      setError("Müşteri ve talep türü zorunludur.");
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from("requests") as any).insert({
      customer_id: form.customer_id,
      request_type: form.request_type,
      status: "Yeni",
      price_offer: form.price_offer ? parseFloat(form.price_offer) : null,
    });
    setLoading(false);
    if (err) {
      setError("Kayıt sırasında bir hata oluştu.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Yeni Teklif Talebi</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Müşteri *</label>
            <select
              value={form.customer_id}
              onChange={(e) => set("customer_id", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Müşteri seçin</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Talep Türü *</label>
            <select
              value={form.request_type}
              onChange={(e) => set("request_type", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Sigorta türü seçin</option>
              {requestTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Teklif Tutarı (₺) — isteğe bağlı</label>
            <input
              type="number"
              value={form.price_offer}
              onChange={(e) => set("price_offer", e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              {loading ? "Kaydediliyor..." : "Teklif Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
