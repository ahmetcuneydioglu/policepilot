"use client";

/**
 * Satış Hattı iş detayı — sağdan kayar drawer.
 * Aşama değişimi, Kaybedildi çıkışı (nedenli), sorumlu ataması, son görüşmeler
 * (deal'e bağlı customer_interactions — İlişki omurgası TEK kaynak).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Phone, User, Building2, Loader2, MessageSquare, XCircle, Undo2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";
import { channelMeta, outcomeMeta, type Interaction } from "@/lib/interactionTypes";
import {
  DEAL_STAGES, dealStageOf, LOST_REASONS, lostReasonLabel, accountKindMeta,
  daysSinceTouch, STALE_WARN_DAYS, STALE_DANGER_DAYS, type Deal,
} from "@/lib/portfolio";

type Member = { id: string; full_name: string };

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

export default function DealDrawer({
  deal, members, managerial, onClose, onChanged,
}: {
  deal: Deal;
  members: Member[];
  managerial: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [feed, setFeed] = useState<Interaction[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => { setShow(true); }, []);

  // Deal'e bağlı görüşmeler (RLS scope'lu client sorgusu)
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("customer_interactions") as any)
      .select("*")
      .eq("deal_id", deal.id)
      .order("occurred_at", { ascending: false })
      .limit(20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (!alive) return;
        setFeed((data ?? []) as Interaction[]);
        setFeedLoading(false);
      });
    return () => { alive = false; };
  }, [deal.id]);

  const close = () => { setShow(false); setTimeout(onClose, 200); };

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/portfolio/${deal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onChanged();
  };

  const stale = daysSinceTouch(deal);
  const cust = deal.customers;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <div className={`relative h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col transition-transform duration-200 ${show ? "translate-x-0" : "translate-x-full"}`}>

        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{deal.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dealStageOf(deal.stage).badge}`}>{dealStageOf(deal.stage).label}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{deal.product_interest}</span>
              {deal.expected_premium != null && <span className="text-[11px] text-slate-400">{fmtMoney(deal.expected_premium)}</span>}
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Kayıp banner */}
          {deal.status === "lost" && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-100">
              <p className="text-sm text-rose-700 font-semibold">Kaybedildi{deal.lost_reason ? ` · ${lostReasonLabel(deal.lost_reason)}` : ""}</p>
              <button onClick={() => patch({ status: "open" })} disabled={saving}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-rose-600 text-xs font-bold hover:bg-rose-100 transition-colors">
                <Undo2 className="w-3.5 h-3.5" /> Geri Aç
              </button>
            </div>
          )}

          {/* Bayat iş uyarısı */}
          {deal.status === "open" && stale >= STALE_WARN_DAYS && (
            <div className={`px-4 py-3 rounded-2xl border text-sm font-medium ${stale >= STALE_DANGER_DAYS ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
              ⏳ Son temastan bu yana <b>{stale} gün</b> geçti — müşteri bekliyor olabilir.
            </div>
          )}

          {/* Kişi & hesap */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">İlişki</p>
            {cust ? (
              <Link href={`/customers/${cust.id}`} className="flex items-center gap-3 text-sm group">
                <User className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-slate-700 font-medium group-hover:text-indigo-600 group-hover:underline truncate">
                  {cust.name}{cust.title ? ` · ${cust.title}` : ""}
                </span>
              </Link>
            ) : (
              <p className="text-sm text-slate-300">Kişi bağlanmamış</p>
            )}
            {deal.accounts && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-slate-600 truncate">{accountKindMeta(deal.accounts.kind).emoji} {deal.accounts.name}</span>
              </div>
            )}
            {cust?.phone && (
              <div className="flex items-center gap-2 pt-1">
                <a href={`tel:${cust.phone}`} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> Ara
                </a>
                <a href={`https://wa.me/${cust.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            )}
          </section>

          {/* Aşama */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Aşama</p>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_STAGES.map((s) => (
                <button key={s.key} onClick={() => deal.stage !== s.key && patch({ stage: s.key })} disabled={saving || deal.status === "lost"}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${deal.stage === s.key ? s.badge + " ring-2 ring-offset-1 ring-slate-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            {deal.stage === "policelesti" && deal.status === "open" && (
              <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                🎉 Kapanış: poliçeyi {cust ? <Link href={`/customers/${cust.id}`} className="font-semibold underline">müşteri kartından</Link> : "Poliçeler'den"} ekleyin; prim takibi poliçe detayında.
              </p>
            )}

            {/* Kaybedildi çıkışı */}
            {deal.status === "open" && (
              lostOpen ? (
                <div className="mt-3 p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                  <p className="text-xs font-bold text-rose-600 mb-2">Kayıp nedeni?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LOST_REASONS.map((r) => (
                      <button key={r.key} onClick={() => { setLostOpen(false); patch({ status: "lost", lost_reason: r.key }); }}
                        className="px-2.5 py-1.5 rounded-lg bg-white text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors border border-rose-100">
                        {r.label}
                      </button>
                    ))}
                    <button onClick={() => setLostOpen(false)} className="px-2.5 py-1.5 rounded-lg text-slate-400 text-xs font-semibold hover:bg-slate-100">Vazgeç</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setLostOpen(true)} disabled={saving}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-rose-50 hover:text-rose-600 transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Kaybedildi olarak kapat
                </button>
              )
            )}
          </section>

          {/* Sorumlu */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"><User className="w-3 h-3" /> Sorumlu Personel</label>
            {managerial ? (
              <select value={deal.owner_id ?? ""} onChange={(e) => e.target.value && patch({ owner_id: e.target.value })} disabled={saving}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Atanmadı</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            ) : (
              <p className="text-sm text-slate-700 font-medium">{deal.owner_name ?? "Atanmadı"}</p>
            )}
          </section>

          {/* Son görüşmeler (İlişki omurgası) */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bu İşin Görüşmeleri</p>
              {cust && (
                <Link href={`/customers/${cust.id}`} className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700">
                  + Görüşme Ekle
                </Link>
              )}
            </div>
            {feedLoading ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
            ) : feed.length === 0 ? (
              <p className="text-xs text-slate-400">Bu işe bağlı görüşme yok. Görüşmeyi müşteri kartından ekleyip bu işe bağlayabilirsiniz.</p>
            ) : (
              <div className="space-y-3">
                {feed.map((it) => {
                  const ch = channelMeta(it.channel);
                  const oc = outcomeMeta(it.outcome);
                  return (
                    <div key={it.id} className="flex gap-2.5">
                      <span className="text-base leading-none mt-0.5">{ch.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{ch.label}</span>
                          {it.staff_name ? ` · ${it.staff_name}` : ""}
                          {oc ? ` · ${oc.label}` : ""}
                        </p>
                        {it.note && <p className="text-xs text-slate-500 truncate">{it.note}</p>}
                        <p className="text-[10px] text-slate-400">{relTime(it.occurred_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-[10px] text-slate-300 text-center pb-2">
            Açılış {new Date(deal.created_at).toLocaleDateString("tr-TR")}{deal.source ? ` · Kaynak: ${deal.source}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
