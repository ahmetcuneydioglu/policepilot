"use client";

import { FileText } from "lucide-react";
import type { CustomerPolicy } from "./types";
import { fmtMoney, fmtDate, daysLeft } from "./types";

function statusBadge(p: CustomerPolicy) {
  if (p.status === "Yenilendi" || p.renewal_status === "completed")
    return { label: "✅ Yenilendi", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" };
  if (p.status === "Pasif")
    return { label: "Pasif", cls: "bg-gray-100 text-gray-500 ring-gray-200" };
  if (new Date(p.end_date).getTime() < Date.now())
    return { label: "Süresi Doldu", cls: "bg-red-100 text-red-700 ring-red-200" };
  const d = daysLeft(p.end_date);
  if (d <= 30) return { label: `${d} gün kaldı`, cls: "bg-amber-100 text-amber-700 ring-amber-200" };
  return { label: "Aktif", cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" };
}

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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span className="col-span-3">Poliçe</span>
        <span className="col-span-3">Şirket / No</span>
        <span className="col-span-2">Dönem</span>
        <span className="col-span-2">Prim</span>
        <span className="col-span-2">Durum</span>
      </div>
      <div className="divide-y divide-slate-50">
        {policies.map(p => {
          const badge = statusBadge(p);
          return (
            <div key={p.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-blue-50/30 transition-colors">
              <div className="col-span-2 sm:col-span-3">
                <p className="text-sm font-semibold text-slate-800">{p.policy_type}</p>
                {p.document_path && <p className="text-[10px] text-blue-500 mt-0.5">📄 Evrak ekli</p>}
              </div>
              <div className="sm:col-span-3 min-w-0">
                <p className="text-xs text-slate-600 truncate">{p.insurance_company ?? "—"}</p>
                {p.policy_no && <p className="text-[11px] text-slate-400 font-mono truncate">{p.policy_no}</p>}
              </div>
              <div className="sm:col-span-2 text-[11px] text-slate-500">
                <p>{fmtDate(p.start_date)}</p>
                <p className="font-medium text-slate-700">{fmtDate(p.end_date)}</p>
              </div>
              <div className="sm:col-span-2 text-sm font-bold text-slate-700">{fmtMoney(p.premium)}</div>
              <div className="sm:col-span-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
