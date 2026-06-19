"use client";

/**
 * AI Koçluk kartı — acente sahibine, ekibi için somut koçluk önerileri.
 * Açılışta kural-tabanlı öneriler (anında, ücretsiz); "AI ile zenginleştir"
 * butonu OpenAI ile doğal dile çevirir (sayılar değişmez). Öneri yoksa render etmez.
 */

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, TrendingDown, Target, Trophy, Loader2 } from "lucide-react";
import type { CoachingItem, CoachingSeverity } from "@/lib/coaching";

const SEV: Record<CoachingSeverity, { strip: string; chip: string; Icon: typeof AlertTriangle }> = {
  high:     { strip: "bg-rose-400",    chip: "bg-rose-50 text-rose-700",       Icon: AlertTriangle },
  medium:   { strip: "bg-amber-400",   chip: "bg-amber-50 text-amber-700",     Icon: TrendingDown },
  low:      { strip: "bg-slate-300",   chip: "bg-slate-100 text-slate-600",    Icon: Target },
  positive: { strip: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-700", Icon: Trophy },
};

type Meta = { generated_by: "rules" | "ai"; ai_available: boolean; ai_error?: boolean };

export default function CoachingCard({ onPickUser }: { onPickUser?: (id: string) => void }) {
  const [items, setItems] = useState<CoachingItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  const load = (enrich: boolean) => {
    if (enrich) setEnriching(true); else setLoading(true);
    fetch(`/api/team/coaching${enrich ? "?enrich=1" : ""}`)
      .then((r) => r.json())
      .then((j) => { if (!j?.error) { setItems(j.items ?? []); setMeta(j as Meta); } })
      .catch(() => {})
      .finally(() => { setLoading(false); setEnriching(false); });
  };
  useEffect(() => { load(false); }, []);

  if (loading) return <div className="h-28 bg-slate-100 rounded-2xl animate-pulse mb-4" />;
  if (items.length === 0) return null; // öneri yoksa kartı gizle

  const isAi = meta?.generated_by === "ai";

  return (
    <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/70 to-white shadow-sm p-4 mb-4">
      {/* başlık */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Koçluk Önerileri</h3>
            <p className="text-[11px] text-slate-400">
              {isAi ? "Yapay zeka tarafından yazıldı" : "Ekip verinizden otomatik üretildi"}
            </p>
          </div>
        </div>

        {meta?.ai_available && !isAi && (
          <button
            onClick={() => load(true)}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
          >
            {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {enriching ? "Yazılıyor…" : "AI ile zenginleştir"}
          </button>
        )}
        {isAi && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-bold">
            <Sparkles className="w-3 h-3" /> AI
          </span>
        )}
      </div>

      {meta?.ai_error && (
        <p className="text-[11px] text-amber-600 mb-2">AI şu an yanıt vermedi — kural-tabanlı öneriler gösteriliyor.</p>
      )}

      {/* öneri listesi */}
      <div className="space-y-2">
        {items.map((it, i) => {
          const sev = SEV[it.severity];
          return (
            <div key={`${it.user_id}-${i}`} className="flex gap-3 bg-white rounded-xl border border-slate-200/70 p-3">
              <div className={`w-1 rounded-full flex-shrink-0 ${sev.strip}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${sev.chip}`}>
                    <sev.Icon className="w-3 h-3" /> {it.tag}
                  </span>
                  <button
                    onClick={() => onPickUser?.(it.user_id)}
                    className="text-xs font-bold text-slate-800 hover:text-indigo-600 hover:underline"
                  >
                    {it.user_name}
                  </button>
                </div>
                <p className="text-xs text-slate-600">{it.observation}</p>
                <p className="text-xs text-slate-800 mt-1">
                  <span className="font-semibold text-indigo-600">Öneri: </span>{it.action}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
