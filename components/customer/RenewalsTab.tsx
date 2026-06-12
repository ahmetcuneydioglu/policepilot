"use client";

import Link from "next/link";
import { RefreshCw, Zap, ChevronRight, CheckCircle2 } from "lucide-react";
import type { CustomerPolicy } from "./types";
import { fmtDate, daysLeft } from "./types";

export default function RenewalsTab({ policies }: { policies: CustomerPolicy[] }) {
  // Yaklaşan: aktif, tamamlanmamış, bitişi geçmiş 60 gün → gelecek 90 gün penceresi
  const upcoming = policies.filter(p =>
    p.status === "Aktif" &&
    p.renewal_status !== "completed" &&
    daysLeft(p.end_date) <= 90
  ).sort((a, b) => (a.end_date < b.end_date ? -1 : 1));

  // Geçmiş: yenilenmiş poliçeler
  const completed = policies
    .filter(p => p.renewal_status === "completed" || p.status === "Yenilendi")
    .sort((a, b) => ((a.renewed_at ?? "") < (b.renewed_at ?? "") ? 1 : -1));

  const empty = upcoming.length === 0 && completed.length === 0;

  if (empty) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Yenileme kaydı bulunmuyor</p>
        <p className="text-xs text-slate-300 mt-1">90 gün içinde bitecek aktif poliçe yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-amber-50/50">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">⏰ Yaklaşan Yenilemeler</p>
          </div>
          <div className="divide-y divide-slate-50">
            {upcoming.map(p => {
              const d = daysLeft(p.end_date);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-semibold text-slate-800">{p.policy_type}</p>
                    <p className="text-[11px] text-slate-400">{p.insurance_company ?? "—"} · Bitiş: {fmtDate(p.end_date)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${
                    d < 0 ? "bg-red-100 text-red-700 ring-red-200" :
                    d <= 7 ? "bg-orange-100 text-orange-700 ring-orange-200" :
                    "bg-amber-100 text-amber-700 ring-amber-200"
                  }`}>
                    {d < 0 ? `${Math.abs(d)} gün gecikti` : d === 0 ? "Bugün" : `${d} gün kaldı`}
                  </span>
                  {p.renewal_status === "quoted" ? (
                    <span className="px-2 py-1 rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200 text-[10px] font-bold">
                      ⚡ Teklif Çalışıldı
                    </span>
                  ) : (
                    <Link
                      href={`/renewals/quote/${p.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm"
                    >
                      <Zap className="w-3 h-3" /> Teklif Çalış <ChevronRight className="w-3 h-3 -mr-0.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-emerald-50/50">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">✅ Yenileme Geçmişi</p>
          </div>
          <div className="divide-y divide-slate-50">
            {completed.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.policy_type}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {p.insurance_company ?? "—"}{p.policy_no ? ` (${p.policy_no})` : ""}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  {p.renewed_at ? `${fmtDate(p.renewed_at)} tarihinde yenilendi` : "Yenilendi"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
