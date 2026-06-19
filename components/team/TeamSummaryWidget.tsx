"use client";

/**
 * Dashboard "Ekip Özeti" mini-widget — yalnız owner/manager.
 * /api/team/performance'tan: en çok üreten + ekip toplam prim + atıl sayısı.
 * Veri yoksa hiçbir şey render etmez (dashboard'u bozmaz).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowUpRight, AlertTriangle } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { AgencyPerformance } from "@/lib/performance";

const IDLE_DAYS = 7;

export default function TeamSummaryWidget() {
  const [data, setData] = useState<AgencyPerformance | null>(null);

  useEffect(() => {
    fetch("/api/team/performance")
      .then((r) => r.json())
      .then((j) => { if (!j?.error) setData(j as AgencyPerformance); })
      .catch(() => {});
  }, []);

  if (!data || data.users.length === 0) return null;

  const top = data.leaders.top_premium;
  const idle = data.users.filter(
    (u) => !u.last_activity || (Date.now() - new Date(u.last_activity).getTime()) / 864e5 >= IDLE_DAYS
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Ekip Özeti</h2>
        </div>
        <Link href="/settings?s=personel-performansi" className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Tüm Performans <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ekip Toplam Prim</p>
          <p className="text-base font-extrabold text-slate-900 mt-0.5 tabular-nums">{fmtMoney(data.team.total_premium)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En Çok Üreten</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{top?.name ?? "—"}</p>
          <p className="text-[11px] text-slate-500">{top ? fmtMoney(top.total_premium) : "veri yok"}</p>
        </div>
      </div>

      {idle > 0 && (
        <div className="flex items-center gap-2 mt-3 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span><span className="font-bold">{idle} personel</span> {IDLE_DAYS}+ gündür işlemsiz</span>
        </div>
      )}
    </div>
  );
}
