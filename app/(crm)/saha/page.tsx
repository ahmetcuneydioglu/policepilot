"use client";

/**
 * PORTFÖY — Saha Günlüğü (Yönetici Kokpiti, Faz 4).
 * "Kim çalışıyor, kim ziyaret ediyor, kim teklif veriyor, kim sonuç alıyor,
 * kim müşteriyi bekletiyor?" — haftalık personel kartları + funnel + bayat işler
 * + kayıp nedenleri + AI haftalık özet. Veri: /api/portfolio/insights.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEAL_STAGES, dealStageOf, lostReasonLabel } from "@/lib/portfolio";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  ChevronLeft, ChevronRight, Sparkles, RefreshCw, Phone, HeartHandshake,
  MessageCircle, FileText, ShieldCheck, Hourglass, AlertTriangle,
} from "lucide-react";

type Staff = {
  id: string; name: string;
  interactions: number; phone: number; visits: number; whatsapp: number;
  quotes_sent: number; won: number; lost: number;
  open_deals: number; stale_deals: number;
};
type Insights = {
  start: string; end: string;
  staff: Staff[];
  totals: { interactions: number; visits: number; quotes_sent: number; won: number; lost: number };
  funnel: { stage: string; count: number }[];
  lost_reasons: { reason: string; count: number }[];
  stale_deals: { id: string; title: string; customer_name: string | null; owner_name: string | null; stage: string; days: number }[];
};

function weekLabel(start: string, end: string) {
  const f = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const endIncl = new Date(`${end}T00:00:00`);
  endIncl.setDate(endIncl.getDate() - 1);
  return `${f(start)} – ${endIncl.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
}
function shiftWeek(start: string, weeks: number) {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function SahaGunluguPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [start, setStart] = useState<string | null>(null); // null = bu hafta (API default)
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/portfolio/insights${start ? `?start=${start}` : ""}`);
    const j = await res.json();
    if (!res.ok) { setError(j.error ?? "Yüklenemedi."); setLoading(false); return; }
    setData(j as Insights);
    setLoading(false);
  }, [start]);
  useEffect(() => { load(); setAiText(""); setAiError(""); }, [load]);

  async function generateAi() {
    if (!data) return;
    setAiLoading(true);
    setAiError("");
    const res = await fetch("/api/portfolio/insights", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: data.start }),
    });
    const j = await res.json();
    setAiLoading(false);
    if (!res.ok) { setAiError(j.error ?? "Özet üretilemedi."); return; }
    setAiText(j.summary);
  }

  const isCurrentWeek = useMemo(() => {
    if (!data) return true;
    return new Date() < new Date(`${data.end}T00:00:00+03:00`);
  }, [data]);

  const maxFunnel = useMemo(() => Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1])), [data]);
  const activeStaff = useMemo(
    () => (data?.staff ?? []).filter((s) => s.interactions + s.quotes_sent + s.won + s.lost + s.open_deals > 0),
    [data]
  );

  if (loading && !data) {
    return <div className="max-w-6xl"><ListSkeleton kpis={5} rows={5} /></div>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-600">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const kpis = [
    { label: "Görüşme", value: data.totals.interactions, Icon: HeartHandshake, tint: "bg-blue-50 text-blue-600" },
    { label: "Saha Ziyareti", value: data.totals.visits, Icon: Phone, tint: "bg-cyan-50 text-cyan-600" },
    { label: "Teklif Gönderilen", value: data.totals.quotes_sent, Icon: FileText, tint: "bg-violet-50 text-violet-600" },
    { label: "Poliçeleşen", value: data.totals.won, Icon: ShieldCheck, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Bekletilen İş", value: data.stale_deals.length, Icon: Hourglass, tint: data.stale_deals.length > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500" },
  ];

  return (
    <div className="max-w-6xl space-y-5">
      {/* Başlık + hafta gezgini */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saha Günlüğü</h1>
          <p className="text-sm text-slate-400">Kim çalışıyor, kim sonuç alıyor, kim bekletiyor — haftalık ekip kokpiti</p>
        </div>
        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={() => setStart(shiftWeek(data.start, -1))}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Önceki hafta">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs font-bold text-slate-700 tabular-nums">{weekLabel(data.start, data.end)}</span>
          <button onClick={() => setStart(shiftWeek(data.start, 1))} disabled={isCurrentWeek}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-30" title="Sonraki hafta">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI şeridi */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <k.Icon className="w-3.5 h-3.5 text-slate-300" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{k.label}</p>
            </div>
            <p className={`text-xl font-extrabold mt-1 tabular-nums inline-block px-1.5 rounded-lg ${k.tint}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* AI haftalık özet */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">AI Haftalık Ekip Özeti</p>
          </div>
          <button onClick={generateAi} disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-3 h-3 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Üretiliyor…" : aiText ? "Yenile" : "Özet Oluştur"}
          </button>
        </div>
        {aiError && <p className="text-[11px] font-semibold text-rose-600 mb-1">{aiError}</p>}
        {aiText ? (
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{aiText}</p>
        ) : (
          <p className="text-xs text-slate-500">Haftanın ekip verisinden yönetici özeti üretir: kim öne çıktı, darboğaz hangi aşamada, hangi işler bekletiliyor, önümüzdeki haftanın aksiyonu.</p>
        )}
      </div>

      {/* Personel kartları */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Personel · Bu Hafta</p>
        {activeStaff.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">Bu hafta kayıtlı aktivite yok</p>
            <p className="text-xs text-slate-400 mt-1">Görüşmeler ve Satış Hattı hareketleri buraya düşer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeStaff.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                  </div>
                  {s.stale_deals > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 flex-shrink-0" title="7 günden uzun temassız açık iş">
                      ⏳ {s.stale_deals} bekletilen
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{s.interactions}</span>
                  <span className="text-[11px] text-slate-400 font-semibold">görüşme</span>
                  <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
                    📞{s.phone} · 🤝{s.visits} · 💬{s.whatsapp}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-violet-50 py-1.5">
                    <p className="text-sm font-extrabold text-violet-700 tabular-nums">{s.quotes_sent}</p>
                    <p className="text-[9px] font-bold text-violet-400 uppercase">Teklif</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 py-1.5">
                    <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{s.won}</p>
                    <p className="text-[9px] font-bold text-emerald-400 uppercase">Poliçe</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-1.5">
                    <p className="text-sm font-extrabold text-slate-700 tabular-nums">{s.open_deals}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Açık İş</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Funnel (anlık) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Satış Hattı · Anlık Dağılım</p>
          <div className="space-y-1.5">
            {DEAL_STAGES.map((st) => {
              const count = data.funnel.find((f) => f.stage === st.key)?.count ?? 0;
              return (
                <div key={st.key} className="flex items-center gap-2">
                  <span className="w-32 text-[11px] font-semibold text-slate-500 truncate flex-shrink-0">{st.label}</span>
                  <div className="flex-1 h-4 bg-slate-50 rounded-md overflow-hidden">
                    <div className={`h-full rounded-md ${st.dot}`} style={{ width: `${(count / maxFunnel) * 100}%`, opacity: count ? 0.85 : 0 }} />
                  </div>
                  <span className="w-6 text-right text-[11px] font-bold text-slate-600 tabular-nums flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kayıp nedenleri */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Kayıp Nedenleri · Tüm Zamanlar</p>
          {data.lost_reasons.length === 0 ? (
            <p className="text-xs text-slate-400">Kaybedilen iş yok. 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.lost_reasons.map((r) => {
                const max = data.lost_reasons[0].count;
                return (
                  <div key={r.reason} className="flex items-center gap-2">
                    <span className="w-28 text-[11px] font-semibold text-slate-500 truncate flex-shrink-0">{lostReasonLabel(r.reason)}</span>
                    <div className="flex-1 h-4 bg-slate-50 rounded-md overflow-hidden">
                      <div className="h-full rounded-md bg-rose-400/80" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-[11px] font-bold text-slate-600 tabular-nums flex-shrink-0">{r.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bekletilen işler */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center gap-1.5">
          <Hourglass className="w-3.5 h-3.5 text-amber-500" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bekletilen İşler · {STALE_LABEL}</p>
        </div>
        {data.stale_deals.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-slate-400">Bekletilen iş yok — tüm açık işlerin son 7 günde teması var. 👏</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-2">İş</th>
                  <th className="px-4 py-2">Sorumlu</th>
                  <th className="px-4 py-2">Aşama</th>
                  <th className="px-4 py-2 text-right">Temassız</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.stale_deals.map((d) => (
                  <tr key={d.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/portfoy?open=${d.id}`} className="font-medium text-slate-800 hover:text-indigo-600 hover:underline">
                        {d.customer_name ?? d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{d.owner_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dealStageOf(d.stage).badge}`}>{dealStageOf(d.stage).label}</span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${d.days >= 14 ? "text-rose-600" : "text-amber-600"}`}>{d.days} gün</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp/İletişim ipucu */}
      <p className="text-[11px] text-slate-300 text-center pb-2 inline-flex items-center gap-1 w-full justify-center">
        <MessageCircle className="w-3 h-3" /> Görüşme kırılımı İlişki kayıtlarından, teklif/poliçe sayıları Satış Hattı aşama geçişlerinden hesaplanır.
      </p>
    </div>
  );
}

const STALE_LABEL = "7 Günden Uzun Temassız";
