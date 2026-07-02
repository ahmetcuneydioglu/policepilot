"use client";

/**
 * "Bugün" şeridi — dashboard'ın devam-noktası (Monday felsefesi: rapor değil aksiyon).
 * Sabah Brifingi (kural-tabanlı, gerçek veri) + 3 aksiyon kovası:
 * yenilemeler / takip zamanı gelen fırsatlar / yeni lead'ler. Hepsi tıklanabilir.
 * Veri yoksa yalnız brifing satırı görünür (boş kutu göstermez).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sunrise, RefreshCw, CalendarClock, Zap, ChevronRight } from "lucide-react";
import { stageOf } from "@/lib/opportunities";

type Cust = { name: string } | null;
type Today = {
  briefing: string;
  today: string;
  renewals: { id: string; policy_type: string; end_date: string; customers: Cust }[];
  followups: { id: string; request_type: string; status: string; customers: Cust }[];
  leads: { id: string; request_type: string; created_at: string; customers: Cust }[];
};

function dayDiff(iso: string, today: string): number {
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5);
}

export default function TodayStrip() {
  const [data, setData] = useState<Today | null>(null);

  useEffect(() => {
    fetch("/api/today").then((r) => r.json()).then((j) => { if (!j?.error) setData(j); }).catch(() => {});
  }, []);

  if (!data || !data.briefing) return null;

  const buckets = [
    {
      key: "ren", title: "Yenileme Bekleyen", Icon: RefreshCw,
      tint: "bg-amber-50 text-amber-600", href: "/renewals",
      items: data.renewals.map((r) => {
        const d = dayDiff(r.end_date, data.today);
        return { id: r.id, href: "/renewals", name: r.customers?.name ?? "Müşteri", sub: r.policy_type, tag: d < 0 ? `${Math.abs(d)}g gecikti` : d === 0 ? "bugün" : `${d}g kaldı`, tagCls: d <= 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700" };
      }),
    },
    {
      key: "fol", title: "Takip Zamanı Geldi", Icon: CalendarClock,
      tint: "bg-indigo-50 text-indigo-600", href: "/firsatlar",
      items: data.followups.map((f) => ({ id: f.id, href: `/firsatlar?open=${f.id}`, name: f.customers?.name ?? "Müşteri", sub: f.request_type, tag: f.status, tagCls: stageOf(f.status).badge })),
    },
    {
      key: "led", title: "Yeni Lead", Icon: Zap,
      tint: "bg-blue-50 text-blue-600", href: "/firsatlar",
      items: data.leads.map((l) => ({ id: l.id, href: `/firsatlar?open=${l.id}`, name: l.customers?.name ?? "Müşteri", sub: l.request_type, tag: "yanıt bekliyor", tagCls: "bg-blue-50 text-blue-700" })),
    },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* Sabah Brifingi */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-900 to-blue-950">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Sunrise className="w-4 h-4 text-amber-300" />
        </div>
        <p className="text-sm text-blue-100 font-medium leading-snug">{data.briefing}</p>
      </div>

      {/* Aksiyon kovaları */}
      {buckets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {buckets.map((b) => (
            <div key={b.key} className="p-4">
              <Link href={b.href} className="flex items-center justify-between mb-2.5 group">
                <span className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${b.tint}`}><b.Icon className="w-3.5 h-3.5" /></span>
                  <span className="text-xs font-bold text-slate-700">{b.title}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 tabular-nums">{b.items.length}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </Link>
              <div className="space-y-1">
                {b.items.slice(0, 3).map((it) => (
                  <Link key={it.id} href={it.href}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{it.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{it.sub}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${it.tagCls}`}>{it.tag}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
