"use client";

import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";
import type { CustomerQuoteRun } from "./types";
import { fmtMoney, fmtDateTime } from "./types";

const STATUS_CLS: Record<string, string> = {
  "Yeni":               "bg-blue-100 text-blue-700 ring-blue-200",
  "Teklif Verildi":     "bg-amber-100 text-amber-700 ring-amber-200",
  "Müşteri Düşünüyor":  "bg-amber-100 text-amber-700 ring-amber-200",
  "Kazanıldı":          "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "Kaybedildi":         "bg-rose-100 text-rose-700 ring-rose-200",
  "İptal":              "bg-slate-100 text-slate-500 ring-slate-200",
};

export default function QuotesTab({ quoteRuns }: { quoteRuns: CustomerQuoteRun[] }) {
  if (quoteRuns.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <Zap className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Bu müşteri için teklif çalışması yapılmamış</p>
        <Link href="/quote-center/new" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-colors">
          <Zap className="w-3.5 h-3.5" /> İlk teklifi çalış
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quoteRuns.map(run => {
        const results = run.quote_results ?? [];
        const offers  = results.filter(r => r.price != null);
        const best    = offers.length > 0 ? Math.min(...offers.map(o => o.price!)) : null;
        return (
          <Link
            key={run.id}
            href={`/quote-center/${run.id}`}
            className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-violet-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="text-sm font-bold text-slate-800">{run.product_type} Teklifi</p>
                <p className="text-[11px] text-slate-400">{fmtDateTime(run.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teklif</p>
                <p className="text-sm font-bold text-slate-700">{offers.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En İyi</p>
                <p className="text-sm font-bold text-emerald-600">{fmtMoney(best)}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${STATUS_CLS[run.status] ?? STATUS_CLS["Yeni"]}`}>
                {run.status}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
