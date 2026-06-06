"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Policy, PolicyStatus, Customer } from "@/lib/database.types";
import WhatsAppModal from "@/components/WhatsAppModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type PolicyWithCustomer = Policy & {
  customers: { name: string; phone: string } | null;
};

type FilterKey = "Tümü" | "Aktif" | "Yaklaşan" | "Geçmiş" | "Pasif";

const POLICY_TYPES = [
  "Kasko", "Trafik", "Konut", "Sağlık", "Hayat",
  "DASK", "Ferdi Kaza", "İMM", "Yeşil Kart", "Seyahat",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 864e5));
}
function isExpired(endDate: string): boolean {
  return new Date(endDate).getTime() < Date.now();
}

function expiryBadge(endDate: string, status: PolicyStatus) {
  if (status === "Pasif") return { label: "Pasif", cls: "bg-gray-100 text-gray-500 border-gray-200" };
  if (isExpired(endDate)) return { label: "Süresi Doldu", cls: "bg-red-100 text-red-700 border-red-200" };
  const days = daysLeft(endDate);
  if (days <= 5)  return { label: `${days} gün`, cls: "bg-red-100 text-red-700 border-red-200" };
  if (days <= 15) return { label: `${days} gün`, cls: "bg-amber-100 text-amber-700 border-amber-200" };
  if (days <= 30) return { label: `${days} gün`, cls: "bg-yellow-100 text-yellow-700 border-yellow-200" };
  return { label: `${days} gün`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

// ─── WA SVG ───────────────────────────────────────────────────────────────────
const WA_SVG = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-fade-in-up">
      <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white text-xs">✓</span>
      {message}
    </div>
  );
}

// ─── Info Row (detail modal) ──────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-medium w-28 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
type PolicyFormData = {
  customer_id: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium: string;
  insurance_company: string;
  policy_no: string;
  commission: string;
  note: string;
  status: PolicyStatus;
};

function PolicyFormModal({
  mode,
  initial,
  agencyId,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  initial?: PolicyWithCustomer | null;
  agencyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PolicyFormData>({
    customer_id:       initial?.customer_id ?? "",
    policy_type:       initial?.policy_type ?? "Kasko",
    start_date:        initial?.start_date ?? "",
    end_date:          initial?.end_date ?? "",
    premium:           initial?.premium?.toString() ?? "",
    insurance_company: initial?.insurance_company ?? "",
    policy_no:         initial?.policy_no ?? "",
    commission:        initial?.commission?.toString() ?? "",
    note:              initial?.note ?? "",
    status:            initial?.status ?? "Aktif",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Müşteri arama
  const [custSearch, setCustSearch] = useState(initial?.customers?.name ?? "");
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [custDropOpen, setCustDropOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setField(k: keyof PolicyFormData, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function searchCustomers(q: string) {
    if (!q.trim()) { setCustResults([]); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("customers") as any)
      .select("id, name, phone, insurance_type, note, created_at")
      .ilike("name", `%${q}%`)
      .limit(6);
    if (agencyId) query = query.eq("agency_id", agencyId);
    const { data } = await query;
    setCustResults(data ?? []);
    setCustDropOpen(true);
  }

  function handleCustInput(v: string) {
    setCustSearch(v);
    setField("customer_id", "");
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(v), 250);
  }

  function selectCustomer(c: Customer) {
    setCustSearch(c.name);
    setField("customer_id", c.id);
    setCustResults([]);
    setCustDropOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError("Lütfen bir müşteri seçin."); return; }
    if (!form.start_date || !form.end_date) { setError("Başlangıç ve bitiş tarihi zorunlu."); return; }
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      customer_id:       form.customer_id,
      policy_type:       form.policy_type,
      start_date:        form.start_date,
      end_date:          form.end_date,
      status:            form.status,
      agency_id:         agencyId,
      insurance_company: form.insurance_company || null,
      policy_no:         form.policy_no || null,
      premium:           form.premium ? parseFloat(form.premium) : null,
      commission:        form.commission ? parseFloat(form.commission) : null,
      note:              form.note || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = mode === "add"
      ? (supabase.from("policies") as any).insert(payload)
      : (supabase.from("policies") as any).update(payload).eq("id", initial!.id);

    const { error: err } = await q;
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    onClose();
  }

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-lg">
              📄
            </div>
            <h2 className="font-bold text-slate-800">{isEdit ? "Poliçeyi Düzenle" : "Yeni Poliçe Ekle"}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* Müşteri arama */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Müşteri *</label>
            <input
              type="text"
              value={custSearch}
              onChange={(e) => handleCustInput(e.target.value)}
              onFocus={() => custResults.length && setCustDropOpen(true)}
              placeholder="Müşteri adı ara..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
            {custDropOpen && custResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {custResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </button>
                ))}
              </div>
            )}
            {form.customer_id && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Müşteri seçildi</span>
              </div>
            )}
          </div>

          {/* Poliçe Türü */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Poliçe Türü *</label>
            <div className="flex flex-wrap gap-1.5">
              {POLICY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setField("policy_type", t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.policy_type === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Başlangıç Tarihi *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bitiş Tarihi *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
          </div>

          {/* Prim & Komisyon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prim (₺)</label>
              <input
                type="number"
                value={form.premium}
                onChange={(e) => setField("premium", e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Komisyon (₺)</label>
              <input
                type="number"
                value={form.commission}
                onChange={(e) => setField("commission", e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
          </div>

          {/* Sigorta şirketi & Poliçe No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sigorta Şirketi</label>
              <input
                type="text"
                value={form.insurance_company}
                onChange={(e) => setField("insurance_company", e.target.value)}
                placeholder="Axa, Allianz..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Poliçe No</label>
              <input
                type="text"
                value={form.policy_no}
                onChange={(e) => setField("policy_no", e.target.value)}
                placeholder="POL-2025-..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
            </div>
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notlar</label>
            <textarea
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              rows={2}
              placeholder="Özel notlar..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 resize-none"
            />
          </div>

          {/* Durum (edit modunda) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Durum</label>
              <div className="flex gap-2">
                {(["Aktif", "Pasif"] as PolicyStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField("status", s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      form.status === s
                        ? s === "Aktif"
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-gray-500 text-white border-gray-500"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span>⚠️</span> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-sm"
          >
            {saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Poliçe Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail / View Modal ──────────────────────────────────────────────────────
function PolicyDetailModal({
  policy,
  agencyId,
  onClose,
  onRefresh,
}: {
  policy: PolicyWithCustomer;
  agencyId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [toast, setToast] = useState("");

  const badge = expiryBadge(policy.end_date, policy.status);
  const days = policy.status === "Aktif" && !isExpired(policy.end_date) ? daysLeft(policy.end_date) : 0;

  async function toggleStatus() {
    setTogglingStatus(true);
    const next: PolicyStatus = policy.status === "Aktif" ? "Pasif" : "Aktif";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("policies") as any).update({ status: next }).eq("id", policy.id);
    setTogglingStatus(false);
    onRefresh();
    onClose();
  }

  if (editing) {
    return (
      <PolicyFormModal
        mode="edit"
        initial={policy}
        agencyId={agencyId}
        onClose={() => setEditing(false)}
        onSaved={() => { onRefresh(); onClose(); }}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-fade-in-up">

          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">📄</div>
                <div>
                  <h2 className="font-bold text-white text-base">{policy.policy_type}</h2>
                  <p className="text-blue-100 text-xs mt-0.5">{policy.customers?.name ?? "—"}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white p-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Badge */}
            <div className="mt-4 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {badge.label}
              </span>
              {days > 0 && days <= 30 && (
                <span className="text-white/80 text-xs">Yenileme zamanı yaklaşıyor</span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">

            {/* Poliçe Bilgileri */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Poliçe Bilgileri</p>
              <div className="space-y-0 bg-gray-50/60 rounded-xl px-4 divide-y divide-gray-100">
                <InfoRow label="Durum" value={policy.status} />
                <InfoRow label="Başlangıç" value={policy.start_date} />
                <InfoRow label="Bitiş" value={policy.end_date} />
                {policy.premium != null && (
                  <InfoRow label="Prim" value={`₺${policy.premium.toLocaleString("tr-TR")}`} />
                )}
                {policy.commission != null && (
                  <InfoRow label="Komisyon" value={`₺${policy.commission.toLocaleString("tr-TR")}`} />
                )}
                {policy.insurance_company && (
                  <InfoRow label="Şirket" value={policy.insurance_company} />
                )}
                {policy.policy_no && (
                  <InfoRow label="Poliçe No" value={policy.policy_no} />
                )}
              </div>
            </div>

            {/* Müşteri */}
            {policy.customers && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Müşteri</p>
                <div className="bg-gray-50/60 rounded-xl px-4 divide-y divide-gray-100">
                  <InfoRow label="Ad Soyad" value={policy.customers.name} />
                  {policy.customers.phone && (
                    <InfoRow label="Telefon" value={policy.customers.phone} />
                  )}
                </div>
              </div>
            )}

            {/* Notlar */}
            {policy.note && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notlar</p>
                <p className="text-sm text-slate-700 bg-gray-50 rounded-xl p-4 leading-relaxed">{policy.note}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-2">
            {/* WhatsApp + Düzenle */}
            <div className="flex gap-2">
              <button
                onClick={() => setWaOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 border border-emerald-100 transition-all"
              >
                {WA_SVG}
                Hatırlat
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 border border-blue-100 transition-all"
              >
                ✏️ Düzenle
              </button>
            </div>

            {/* Aktif/Pasif toggle */}
            <button
              onClick={toggleStatus}
              disabled={togglingStatus}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 border ${
                policy.status === "Aktif"
                  ? "bg-red-50 text-red-700 border-red-100 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
              }`}
            >
              {togglingStatus ? "İşleniyor..." : policy.status === "Aktif" ? "🔴 Poliçeyi Pasif Yap" : "✅ Poliçeyi Aktif Yap"}
            </button>
          </div>
        </div>
      </div>

      {waOpen && (
        <WhatsAppModal
          customerName={policy.customers?.name ?? "Müşteri"}
          phone={policy.customers?.phone ?? ""}
          insuranceType={policy.policy_type}
          onClose={() => setWaOpen(false)}
          onSent={() => setToast("WhatsApp mesajı hazırlandı")}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </>
  );
}

// ─── Policy Row (table) ───────────────────────────────────────────────────────
function PolicyRow({
  policy,
  index,
  onSelect,
  onWa,
}: {
  policy: PolicyWithCustomer;
  index: number;
  onSelect: (p: PolicyWithCustomer) => void;
  onWa: (p: PolicyWithCustomer) => void;
}) {
  const days  = policy.status === "Aktif" && !isExpired(policy.end_date) ? daysLeft(policy.end_date) : 0;
  const badge = expiryBadge(policy.end_date, policy.status);
  const isCritical = days > 0 && days <= 5 && policy.status === "Aktif";

  const initials = (policy.customers?.name ?? "?")
    .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <tr
      className={`hover:bg-blue-50/30 transition-colors group cursor-pointer animate-fade-in-up ${isCritical ? "bg-red-50/30" : ""}`}
      style={{ animationDelay: `${index * 25}ms` }}
      onClick={() => onSelect(policy)}
    >
      {/* Müşteri */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {isCritical && <span className="w-1.5 h-8 rounded-full bg-red-500 flex-shrink-0" />}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-transform group-hover:scale-105 ${isCritical ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{policy.customers?.name ?? "—"}</p>
            {policy.customers?.phone && (
              <p className="text-xs text-gray-400">{policy.customers.phone}</p>
            )}
          </div>
        </div>
      </td>

      {/* Tür */}
      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
          {policy.policy_type}
        </span>
      </td>

      {/* Şirket + No */}
      <td className="px-6 py-4">
        <p className="text-sm text-slate-700">{policy.insurance_company ?? "—"}</p>
        {policy.policy_no && (
          <p className="text-xs text-gray-400 mt-0.5">{policy.policy_no}</p>
        )}
      </td>

      {/* Tarihler */}
      <td className="px-6 py-4 text-xs text-gray-500">
        <p>{policy.start_date}</p>
        <p className="mt-0.5 font-medium text-slate-700">{policy.end_date}</p>
      </td>

      {/* Kalan */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {badge.label}
        </span>
      </td>

      {/* Prim */}
      <td className="px-6 py-4 text-sm text-slate-700">
        {policy.premium != null ? `₺${policy.premium.toLocaleString("tr-TR")}` : "—"}
      </td>

      {/* Aksiyonlar */}
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onWa(policy)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-all border border-emerald-100"
        >
          {WA_SVG}
          Hatırlat
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoliciesPage() {
  const { role, agencyId } = useAuth();
  const [policies, setPolicies] = useState<PolicyWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("Tümü");
  const [selected, setSelected] = useState<PolicyWithCustomer | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [waPolicy, setWaPolicy] = useState<PolicyWithCustomer | null>(null);
  const [toast, setToast] = useState("");

  const fetchPolicies = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("policies") as any)
      .select("*, customers(name, phone)")
      .order("end_date", { ascending: true });
    if (role === "agency_user" && agencyId) {
      q = q.eq("agency_id", agencyId);
    }
    const { data } = await q;
    setPolicies((data ?? []) as PolicyWithCustomer[]);
    setLoading(false);
  }, [role, agencyId]);

  useEffect(() => {
    setLoading(true);
    fetchPolicies();
  }, [fetchPolicies]);

  // ── Filtre sayıları
  const counts = {
    Tümü:     policies.length,
    Aktif:    policies.filter((p) => p.status === "Aktif" && !isExpired(p.end_date)).length,
    Yaklaşan: policies.filter((p) => p.status === "Aktif" && !isExpired(p.end_date) && daysLeft(p.end_date) <= 30).length,
    Geçmiş:   policies.filter((p) => isExpired(p.end_date)).length,
    Pasif:    policies.filter((p) => p.status === "Pasif").length,
  };

  // ── Filtrele + arama
  const q = search.toLowerCase().trim();
  const filtered = policies.filter((p) => {
    // Filtre chip
    if (filter === "Aktif"    && (p.status !== "Aktif" || isExpired(p.end_date))) return false;
    if (filter === "Yaklaşan" && (p.status !== "Aktif" || isExpired(p.end_date) || daysLeft(p.end_date) > 30)) return false;
    if (filter === "Geçmiş"   && !isExpired(p.end_date)) return false;
    if (filter === "Pasif"    && p.status !== "Pasif") return false;
    // Arama
    if (q) {
      const hit =
        (p.customers?.name?.toLowerCase().includes(q) ?? false) ||
        p.policy_type.toLowerCase().includes(q) ||
        (p.insurance_company?.toLowerCase().includes(q) ?? false) ||
        (p.policy_no?.toLowerCase().includes(q) ?? false);
      if (!hit) return false;
    }
    return true;
  });

  // ── Kritik / uyarı
  const critical = policies.filter((p) => p.status === "Aktif" && !isExpired(p.end_date) && daysLeft(p.end_date) <= 5);
  const warning  = policies.filter((p) => p.status === "Aktif" && !isExpired(p.end_date) && daysLeft(p.end_date) > 5 && daysLeft(p.end_date) <= 15);

  const FILTERS: FilterKey[] = ["Tümü", "Aktif", "Yaklaşan", "Geçmiş", "Pasif"];
  const filterColors: Record<FilterKey, string> = {
    Tümü:     "bg-blue-600 text-white",
    Aktif:    "bg-emerald-500 text-white",
    Yaklaşan: "bg-amber-500 text-white",
    Geçmiş:   "bg-red-500 text-white",
    Pasif:    "bg-gray-400 text-white",
  };

  return (
    <div className="space-y-5">

      {/* Başlık + Ekle */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Poliçe Takibi</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {loading ? "Yükleniyor..." : `${policies.length} poliçe`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Poliçe Ekle
        </button>
      </div>

      {/* Kritik / Uyarı bannerlar */}
      {!loading && (critical.length > 0 || warning.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up stagger-1">
          {critical.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
              <p className="text-sm text-red-700 font-medium">
                <span className="font-bold">{critical.length} poliçe</span> kritik — 5 gün veya daha az kaldı
              </p>
            </div>
          )}
          {warning.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                <span className="font-bold">{warning.length} poliçe</span> yaklaşıyor — 15 gün içinde bitiyor
              </p>
            </div>
          )}
        </div>
      )}

      {/* Arama + Filtreler */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up stagger-2">
        {/* Arama */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Müşteri, tür, şirket ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
        </div>

        {/* Filtre chipleri */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                filter === f
                  ? `${filterColors[f]} border-transparent shadow-sm`
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f}
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                filter === f ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tablo / Loading / Empty */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="typing-dot w-2 h-2 rounded-full bg-blue-400 inline-block" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-medium text-gray-500">
            {search || filter !== "Tümü" ? "Sonuç bulunamadı" : "Henüz poliçe yok"}
          </p>
          {!search && filter === "Tümü" && (
            <button
              onClick={() => setAddOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              + İlk poliçeyi ekle
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up stagger-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Müşteri</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tür</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Şirket / No</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Başlangıç / Bitiş</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kalan</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prim</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, i) => (
                  <PolicyRow
                    key={p.id}
                    policy={p}
                    index={i}
                    onSelect={setSelected}
                    onWa={setWaPolicy}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-50 bg-slate-50/50">
            <p className="text-xs text-gray-400">
              {filtered.length} kayıt gösteriliyor{filtered.length !== policies.length ? ` (toplam ${policies.length})` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <PolicyDetailModal
          policy={selected}
          agencyId={agencyId}
          onClose={() => setSelected(null)}
          onRefresh={() => { fetchPolicies(); setSelected(null); }}
        />
      )}

      {/* Add Modal */}
      {addOpen && (
        <PolicyFormModal
          mode="add"
          agencyId={agencyId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { fetchPolicies(); setToast("Poliçe başarıyla eklendi"); }}
        />
      )}

      {/* WA Modal (from table row) */}
      {waPolicy && (
        <WhatsAppModal
          customerName={waPolicy.customers?.name ?? "Müşteri"}
          phone={waPolicy.customers?.phone ?? ""}
          insuranceType={waPolicy.policy_type}
          onClose={() => setWaPolicy(null)}
          onSent={() => setToast("WhatsApp mesajı hazırlandı")}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
