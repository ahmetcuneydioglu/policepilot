"use client";

import { useEffect, useState } from "react";
import AnimatedCounter from "@/components/AnimatedCounter";
import WeeklyChart from "@/components/WeeklyChart";
import { supabase } from "@/lib/supabase";

type Activity = { id: string; label: string; sub: string; time: string; type: "customer" | "request" };
type RecentRequest = { id: string; request_type: string; status: string; created_at: string; customers: { name: string } | null };

const actBg = { customer: "bg-blue-100", request: "bg-indigo-100" };
const actColor = { customer: "text-blue-600", request: "text-indigo-600" };
const statusCls: Record<string, string> = {
  Yeni: "bg-blue-100 text-blue-700",
  İşlemde: "bg-indigo-100 text-indigo-700",
  Tamamlandı: "bg-emerald-100 text-emerald-700",
  İptal: "bg-red-100 text-red-700",
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_STATS = { customers: 128, requests: 34, renewals: 18, today: 9 };

const DEMO_ACTIVITIES: Activity[] = [
  { id: "a1", label: "Ahmet Yılmaz", sub: "Kasko teklif talebi — Yeni", time: "Bugün", type: "request" },
  { id: "a2", label: "Fatma Kaya", sub: "WhatsApp mesajı gönderildi", time: "Bugün", type: "customer" },
  { id: "a3", label: "Mehmet Demir", sub: "Poliçe yenileme — 8 gün kaldı", time: "Dün", type: "request" },
  { id: "a4", label: "Ayşe Çelik", sub: "Yeni müşteri eklendi", time: "Dün", type: "customer" },
  { id: "a5", label: "Mustafa Şahin", sub: "Kasko teklifi tamamlandı", time: "2 gün önce", type: "request" },
  { id: "a6", label: "Zeynep Arslan", sub: "Yeni müşteri eklendi", time: "2 gün önce", type: "customer" },
];

const DEMO_REQUESTS: RecentRequest[] = [
  { id: "r1", request_type: "Kasko", status: "Yeni", created_at: new Date().toISOString(), customers: { name: "Ahmet Yılmaz" } },
  { id: "r2", request_type: "Konut", status: "İşlemde", created_at: new Date().toISOString(), customers: { name: "Fatma Kaya" } },
  { id: "r3", request_type: "Sağlık", status: "Tamamlandı", created_at: new Date().toISOString(), customers: { name: "Mehmet Demir" } },
  { id: "r4", request_type: "Trafik", status: "Yeni", created_at: new Date().toISOString(), customers: { name: "Zeynep Arslan" } },
];

export default function DashboardPage() {
  const [isDemo, setIsDemo] = useState(false);
  const [stats, setStats] = useState({ customers: 0, requests: 0, renewals: 0, today: 0 });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentReqs, setRecentReqs] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
    setIsDemo(demo);

    if (demo) {
      setStats(DEMO_STATS);
      setActivities(DEMO_ACTIVITIES);
      setRecentReqs(DEMO_REQUESTS);
      setLoading(false);
      return;
    }

    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("requests").select("*", { count: "exact", head: true }).in("status", ["Yeni", "İşlemde"]),
        supabase.from("policies").select("*", { count: "exact", head: true }).eq("status", "Aktif").lte("end_date", in30).gte("end_date", today),
        supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("customers").select("id, name, created_at").order("created_at", { ascending: false }).limit(4),
        supabase.from("requests").select("id, request_type, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(4),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any[];

      const [
        { count: totalCustomers },
        { count: openRequests },
        { count: upcomingRenewals },
        { count: todayCount },
        { data: recentCustomers },
        { data: recentRequests },
      ] = results;

      setStats({
        customers: totalCustomers ?? 0,
        requests: openRequests ?? 0,
        renewals: upcomingRenewals ?? 0,
        today: todayCount ?? 0,
      });

      const acts: Activity[] = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(recentCustomers ?? []).map((c: any) => ({
          id: c.id,
          label: c.name,
          sub: "Yeni müşteri eklendi",
          time: new Date(c.created_at).toLocaleDateString("tr-TR"),
          type: "customer" as const,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(recentRequests ?? []).map((r: any) => ({
          id: r.id,
          label: r.customers?.name ?? "Müşteri",
          sub: `${r.request_type} talebi — ${r.status}`,
          time: new Date(r.created_at).toLocaleDateString("tr-TR"),
          type: "request" as const,
        })),
      ].sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 6);

      setActivities(acts);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecentReqs((recentRequests ?? []) as any);
      setLoading(false);
    }

    load();
  }, []);

  const statCards = [
    {
      title: "Toplam Müşteri",
      value: stats.customers,
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-600",
      trend: "Tüm kayıtlar",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      title: "Açık Teklif",
      value: stats.requests,
      color: "from-indigo-500 to-indigo-600",
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      trend: "Yeni + İşlemde",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      title: "Yaklaşan Yenileme",
      value: stats.renewals,
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50",
      text: "text-amber-600",
      trend: "30 gün içinde",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      title: isDemo ? "Bugün Aranacak" : "Bugün Eklenen",
      value: stats.today,
      color: "from-emerald-500 to-teal-500",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      trend: isDemo ? "Takip listesi" : new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" }),
      icon: isDemo
        ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
        : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900">
                {isDemo ? "Atlas Sigorta Demo Paneli" : "Dashboard"}
              </h1>
              {isDemo && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                  DEMO
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-0.5 text-sm">
              {new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          {isDemo && (
            <a
              href="/#pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Teklif Al
            </a>
          )}
        </div>

        {isDemo && (
          <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium max-w-max">
            <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Bu bir demo paneldir. Gerçek veriler yerine örnek veriler gösterilmektedir.
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={card.title}
            className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 animate-fade-in-up stagger-${i + 1}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center ${card.text}`}>
                {card.icon}
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-500">{card.trend}</span>
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{card.title}</p>
            {loading ? (
              <div className="shimmer h-8 w-12 rounded mt-1" />
            ) : (
              <p className={`text-3xl font-bold mt-1 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                <AnimatedCounter target={card.value} />
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 animate-fade-in-up stagger-2">
          <WeeklyChart />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in-up stagger-3">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-slate-800 text-sm">Son Aktiviteler</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-10 rounded-lg" />)}
            </div>
          ) : activities.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Henüz kayıt yok</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activities.map((act) => (
                <div key={act.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full ${actBg[act.type]} ${actColor[act.type]} flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
                    {act.label.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{act.label}</p>
                    <p className="text-xs text-gray-400">{act.sub}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{act.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in-up stagger-4">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-slate-800 text-sm">Son Teklif Talepleri</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-10 rounded-lg" />)}
          </div>
        ) : recentReqs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Henüz teklif talebi yok</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentReqs.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-bold">
                    {(r.customers?.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.customers?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{r.request_type}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCls[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
