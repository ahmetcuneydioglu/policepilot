"use client";

/**
 * AI Merkezi — AI kullanımı, acente skorları, risk analizi, satış tahmini.
 * Skorlama kural motoru — gerçek modele geçişte sözleşme sabit kalır.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bot, RefreshCw, ScanText, TrendingUp, Lightbulb, ShieldAlert } from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, PlanBadge, LoadingGrid, ErrorBox, fmtNum, fmtMoney,
} from "@/components/admin/ui";

type AiData = {
  usage: { ocr_total: number; ocr_30d: number; ocr_real: number; ocr_demo: number; model: string; configured: boolean };
  scores: { id: string; name: string; plan: string; score: number; grade: string; idle_days: number | null; risk: string | null }[];
  forecast: { next_month_policies: number; next_month_premium: number; basis: string };
  suggestions: string[];
};

const GRADE_CLS: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-blue-500", C: "bg-amber-500", D: "bg-rose-500",
};

export default function AdminAiPage() {
  const [data,    setData]    = useState<AiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/ai");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI verisi yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={2} cols={4} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Merkezi"
        subtitle={`Aktif model: ${data.usage.model} · ${data.usage.configured ? "yapılandırılmış" : "yapılandırılmamış"}`}
        Icon={Bot}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="AI OCR Toplam" value={fmtNum(data.usage.ocr_total)} Icon={ScanText} tone="violet" index={0} sub="Poliçe okuma" />
        <KpiCard label="Son 30 Gün" value={fmtNum(data.usage.ocr_30d)} Icon={ScanText} tone="indigo" index={1} />
        <KpiCard label="Gelecek Ay Poliçe Tahmini" value={fmtNum(data.forecast.next_month_policies)} Icon={TrendingUp} tone="emerald" index={2} sub={data.forecast.basis} />
        <KpiCard label="Gelecek Ay Prim Tahmini" value={fmtMoney(data.forecast.next_month_premium)} Icon={TrendingUp} tone="amber" index={3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Acente skorları */}
        <SectionCard title="AI Acente Skorları" subtitle="Aktivite + hacim + dönüşüm bazlı" className="xl:col-span-2">
          <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
            {data.scores.map(s => (
              <Link key={s.id} href={`/admin/agencies/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-indigo-50/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl ${GRADE_CLS[s.grade] ?? "bg-slate-400"} flex items-center justify-center text-sm font-black text-white shadow-sm flex-shrink-0`}>
                  {s.grade}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {s.idle_days == null ? "Aktivite yok" : s.idle_days === 0 ? "Bugün aktif" : `Son işlem ${s.idle_days} gün önce`}
                  </p>
                </div>
                <PlanBadge plan={s.plan} />
                <div className="w-28">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${GRADE_CLS[s.grade] ?? "bg-slate-400"}`} style={{ width: `${s.score}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 text-right mt-0.5">{s.score}/100</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          {/* AI önerileri */}
          <SectionCard title="AI Önerileri" subtitle="Platform geneli aksiyonlar" actions={<Lightbulb className="w-4 h-4 text-amber-400" />}>
            <ul className="p-5 space-y-3">
              {data.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <span className="text-indigo-500 mt-px">✦</span> {s}
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Risk analizi */}
          <SectionCard title="AI Risk Analizi" actions={<ShieldAlert className="w-4 h-4 text-rose-400" />}>
            <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
              {data.scores.filter(s => s.risk).map(s => (
                <Link key={s.id} href={`/admin/agencies/${s.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-rose-50/40 transition-colors">
                  <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                  <p className="text-[10px] font-bold text-rose-600 whitespace-nowrap">{s.risk}</p>
                </Link>
              ))}
              {data.scores.filter(s => s.risk).length === 0 && (
                <p className="px-5 py-5 text-xs text-emerald-600">Riskli acente yok 🎉</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
