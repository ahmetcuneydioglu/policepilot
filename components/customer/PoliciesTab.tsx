"use client";

import { FileText } from "lucide-react";
import type { CustomerPolicy } from "./types";
import { fmtMoney, fmtDate, daysLeft } from "./types";

function remainingBadge(p: CustomerPolicy): { label: string; cls: string } {
  if (p.status === "Yenilendi" || p.renewal_status === "completed")
    return { label: "✅ Yenilendi", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" };
  if (p.status === "Pasif")
    return { label: "Pasif", cls: "bg-gray-100 text-gray-500 ring-gray-200" };

  const d = daysLeft(p.end_date);
  if (d < 0)    return { label: `${Math.abs(d)} gün gecikti`, cls: "bg-red-100 text-red-700 ring-red-200" };
  if (d === 0)  return { label: "Bugün bitiyor",              cls: "bg-red-100 text-red-700 ring-red-200" };
  if (d <= 7)   return { label: `${d} gün kaldı`,             cls: "bg-orange-100 text-orange-700 ring-orange-200" };
  if (d <= 30)  return { label: `${d} gün kaldı`,             cls: "bg-amber-100 text-amber-700 ring-amber-200" };
  return          { label: `${d} gün kaldı`,                   cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" };
}

function statusChip(p: CustomerPolicy): { label: string; cls: string } {
  if (p.status === "Yenilendi") return { label: "Yenilendi", cls: "bg-teal-50 text-teal-700 ring-teal-200" };
  if (p.status === "Pasif")     return { label: "Pasif",     cls: "bg-gray-50 text-gray-500 ring-gray-200" };
  if (new Date(p.end_date).getTime() < Date.now())
    return { label: "Süresi Doldu", cls: "bg-red-50 text-red-600 ring-red-200" };
  return { label: "Aktif", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
}

const TYPE_EMOJI: Record<string, string> = {
  Kasko: "🛡️", Trafik: "🚗", Konut: "🏡", DASK: "🏠",
  "Sağlık": "❤️", "Tamamlayıcı": "🏥", Seyahat: "✈️", "Ferdi Kaza": "⚡",
};

export default function PoliciesTab({ policies }: { policies: CustomerPolicy[] }) {
  if (policies.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Bu müşteriye ait poliçe bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {policies.map(p => {
        const remaining = remainingBadge(p);
        const status    = statusChip(p);
        return (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

            {/* Kart başlığı */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                {TYPE_EMOJI[p.policy_type] ?? "📋"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{p.policy_type}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {p.insurance_company ?? "Şirket belirtilmemiş"}
                  {p.document_path && <span className="text-blue-500"> · 📄 Evrak ekli</span>}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 whitespace-nowrap ${remaining.cls}`}>
                {remaining.label}
              </span>
            </div>

            {/* Detay grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 px-5 py-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Poliçe No</p>
                <p className="text-xs font-mono font-semibold text-slate-700 truncate mt-0.5">{p.policy_no ?? "—"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Prim</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{fmtMoney(p.premium)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Komisyon</p>
                <p className="text-xs font-bold text-violet-600 mt-0.5">{fmtMoney(p.commission)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Başlangıç</p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">{fmtDate(p.start_date)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bitiş</p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">{fmtDate(p.end_date)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Durum</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 mt-0.5 ${status.cls}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
