"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withScopeFilter } from "@/lib/tenant";
import type { Policy, PolicyStatus, Customer } from "@/lib/database.types";
import WhatsAppModal from "@/components/WhatsAppModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type PolicyWithCustomer = Policy & {
  customers:  { name: string; phone: string } | null;
  quote_runs?: { product_data: Record<string, string> } | null;
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
  if (status === "Yenilendi") return { label: "✅ Yenilendi", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
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

  // Akıllı otomatik doldurma: seçilen müşteri + son poliçesi
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [lastPolicy,   setLastPolicy]   = useState<{
    policy_type: string; insurance_company: string | null;
    end_date: string;    policy_no: string | null;
  } | null>(null);
  const [autoToast, setAutoToast] = useState("");

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
    setSelectedCust(null);
    setLastPolicy(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(v), 250);
  }

  // Son poliçeyi bul ve formu doldur.
  // Öncelik: 1) Aktif poliçe  2) En yeni bitişli  3) Son oluşturulan
  async function copyLastPolicy(customerId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("policies") as any)
      .select("policy_type, insurance_company, premium, commission, policy_no, status, end_date, created_at")
      .eq("customer_id", customerId)
      .order("end_date",   { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (agencyId) q = q.eq("agency_id", agencyId);
    const { data } = await q;

    type Row = {
      policy_type: string; insurance_company: string | null;
      premium: number | null; commission: number | null;
      policy_no: string | null; status: string; end_date: string;
    };
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return;

    const src = rows.find(r => r.status === "Aktif") ?? rows[0];

    // Tarihler HARİÇ kopyala — kullanıcı her alanı değiştirebilir
    setForm(prev => ({
      ...prev,
      policy_type:       src.policy_type,
      insurance_company: src.insurance_company ?? "",
      premium:           src.premium    != null ? String(src.premium)    : "",
      commission:        src.commission != null ? String(src.commission) : "",
      policy_no:         src.policy_no ?? "",
    }));
    setLastPolicy({
      policy_type:       src.policy_type,
      insurance_company: src.insurance_company,
      end_date:          src.end_date,
      policy_no:         src.policy_no,
    });
    setAutoToast("Son poliçe bilgileri kopyalandı");
  }

  function selectCustomer(c: Customer) {
    setCustSearch(c.name);
    setCustResults([]);
    setCustDropOpen(false);
    setSelectedCust(c);

    // Yeni poliçe: başlangıç = bugün, bitiş = bugün + 365 gün
    const today = new Date();
    const end   = new Date(today);
    end.setDate(end.getDate() + 365);

    setForm(prev => ({
      ...prev,
      customer_id: c.id,
      ...(mode === "add" ? {
        start_date: today.toISOString().slice(0, 10),
        end_date:   end.toISOString().slice(0, 10),
      } : {}),
    }));
    setAutoToast("Müşteri bilgileri yüklendi");

    // Son poliçe kopyalama yalnız yeni poliçede — düzenlemede formu ezmesin
    if (mode === "add") copyLastPolicy(c.id);
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
            {form.customer_id && !selectedCust && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Müşteri seçildi</span>
              </div>
            )}
          </div>

          {/* Müşteri bilgi kartı — doğru müşteriyi seçtiğini hissettir */}
          {selectedCust && (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4 animate-fade-in-up">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                  {selectedCust.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">👤 {selectedCust.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {selectedCust.phone && (
                      <span className="text-xs text-slate-500">📞 {selectedCust.phone}</span>
                    )}
                    {selectedCust.insurance_type && (
                      <span className="text-xs text-slate-500">🛡️ {selectedCust.insurance_type}</span>
                    )}
                  </div>
                  {lastPolicy ? (
                    <div className="mt-2 pt-2 border-t border-emerald-200/60 flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="text-xs text-slate-600">
                        <span className="text-slate-400">Son Poliçe:</span>{" "}
                        <b>{lastPolicy.policy_type}{lastPolicy.insurance_company ? ` - ${lastPolicy.insurance_company}` : ""}</b>
                      </span>
                      <span className="text-xs text-slate-600">
                        <span className="text-slate-400">Bitiş:</span>{" "}
                        <b>{new Date(lastPolicy.end_date).toLocaleDateString("tr-TR")}</b>
                      </span>
                    </div>
                  ) : mode === "add" && (
                    <p className="mt-2 pt-2 border-t border-emerald-200/60 text-xs text-slate-400">
                      Kayıtlı poliçesi yok — ilk poliçesi oluşturulacak
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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

      {/* Otomatik doldurma bildirimi */}
      {autoToast && <Toast key={autoToast} message={autoToast} onDone={() => setAutoToast("")} />}
    </div>
  );
}

// ─── Source helpers ───────────────────────────────────────────────────────────
function sourceInfo(src: string | null | undefined): { label: string; cls: string; icon: string } {
  switch (src) {
    case "demo":    return { label: "Demo",         cls: "bg-amber-100 text-amber-700 border-amber-300",   icon: "🎭" };
    case "manual":  return { label: "Manuel",       cls: "bg-blue-100 text-blue-700 border-blue-300",      icon: "📋" };
    case "api":     return { label: "API",          cls: "bg-violet-100 text-violet-700 border-violet-300", icon: "🔗" };
    case "robot":   return { label: "Robot",        cls: "bg-indigo-100 text-indigo-700 border-indigo-300", icon: "🤖" };
    case "gateway": return { label: "InsurGateway", cls: "bg-teal-100 text-teal-700 border-teal-300",      icon: "🌐" };
    default:        return { label: "Manuel",       cls: "bg-blue-100 text-blue-700 border-blue-300",      icon: "📋" };
  }
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
  const [vehicleData, setVehicleData] = useState<Record<string, string> | null>(null);

  // Araç verisini lazy fetch — sadece quote_run_id varsa
  useEffect(() => {
    if (!policy.quote_run_id) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("quote_runs") as any)
        .select("product_data")
        .eq("id", policy.quote_run_id)
        .single();
      if (data?.product_data) setVehicleData(data.product_data);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy.quote_run_id]);

  const isDemo   = policy.source === "demo"   || (policy.policy_no?.startsWith("DEMO-") ?? false);
  const src      = sourceInfo(policy.source);
  const badge    = expiryBadge(policy.end_date, policy.status);
  const days     = policy.status === "Aktif" && !isExpired(policy.end_date) ? daysLeft(policy.end_date) : 0;
  const expired  = isExpired(policy.end_date);

  const pd = vehicleData ?? {};
  const hasVehicle = !!(pd.plaka || pd.marka || pd.model);

  // renewal ring colour
  const ringCls = days <= 5 ? "text-red-500 stroke-red-500" : days <= 15 ? "text-amber-500 stroke-amber-500" : days <= 30 ? "text-yellow-500 stroke-yellow-500" : "text-emerald-500 stroke-emerald-500";

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

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const printContent = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#1e293b">
      ${isDemo ? `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-weight:700;color:#92400e;font-size:13px">⚠️ DEMO POLİÇE — Gerçek poliçe değildir, hukuki geçerliliği yoktur</div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:24px">
        <div><h1 style="margin:0;font-size:22px;font-weight:800">PoliçePilot</h1><p style="margin:4px 0 0;font-size:12px;color:#64748b">Sigorta CRM Sistemi</p></div>
        <p style="font-size:11px;color:#94a3b8;margin:0">${new Date().toLocaleDateString("tr-TR")}</p>
      </div>
      <h2 style="margin:0 0 16px;font-size:16px">Poliçe Özeti</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        ${[
          ["Poliçe Numarası", policy.policy_no ?? "—"],
          ["Sigorta Şirketi", policy.insurance_company ?? "—"],
          ["Poliçe Türü", policy.policy_type],
          ["Prim", policy.premium != null ? `₺${policy.premium.toLocaleString("tr-TR")}` : "—"],
          ["Başlangıç", fmtDate(policy.start_date)],
          ["Bitiş", fmtDate(policy.end_date)],
          ["Durum", policy.status],
        ].map(([k, v]) => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 16px 8px 0;font-weight:600;color:#64748b;width:160px">${k}</td><td style="padding:8px 0">${v}</td></tr>`).join("")}
      </table>
      ${policy.customers ? `<h3 style="font-size:14px;margin:0 0 10px">Sigortalı</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        ${[["Ad Soyad", policy.customers.name], ...(policy.customers.phone ? [["Telefon", policy.customers.phone]] : [])].map(([k,v]) => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 16px 8px 0;font-weight:600;color:#64748b;width:160px">${k}</td><td>${v}</td></tr>`).join("")}
      </table>` : ""}
      ${hasVehicle ? `<h3 style="font-size:14px;margin:0 0 10px">Araç</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        ${[["Plaka", pd.plaka], ["Marka", pd.marka], ["Model", pd.model], ["Yıl", pd.yil], ["Ruhsat Seri", pd.belge_seri]].filter(([,v]) => v).map(([k,v]) => `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 16px 8px 0;font-weight:600;color:#64748b;width:160px">${k}</td><td style="font-family:monospace">${v}</td></tr>`).join("")}
      </table>` : ""}
      <p style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;text-align:center">PoliçePilot Sigorta CRM • Otomatik oluşturulmuştur</p>
    </div>
  `;

  function handlePrint() {
    const w = window.open("", "_blank", "width=700,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Poliçe Özeti</title></head><body>${printContent}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-fade-in-up overflow-hidden">

          {/* Demo banner */}
          {isDemo && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center text-xs font-bold px-4 py-2.5 flex items-center justify-center gap-2 flex-shrink-0">
              <span>⚠️</span>
              <span>DEMO POLİÇE — Gerçek poliçe değildir, hukuki geçerliliği yoktur</span>
            </div>
          )}

          {/* Yenilendi banner — bu poliçe yeni bir poliçeyle yenilendi */}
          {(policy.renewal_status === "completed" || policy.status === "Yenilendi") && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2.5 flex items-center justify-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                ✅ Yenilendi
              </span>
              <span className="text-[11px] text-white/85">
                — Bu poliçe {policy.renewed_at ? `${new Date(policy.renewed_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })} tarihinde ` : ""}yeni bir poliçe ile yenilenmiştir.
              </span>
            </div>
          )}

          {/* Header */}
          <div className={`px-6 py-5 flex-shrink-0 ${isDemo
            ? "bg-gradient-to-r from-amber-600 to-orange-600"
            : "bg-gradient-to-r from-indigo-600 to-violet-600"}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-2xl shadow-inner">
                  {policy.policy_type === "Kasko" ? "🚗" : policy.policy_type === "Trafik" ? "🛣️" : policy.policy_type === "Konut" ? "🏠" : policy.policy_type === "Sağlık" ? "❤️" : policy.policy_type === "DASK" ? "🌍" : "🛡️"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white text-base">{policy.policy_type}</h2>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${src.cls}`}>
                      {src.icon} {src.label}
                    </span>
                  </div>
                  <p className="text-white/70 text-xs mt-0.5">{policy.customers?.name ?? "—"}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Renewal countdown */}
            <div className="mt-4 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {badge.label}
              </span>
              {!expired && policy.status === "Aktif" && days <= 30 && (
                <span className="text-white/80 text-xs">⏰ Yenileme zamanı yaklaşıyor</span>
              )}
              {!expired && policy.status === "Aktif" && days > 30 && (
                <span className="text-white/60 text-xs">{fmtDate(policy.end_date)}&apos;de bitiyor</span>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* Kalan gün kartı — sadece aktif + yaklaşan */}
            {policy.status === "Aktif" && !expired && days <= 30 && (
              <div className={`rounded-2xl p-4 flex items-center gap-4 border-2 ${
                days <= 5  ? "bg-red-50 border-red-200" :
                days <= 15 ? "bg-amber-50 border-amber-200" :
                             "bg-yellow-50 border-yellow-200"
              }`}>
                <div className={`flex-shrink-0 w-14 h-14 rounded-full border-4 flex flex-col items-center justify-center ${ringCls} border-current`}>
                  <span className={`text-xl font-black leading-none ${ringCls.split(" ")[0]}`}>{days}</span>
                  <span className={`text-[9px] font-bold uppercase ${ringCls.split(" ")[0]}`}>gün</span>
                </div>
                <div>
                  <p className={`font-bold text-sm ${days <= 5 ? "text-red-700" : days <= 15 ? "text-amber-700" : "text-yellow-700"}`}>
                    {days <= 5 ? "Kritik — çok yakında bitiyor!" : days <= 15 ? "Yakında bitiyor" : "Yenileme zamanı yaklaşıyor"}
                  </p>
                  <p className={`text-xs mt-0.5 ${days <= 5 ? "text-red-600" : days <= 15 ? "text-amber-600" : "text-yellow-600"}`}>
                    Bitiş: {fmtDate(policy.end_date)}
                  </p>
                </div>
              </div>
            )}

            {/* ─── Poliçe bilgileri ─── */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Poliçe Bilgileri</span>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  ["Durum", <span key="st" className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${policy.status === "Aktif" ? "bg-emerald-100 text-emerald-700" : policy.status === "Yenilendi" ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"}`}>{policy.status === "Yenilendi" ? "✅ Yenilendi" : policy.status}</span>],
                  ["Başlangıç", fmtDate(policy.start_date)],
                  ["Bitiş",     fmtDate(policy.end_date)],
                  policy.premium    != null ? ["Prim",      `₺${policy.premium.toLocaleString("tr-TR")}`]    : null,
                  policy.commission != null ? ["Komisyon",  `₺${policy.commission.toLocaleString("tr-TR")}`] : null,
                  policy.insurance_company  ? ["Şirket",   policy.insurance_company] : null,
                  policy.policy_no          ? ["Poliçe No", <span key="pno" className="font-mono text-sm font-semibold">{policy.policy_no}</span>] : null,
                  policy.issued_at          ? ["Kesim Tarihi", fmtDate(policy.issued_at)] : null,
                ].filter(Boolean).map((row) => {
                  const [k, v] = row as [string, React.ReactNode];
                  return (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-400 font-medium w-28 shrink-0">{k}</span>
                      <span className="text-sm text-slate-800 font-medium text-right">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Müşteri ─── */}
            {policy.customers && (
              <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Müşteri</span>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                    {policy.customers.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{policy.customers.name}</p>
                    {policy.customers.phone && (
                      <a href={`tel:${policy.customers.phone}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        📞 {policy.customers.phone}
                      </a>
                    )}
                  </div>
                  {policy.customers.phone && (
                    <a
                      href={`https://wa.me/${policy.customers.phone.replace(/\D/g, "").replace(/^0/, "90")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/25"
                    >
                      {WA_SVG}
                      WA
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ─── Araç Bilgileri ─── */}
            {hasVehicle && (
              <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H4a2 2 0 01-2-2V6a2 2 0 012-2h9.5L17 9.5V14a2 2 0 01-2 2h-1m-6 4a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Araç Bilgileri</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {[
                    ["Plaka",       pd.plaka,       true],
                    ["Marka",       pd.marka,       false],
                    ["Model",       pd.model,       false],
                    ["Model Yılı",  pd.yil,         false],
                    ["Ruhsat Seri", pd.belge_seri,  true],
                  ].filter(([,v]) => v).map(([k, v, mono]) => (
                    <div key={k as string} className="bg-white rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{k as string}</p>
                      <p className={`font-bold text-slate-800 truncate ${mono ? "font-mono text-sm" : "text-sm"}`}>{v as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Notlar ─── */}
            {policy.note && (
              <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notlar</span>
                </div>
                <p className="text-sm text-slate-700 p-4 leading-relaxed">{policy.note}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 space-y-2 bg-white">

            {/* WhatsApp Hatırlatma — belirgin */}
            <button
              onClick={() => setWaOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-sm font-bold transition-all shadow-md shadow-emerald-500/20"
            >
              {WA_SVG}
              WhatsApp Hatırlatma Oluştur
            </button>

            {/* Poliçe dosyası */}
            {policy.document_path && (
              <button
                onClick={async () => {
                  const res  = await fetch(`/api/policy-documents?policy_id=${policy.id}`);
                  const json = await res.json();
                  if (res.ok && json.url) window.open(json.url, "_blank");
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 border border-blue-100 transition-all"
              >
                📄 Poliçe Dosyasını Görüntüle{policy.document_name ? ` (${policy.document_name})` : ""}
              </button>
            )}

            {/* Yazdır + Düzenle */}
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all border border-slate-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect width="12" height="8" x="6" y="14"/>
                </svg>
                Yazdır / PDF
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 border border-indigo-100 transition-all"
              >
                ✏️ Düzenle
              </button>
            </div>

            {/* Aktif/Pasif toggle — yenilenmiş poliçe geri açılamaz */}
            {policy.status !== "Yenilendi" && (
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
            )}
          </div>
        </div>
      </div>

      {waOpen && (
        <WhatsAppModal
          customerName={policy.customers?.name ?? "Müşteri"}
          phone={policy.customers?.phone ?? ""}
          insuranceType={policy.policy_type}
          onClose={() => setWaOpen(false)}
          onSent={() => setToast("WhatsApp hatırlatması hazırlandı")}
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
  const { role, agencyId, profile, can } = useAuth();
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
    // Kapsam: owner/manager acente; satış/operasyon/görüntüleyici yalnız kendi
    q = withScopeFilter(q, role, agencyId, profile?.id, profile?.agency_role);
    const { data, error } = await q;
    if (error) console.error("[policies] fetch error:", error.message);
    setPolicies((data ?? []) as PolicyWithCustomer[]);
    setLoading(false);
  }, [role, agencyId, profile?.id, profile?.agency_role]);

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
        {can("policy.create") && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Poliçe Ekle
          </button>
        )}
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
          {!search && filter === "Tümü" && can("policy.create") && (
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
