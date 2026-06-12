"use client";

/**
 * Gelir Merkezi — MRR/ARR, paket dağılımı, acente bazlı gelir, grafikler.
 * Gelir plan haritasından türetilir (ödeme altyapısı bağlanınca kaynak değişir).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Wallet, RefreshCw, TrendingUp, TrendingDown, Banknote, Layers } from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, PlanBadge, LoadingGrid, ErrorBox, fmtMoney, fmtNum,
} from "@/components/admin/ui";

type Revenue = {
  mrr: number; arr: number; collected_this_month: number; churned_this_month: number;
  note: string;
  by_plan: { plan: string; label: string; count: number; active: number; mrr: number }[];
  by_agency: { id: string; name: string; plan: string; is_active: boolean; mrr: number; premium_volume: number }[];
  series: { month: string; mrr: number; agencies: number }[];
};

const PIE_COLORS = ["#94a3b8", "#6366f1", "#8b5cf6"];

export default function AdminRevenuePage() {
  const [data,    setData]    = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/revenue");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gelir verisi yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gelir verisi yüklenemedi.");
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
        title="Gelir Merkezi"
        subtitle={data.note}
        Icon={Wallet}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="MRR" value={fmtMoney(data.mrr)} Icon={Banknote} tone="indigo" index={0} sub="Aylık yinelenen gelir" />
        <KpiCard label="ARR" value={fmtMoney(data.arr)} Icon={TrendingUp} tone="violet" index={1} sub="Yıllık projeksiyon" />
        <KpiCard label="Bu Ay Tahsilat" value={fmtMoney(data.collected_this_month)} Icon={Wallet} tone="emerald" index={2} />
        <KpiCard label="Kaybedilen Gelir" value={fmtMoney(data.churned_this_month)} Icon={TrendingDown} tone="rose" index={3} sub="Pasif acenteler" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* MRR trendi */}
        <SectionCard title="MRR Trendi" subtitle="Son 6 ay" className="xl:col-span-2">
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => [fmtMoney(Number(v)), "MRR"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2.5} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Paket dağılımı */}
        <SectionCard title="Paket Dağılımı" subtitle="Acente sayısına göre">
          <div className="p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.by_plan} dataKey="count" nameKey="label" cx="50%" cy="50%"
                  innerRadius={42} outerRadius={68} paddingAngle={4} strokeWidth={0}>
                  {data.by_plan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4 space-y-2">
            {data.by_plan.map((p, i) => (
              <div key={p.plan} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="font-semibold text-slate-700 flex-1">{p.label}</span>
                <span className="text-slate-400">{fmtNum(p.count)} acente</span>
                <span className="font-bold text-indigo-700 w-20 text-right">{fmtMoney(p.mrr)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Acente bazlı gelir */}
      <SectionCard title="Acente Bazlı Gelir" subtitle="MRR + prim hacmi" actions={<Layers className="w-4 h-4 text-slate-300" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Acente", "Paket", "Durum", "MRR", "Prim Hacmi"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.by_agency.map(a => (
                <tr key={a.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/agencies/${a.id}`} className="text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors">{a.name}</Link>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={a.plan} /></td>
                  <td className="px-4 py-3 text-xs">{a.is_active ? <span className="text-emerald-600 font-bold">Aktif</span> : <span className="text-slate-400">Pasif</span>}</td>
                  <td className="px-4 py-3 text-sm font-bold text-indigo-700">{fmtMoney(a.mrr)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmtMoney(a.premium_volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
