"use client";

/**
 * Şirket Bilgileri — acentenin profil kartı (görüntüle / inline düzenle).
 * GET/PATCH /api/agency/profile. Düzenleme yalnız settings.manage yetkisiyle.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Building2, Pencil, X, Globe, Phone, Mail, MapPin, Hash, Check } from "lucide-react";

type Agency = {
  id: string; name: string; slug: string;
  phone: string | null; email: string | null; website: string | null;
  logo_url: string | null; primary_color: string | null;
  tax_no: string | null; address: string | null; city: string | null;
  plan: string; is_active: boolean;
};

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-white transition";
const LABEL = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

export default function CompanyProfile() {
  const { can } = useAuth();
  const canEdit = can("settings.manage");
  const [agency, setAgency]   = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<Agency>>({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agency/profile");
      const json = await res.json();
      if (res.ok) setAgency(json.agency);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    if (!agency) return;
    setForm({ ...agency });
    setMsg(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/agency/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, phone: form.phone, email: form.email, website: form.website,
          tax_no: form.tax_no, address: form.address, city: form.city, primary_color: form.primary_color,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Şirket bilgileri güncellendi ✓" });
      setEditing(false);
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />;
  if (!agency) return <div className="px-4 py-8 text-center text-sm text-slate-400">Acente bilgisi alınamadı.</div>;

  const color = agency.primary_color ?? "#4f46e5";
  const initials = agency.name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Üst kart: logo + ad + plan */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="h-20" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }} />
        <div className="px-6 pb-5 -mt-9">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-end gap-3">
              {agency.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency.logo_url} alt={agency.name} className="w-18 h-18 w-[72px] h-[72px] rounded-2xl object-cover border-4 border-white shadow-md bg-white" />
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl border-4 border-white shadow-md flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: color }}>
                  {initials}
                </div>
              )}
              <div className="pb-1">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{agency.name}</h2>
                <p className="text-xs text-slate-400 font-mono">/a/{agency.slug}</p>
              </div>
            </div>
            {canEdit && !editing && (
              <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">
                <Pencil className="w-3.5 h-3.5" /> Düzenle
              </button>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <p className={`text-xs rounded-xl px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>
      )}

      {/* Detay / Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">Şirket Profili</p>
        </div>

        {editing ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LABEL}>Şirket Adı *</label>
                <input className={INPUT} value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Vergi No</label>
                <input className={INPUT} value={form.tax_no ?? ""} onChange={(e) => setForm((f) => ({ ...f, tax_no: e.target.value }))} placeholder="1234567890" />
              </div>
              <div>
                <label className={LABEL}>Telefon</label>
                <input className={INPUT} value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0532 123 45 67" />
              </div>
              <div>
                <label className={LABEL}>E-posta</label>
                <input className={INPUT} value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="info@acente.com" />
              </div>
              <div>
                <label className={LABEL}>Web Sitesi</label>
                <input className={INPUT} value={form.website ?? ""} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="www.acente.com" />
              </div>
              <div>
                <label className={LABEL}>Şehir</label>
                <input className={INPUT} value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="İstanbul" />
              </div>
              <div>
                <label className={LABEL}>Marka Rengi</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color ?? "#4f46e5"} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white" />
                  <input className={INPUT} value={form.primary_color ?? ""} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} placeholder="#4f46e5" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Adres</label>
                <textarea className={`${INPUT} resize-none`} rows={2} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Mahalle, cadde, no, ilçe" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => { setEditing(false); setMsg(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">
                <X className="w-3.5 h-3.5" /> Vazgeç
              </button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <InfoRow Icon={Hash}  label="Vergi No"  value={agency.tax_no} />
            <InfoRow Icon={Phone} label="Telefon"   value={agency.phone} />
            <InfoRow Icon={Mail}  label="E-posta"   value={agency.email} />
            <InfoRow Icon={Globe} label="Web Sitesi" value={agency.website} />
            <InfoRow Icon={MapPin} label="Adres"    value={[agency.address, agency.city].filter(Boolean).join(", ") || null} />
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="text-[11px] text-slate-400 px-1">Şirket bilgilerini yalnız acente sahibi/yöneticisi düzenleyebilir.</p>
      )}
    </div>
  );
}

function InfoRow({ Icon, label, value }: { Icon: typeof Hash; label: string; value: string | null }) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-3">
      <Icon className="w-4 h-4 text-slate-300 flex-shrink-0" />
      <span className="text-xs font-semibold text-slate-400 w-24 flex-shrink-0">{label}</span>
      <span className={`text-sm ${value ? "text-slate-700" : "text-slate-300"}`}>{value ?? "Belirtilmemiş"}</span>
    </div>
  );
}
