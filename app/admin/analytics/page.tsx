"use client";

/**
 * Analitik — platform büyüme serileri, ürün dağılımı, teklif hunisi.
 */

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";
import { PageHeader, SectionCard, LoadingGrid, ErrorBox } from "@/components/admin/ui";

type Analytics = {
  series: { month: string; customers: number; quotes: number; policies: number; whatsapp: number }[];
  product_distribution: { type: string; count: number }[];
  quote_funnel: { status: string; count: number }[];
};

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#64748b", "#3b82f6"];

export default function AdminAnalyticsPage() {
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/analytics");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analitik yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analitik yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={2} cols={3} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analitik"
        subtitle="Platform büyüme metrikleri — son 6 ay"
        Icon={TrendingUp}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <SectionCard title="Büyüme Trendi" subtitle="Aylık yeni kayıtlar">
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                {[["cust", "#6366f1"], ["quo", "#8b5cf6"], ["pol", "#10b981"], ["wa", "#06b6d4"]].map(([id, c]) => (
                  <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="customers" name="Müşteri" stroke="#6366f1" strokeWidth={2} fill="url(#g-cust)" />
              <Area type="monotone" dataKey="quotes"    name="Teklif"  stroke="#8b5cf6" strokeWidth={2} fill="url(#g-quo)" />
              <Area type="monotone" dataKey="policies"  name="Poliçe"  stroke="#10b981" strokeWidth={2} fill="url(#g-pol)" />
              <Area type="monotone" dataKey="whatsapp"  name="WhatsApp" stroke="#06b6d4" strokeWidth={2} fill="url(#g-wa)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Ürün Dağılımı" subtitle="Poliçe türlerine göre">
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.product_distribution} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Poliçe" radius={[6, 6, 0, 0]}>
                  {data.product_distribution.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Teklif Hunisi" subtitle="Durumlara göre teklif çalışmaları">
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.quote_funnel} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Adet" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
