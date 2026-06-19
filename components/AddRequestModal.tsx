"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { canAddRequest, limitMessage } from "@/lib/limits";
import { INACTIVE_MESSAGE } from "@/lib/limits";
import type { Customer } from "@/lib/database.types";

const requestTypes = ["Kasko", "Trafik", "Konut", "Sağlık", "Hayat", "DASK", "Ferdi Kaza", "İMM", "Yeşil Kart", "Seyahat"];

type Props = { customers: Customer[]; onClose: () => void; agencyId?: string | null };

export default function AddRequestModal({ customers, onClose, agencyId }: Props) {
  const [limitChecked, setLimitChecked] = useState(false);
  const [limitOk,      setLimitOk]      = useState(true);
  const [limitMsg,     setLimitMsg]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [form, setForm] = useState({ customer_id: "", request_type: "", price_offer: "" });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  // Check request limit on mount
  useEffect(() => {
    if (!agencyId) { setLimitChecked(true); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canAddRequest(supabase as any, agencyId).then((res) => {
      setLimitOk(res.ok && res.isActive);
      if (!res.isActive) setLimitMsg(INACTIVE_MESSAGE);
      else if (!res.ok)  setLimitMsg(`${limitMessage("request")} (${res.current}/${res.max})`);
      setLimitChecked(true);
    });
  }, [agencyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!limitOk) return;
    if (!form.customer_id || !form.request_type) {
      setError("Müşteri ve sigorta türü zorunludur.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id:  form.customer_id,
        request_type: form.request_type,
        price_offer:  form.price_offer || null,
        agency_id:    agencyId ?? null,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (json.code === "limit_exceeded" || json.code === "inactive") {
        setLimitOk(false);
        setLimitMsg(json.error);
      } else {
        setError(json.error ?? "Kayıt sırasında bir hata oluştu.");
      }
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Yeni Satış Fırsatı</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!limitChecked ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : !limitOk ? (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">{limitMsg}</p>
            </div>
            <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Kapat</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Müşteri *</label>
              <select value={form.customer_id} onChange={(e) => set("customer_id", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Müşteri seçin</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Sigorta Türü *</label>
              <select value={form.request_type} onChange={(e) => set("request_type", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Sigorta türü seçin</option>
                {requestTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Teklif Tutarı (₺) <span className="text-gray-400">(isteğe bağlı)</span></label>
              <input type="number" value={form.price_offer} onChange={(e) => set("price_offer", e.target.value)}
                placeholder="0.00" min="0" step="0.01"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                {loading ? "Kaydediliyor..." : "Fırsat Oluştur"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
