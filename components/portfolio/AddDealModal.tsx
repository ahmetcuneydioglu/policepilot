"use client";

/**
 * Yeni Portföy işi — Satış Hattı'na kayıt açar (POST /api/portfolio).
 * Kişi zorunlu (ilişki akışı kişiye bağlanır); hesap opsiyonel.
 * Eşleşme yoksa Hızlı Kişi Ekle: ad + telefon + unvan → müşteri kaydı burada doğar
 * (insurance_type = seçili ürün, hesap seçiliyse account_id bağlı).
 */

import { useMemo, useState } from "react";
import { X, Search, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { canAddCustomer, limitMessage, INACTIVE_MESSAGE } from "@/lib/limits";
import { PORTFOLIO_PRODUCTS, DEAL_SOURCES, accountKindMeta, type Account } from "@/lib/portfolio";
import type { Customer } from "@/lib/database.types";

type Member = { id: string; full_name: string };

const INPUT = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1.5";

type SelectedPerson = { id: string; name: string; phone: string | null };

export default function AddDealModal({
  customers, accounts, members, managerial, selfId, agencyId, onClose, onCreated,
}: {
  customers: Customer[];
  accounts: Account[];
  members: Member[];
  managerial: boolean;
  selfId: string | null;
  agencyId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState<string>("Hayat");
  const [selected, setSelected] = useState<SelectedPerson | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  // Hızlı kişi ekleme (eşleşme yoksa)
  const [quickOpen, setQuickOpen] = useState(false);
  const [qPhone, setQPhone] = useState("");
  const [qTitle, setQTitle] = useState("");
  const [qSaving, setQSaving] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>(selfId ?? "");
  const [premium, setPremium] = useState("");
  const [source, setSource] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLocaleLowerCase("tr");
    const list = q
      ? customers.filter((c) => c.name.toLocaleLowerCase("tr").includes(q) || (c.phone ?? "").includes(q))
      : customers;
    return list.slice(0, 8);
  }, [customers, customerQuery]);

  // Hızlı kişi ekle: müşteri kaydı burada doğar, işe seçilmiş gelir
  const quickAdd = async () => {
    const nm = customerQuery.trim();
    if (!nm) return;
    if (!qPhone.trim()) { setError("Telefon girin — kişi kaydı için zorunlu."); return; }
    if (!agencyId) { setError("Bağlı acente bulunamadı."); return; }
    setQSaving(true);
    setError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lim = await canAddCustomer(supabase as any, agencyId);
    if (!lim.isActive) { setQSaving(false); setError(INACTIVE_MESSAGE); return; }
    if (!lim.ok) { setQSaving(false); setError(`${limitMessage("customer")} (${lim.current}/${lim.max})`); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase.from("customers") as any)
      .insert({
        agency_id: agencyId,
        name: nm,
        phone: qPhone.trim(),
        insurance_type: product,
        title: qTitle.trim() || null,
        account_id: accountId || null,
      })
      .select("id, name, phone")
      .single();
    setQSaving(false);
    if (err) { setError("Kişi eklenemedi: " + err.message); return; }
    setSelected(data as SelectedPerson);
    setQuickOpen(false); setQPhone(""); setQTitle("");
  };

  const save = async () => {
    if (!selected) { setError("Kişi seçin — Satış Hattı ilişki üzerinden ilerler."); return; }
    const t = title.trim() || `${selected?.name ?? "Müşteri"} — ${product}`;
    setSaving(true);
    setError("");
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        product_interest: product,
        customer_id: selected.id,
        account_id: accountId || null,
        owner_id: managerial && ownerId ? ownerId : undefined,
        expected_premium: premium.trim() ? Number(premium.replace(",", ".")) : null,
        source: source || null,
        note: note.trim() || null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(j.error ?? "Kaydedilemedi."); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Yeni İş — Satış Hattı</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm">{error}</div>}

        <div className="space-y-4">
          {/* Ürün */}
          <div>
            <label className={LABEL}>Ürün</label>
            <div className="flex flex-wrap gap-1.5">
              {PORTFOLIO_PRODUCTS.map((p) => (
                <button key={p} onClick={() => setProduct(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${product === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Kişi */}
          <div>
            <label className={LABEL}>Kişi *</label>
            {selected ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-sm font-semibold text-indigo-800">{selected.name}{selected.phone ? ` · ${selected.phone}` : ""}</span>
                <button onClick={() => { setSelected(null); setCustomerQuery(""); setQuickOpen(false); }} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">Değiştir</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setQuickOpen(false); }}
                    placeholder="Müşteri adı veya telefon ara…" className={`${INPUT} pl-9`} />
                </div>
                {customerQuery.trim() && (
                  <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50">
                    {filteredCustomers.map((c) => (
                      <button key={c.id} onClick={() => setSelected({ id: c.id, name: c.name, phone: c.phone ?? null })}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50/60 transition-colors">
                        <span className="font-medium text-slate-800">{c.name}</span>
                        {c.phone && <span className="text-slate-400 text-xs ml-2">{c.phone}</span>}
                      </button>
                    ))}
                    {/* Hızlı kişi ekle — Portföy'den çıkmadan müşteri kaydı */}
                    <button onClick={() => setQuickOpen(true)}
                      className="w-full px-3 py-2 text-left text-sm bg-indigo-50/40 hover:bg-indigo-50 transition-colors inline-flex items-center gap-2">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span className="font-semibold text-indigo-600">&quot;{customerQuery.trim()}&quot; yeni kişi olarak ekle</span>
                    </button>
                  </div>
                )}
                {quickOpen && customerQuery.trim() && (
                  <div className="mt-2 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={qPhone} onChange={(e) => setQPhone(e.target.value)} placeholder="Telefon *" inputMode="tel" className={INPUT} />
                      <input value={qTitle} onChange={(e) => setQTitle(e.target.value)} placeholder="Unvan (Başhekim…)" className={INPUT} />
                    </div>
                    <button onClick={quickAdd} disabled={qSaving}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60">
                      {qSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Kişiyi Ekle ve Seç
                    </button>
                    <p className="text-[10px] text-indigo-400">
                      Müşteri kaydı oluşturulur (tür: {product}{accountId ? ", hesaba bağlı" : ""}) ve bu işe seçilir.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hesap (opsiyonel) */}
          <div>
            <label className={LABEL}>Bağlı Hesap (opsiyonel — hastane, fabrika, şirket)</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={INPUT}>
              <option value="">Hesap yok / bireysel</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{accountKindMeta(a.kind).emoji} {a.name}</option>
              ))}
            </select>
          </div>

          {/* Başlık + prim */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>İş Başlığı</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={selected ? `${selected.name} — ${product}` : "Örn: Dr. Kaya — Hayat"} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Beklenen Prim (₺)</label>
              <input value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="25000" inputMode="decimal" className={INPUT} />
            </div>
          </div>

          {/* Kaynak */}
          <div>
            <label className={LABEL}>Kaynak</label>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_SOURCES.map((s) => (
                <button key={s} onClick={() => setSource(source === s ? "" : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${source === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Sorumlu (yönetici) */}
          {managerial && members.length > 0 && (
            <div>
              <label className={LABEL}>Sorumlu Personel</label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={INPUT}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}

          {/* Not */}
          <div>
            <label className={LABEL}>Not</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="İlk izlenim, tanışma bağlamı…" className={`${INPUT} resize-none`} />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} İşi Aç
          </button>
        </div>
      </div>
    </div>
  );
}
