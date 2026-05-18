"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const insuranceTypes = ["Kasko", "Trafik", "Konut", "Sağlık", "Hayat", "DASK", "Ferdi Kaza"];

type Props = { onClose: () => void };

function checkEnv(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "NEXT_PUBLIC_SUPABASE_URL eksik — .env.local dosyasını kontrol edin.";
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "NEXT_PUBLIC_SUPABASE_ANON_KEY eksik — .env.local dosyasını kontrol edin.";
  return null;
}

export default function AddCustomerModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", insurance_type: "", note: "" });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const envErr = checkEnv();
    if (envErr) {
      setError(envErr);
      console.error("ENV_MISSING", envErr);
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.insurance_type) {
      setError("Ad, telefon ve sigorta türü zorunludur.");
      return;
    }

    setLoading(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      insurance_type: form.insurance_type,
      note: form.note.trim() || null,
    };

    console.log("CUSTOMER_INSERT_PAYLOAD", payload);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase.from("customers") as any)
      .insert(payload)
      .select();

    setLoading(false);

    if (err) {
      console.error("CUSTOMER_INSERT_ERROR", err);

      let msg = err.message ?? "Bilinmeyen hata";
      if (err.code === "42501" || msg.toLowerCase().includes("rls") || msg.toLowerCase().includes("policy")) {
        msg = `RLS hatası: Supabase'de 'customers' tablosuna INSERT izni yok. Supabase Dashboard → Authentication → Policies bölümünden INSERT policy ekleyin. (${msg})`;
      } else if (err.code === "42P01") {
        msg = `Tablo bulunamadı: 'customers' tablosu Supabase'de mevcut değil. schema.sql dosyasını çalıştırın. (${msg})`;
      }

      setError(msg);
      return;
    }

    console.log("CUSTOMER_INSERT_SUCCESS", data);
    setForm({ name: "", phone: "", insurance_type: "", note: "" });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Yeni Müşteri Ekle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Ad Soyad *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ahmet Yılmaz"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Telefon *</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0532 123 45 67"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sigorta Türü *</label>
            <select
              value={form.insurance_type}
              onChange={(e) => set("insurance_type", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Seçiniz</option>
              {insuranceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Not (isteğe bağlı)</label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Müşteri hakkında kısa not..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg leading-relaxed break-words">
              <span className="font-semibold block mb-0.5">Hata</span>
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              {loading ? "Kaydediliyor..." : "Müşteri Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
