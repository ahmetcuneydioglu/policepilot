"use client";

/**
 * Satış Fırsatı detay drawer'ı — sağdan kayar.
 * Müşteri bilgileri, sorumlu personel (değiştirilebilir), aşama, takip tarihi,
 * notlar, aktivite/durum geçmişi (activity_log). Kazanıldı'da "Poliçeye Dönüştür".
 */

import { useEffect, useState, useCallback } from "react";
import {
  X, Phone, Mail, IdCard, Tag, User, Calendar, Loader2, MessageSquare, ArrowRight, Clock,
} from "lucide-react";
import { STAGES, stageOf } from "@/lib/opportunities";
import { fmtMoney } from "@/lib/format";
import type { RequestStatus } from "@/lib/database.types";

type Member = { id: string; full_name: string };
type Detail = {
  id: string; customer_id: string; request_type: string; status: RequestStatus;
  price_offer: number | null; created_at: string; updated_at: string | null;
  assigned_to: string | null; assigned_name: string | null;
  next_follow_up_date: string | null; notes: string | null; policy_id: string | null;
  customers: { name: string; phone: string | null; email: string | null; identity_no: string | null; insurance_type: string | null } | null;
};
type ActivityRow = { id: string; action: string; summary: string | null; actor_name: string | null; created_at: string };

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

/* Tek tık takip görevi — fırsattan göreve köprü (Sprint 4) */
function TaskFromOpportunity({ detail }: { detail: Detail }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const create = async () => {
    setState("saving");
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${detail.customers?.name ?? "Müşteri"} — ${detail.request_type} takibi`,
        customer_id: detail.customer_id,
        request_id: detail.id,
        due_date: detail.next_follow_up_date ?? new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      }),
    });
    setState(res.ok ? "done" : "idle");
  };
  return (
    <button onClick={create} disabled={state !== "idle"}
      className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${state === "done" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-60"}`}>
      {state === "done" ? "✓ Takip görevi oluşturuldu" : state === "saving" ? "Oluşturuluyor…" : "+ Takip görevi oluştur"}
    </button>
  );
}

export default function OpportunityDrawer({
  id, members, managerial, onClose, onChanged, onConvert,
}: {
  id: string;
  members: Member[];
  managerial: boolean;
  onClose: () => void;
  onChanged: () => void;
  onConvert: (d: Detail) => void;
}) {
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests/${id}`);
    const json = await res.json();
    if (res.ok) {
      setDetail(json.opportunity);
      setActivity(json.activity ?? []);
      setNoteDraft(json.opportunity?.notes ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { setShow(true); load(); }, [load]);

  const close = () => { setShow(false); setTimeout(onClose, 200); };

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch(`/api/requests/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { await load(); onChanged(); }
  };

  const cust = detail?.customers;
  const infoRows: { Icon: typeof Phone; label: string; value: string | null; href?: string }[] = [
    { Icon: Phone, label: "Telefon", value: cust?.phone ?? null, href: cust?.phone ? `https://wa.me/${cust.phone.replace(/\D/g, "")}` : undefined },
    { Icon: Mail, label: "E-posta", value: cust?.email ?? null },
    { Icon: IdCard, label: "TC Kimlik", value: cust?.identity_no ?? null },
    { Icon: Tag, label: "Sigorta Türü", value: detail?.request_type ?? null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <div className={`relative h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col transition-transform duration-200 ${show ? "translate-x-0" : "translate-x-full"}`}>
        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {(cust?.name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{cust?.name ?? "Müşteri"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stageOf(detail.status).badge}`}>{detail.status}</span>
                    {detail.price_offer != null && <span className="text-[11px] text-slate-400">{fmtMoney(detail.price_offer)}</span>}
                  </div>
                </div>
              </div>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Müşteri bilgileri */}
              <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Müşteri Bilgileri</p>
                <div className="space-y-2.5">
                  {infoRows.map((r) => (
                    <div key={r.label} className="flex items-center gap-3 text-sm">
                      <r.Icon className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <span className="text-slate-400 w-24 flex-shrink-0">{r.label}</span>
                      {r.value ? (
                        r.href ? <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:underline truncate">{r.value}</a>
                               : <span className="text-slate-700 font-medium truncate">{r.value}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </div>
                  ))}
                </div>
                {cust?.phone && (
                  <a href={`https://wa.me/${cust.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors">
                    <MessageSquare className="w-4 h-4" /> WhatsApp ile yaz
                  </a>
                )}
              </section>

              {/* Aşama */}
              <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Satış Aşaması</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => (
                    <button key={s.key} onClick={() => detail.status !== s.key && patch({ status: s.key })} disabled={saving}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 ${detail.status === s.key ? s.badge + " ring-2 ring-offset-1 ring-slate-200" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}>
                      {s.key}
                    </button>
                  ))}
                </div>
                {detail.status === "Kazanıldı" && (
                  <button onClick={() => onConvert(detail)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                    Poliçeye Dönüştür <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </section>

              {/* Sorumlu personel + takip tarihi */}
              <section className="bg-white rounded-2xl border border-slate-200/70 p-4 space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"><User className="w-3 h-3" /> Sorumlu Personel</label>
                  {managerial ? (
                    <select value={detail.assigned_to ?? ""} onChange={(e) => patch({ assigned_to: e.target.value })} disabled={saving}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Atanmadı</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-700 font-medium">{detail.assigned_name ?? "Atanmadı"}</p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5"><Calendar className="w-3 h-3" /> Sonraki Takip Tarihi</label>
                  <input type="date" value={detail.next_follow_up_date ?? ""} onChange={(e) => patch({ next_follow_up_date: e.target.value })} disabled={saving}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <TaskFromOpportunity detail={detail} />
              </section>

              {/* Notlar */}
              <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notlar</p>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder="Görüşme notları, müşteri tercihleri…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                {noteDraft !== (detail.notes ?? "") && (
                  <button onClick={() => patch({ notes: noteDraft })} disabled={saving}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? "Kaydediliyor…" : "Notu Kaydet"}
                  </button>
                )}
              </section>

              {/* Aktivite / durum geçmişi */}
              <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Durum & Aktivite Geçmişi</p>
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-400">Henüz kayıt yok.</p>
                ) : (
                  <div className="relative pl-5 space-y-3">
                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-100" />
                    {activity.map((a) => (
                      <div key={a.id} className="relative">
                        <div className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center">
                          <Clock className="w-2 h-2 text-indigo-500" />
                        </div>
                        <p className="text-xs text-slate-700">{a.summary ?? a.action}</p>
                        <p className="text-[10px] text-slate-400">{relTime(a.created_at)}{a.actor_name ? ` · ${a.actor_name}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
