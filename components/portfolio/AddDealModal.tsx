"use client";

/**
 * Yeni Portföy işi — Satış Hattı'na kayıt açar (POST /api/portfolio).
 * Kişi zorunlu (ilişki akışı kişiye bağlanır); hesap opsiyonel.
 */

import { useMemo, useState } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { PORTFOLIO_PRODUCTS, DEAL_SOURCES, accountKindMeta, type Account } from "@/lib/portfolio";
import type { Customer } from "@/lib/database.types";

type Member = { id: string; full_name: string };

const INPUT = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1.5";

export default function AddDealModal({
  customers, accounts, members, managerial, selfId, onClose, onCreated,
}: {
  customers: Customer[];
  accounts: Account[];
  members: Member[];
  managerial: boolean;
  selfId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState<string>("Hayat");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerQuery, setCustomerQuery] = useState("");
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

  const selected = customers.find((c) => c.id === customerId) ?? null;

  const save = async () => {
    if (!customerId) { setError("Kişi seçin — Satış Hattı ilişki üzerinden ilerler."); return; }
    const t = title.trim() || `${selected?.name ?? "Müşteri"} — ${product}`;
    setSaving(true);
    setError("");
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        product_interest: product,
        customer_id: customerId,
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
                <button onClick={() => { setCustomerId(""); setCustomerQuery(""); }} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">Değiştir</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Müşteri adı veya telefon ara…" className={`${INPUT} pl-9`} />
                </div>
                {customerQuery.trim() && (
                  <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50">
                    {filteredCustomers.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-slate-400">Eşleşen müşteri yok — önce Müşteriler&apos;den ekleyin.</p>
                    ) : filteredCustomers.map((c) => (
                      <button key={c.id} onClick={() => setCustomerId(c.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50/60 transition-colors">
                        <span className="font-medium text-slate-800">{c.name}</span>
                        {c.phone && <span className="text-slate-400 text-xs ml-2">{c.phone}</span>}
                      </button>
                    ))}
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
