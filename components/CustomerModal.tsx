"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/database.types";

type Props = {
  customer: Customer;
  onClose: () => void;
};

export default function CustomerModal({ customer, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"info" | "notes">("info");
  const [note, setNote] = useState(customer.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const waPhone = "90" + customer.phone.replace(/\s/g, "").slice(1);

  async function saveNote() {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("customers") as any).update({ note }).eq("id", customer.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-900 px-6 py-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{customer.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 font-medium">
                {customer.insurance_type}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <a href={`tel:${customer.phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Ara
            </a>
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["info", "notes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "info" ? "Bilgiler" : "Not"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === "info" && (
            <div className="space-y-1">
              {[
                { label: "Telefon", value: customer.phone },
                { label: "Sigorta Türü", value: customer.insurance_type },
                { label: "Kayıt Tarihi", value: new Date(customer.created_at).toLocaleDateString("tr-TR") },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
                  <span className="text-sm text-slate-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "notes" && (
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Müşteri hakkında not ekleyin..."
                rows={5}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={saveNote}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : saved ? "✓ Kaydedildi" : "Notu Kaydet"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
