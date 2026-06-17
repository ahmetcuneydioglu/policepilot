"use client";

/**
 * Operasyon Merkezi — Executive Command Center açılış sayfası.
 * KPI kartları + Sistem Sağlığı + Executive Overview (canlı veriler).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Building2, Users, UserSquare2, Zap, FileText,
  MessageCircle, Wallet, Sparkles, Percent, RefreshCw, Activity,
  Trophy, TrendingUp, AlertTriangle, Clock, ChevronRight,
} from "lucide-react";
import {
  PageHeader, KpiCard, SectionCard, StatusDot, LoadingGrid, ErrorBox,
  fmtMoney, fmtNum, fmtDate,
} from "@/components/admin/ui";

type Overview = {
  totals: {
    agencies: number; active_agencies: number; users: number; customers: number;
    quotes: number; policies: number; whatsapp_today: number; whatsapp_total: number;
    monthly_revenue: number; new_agencies_this_month: number; conversion_rate: number;
  };
  health: { key: string; label: string; status: "ok" | "warn" | "down" | "off"; detail: string }[];
  executive: {
    most_active:     { id: string; name: string; plan: string; value: string } | null;
    most_quotes:     { id: string; name: string; plan: string; value: string } | null;
    most_policies:   { id: string; name: string; plan: string; value: string } | null;
    most_whatsapp:   { id: string; name: string; plan: string; value: string } | null;
    fastest_growing: { id: string; name: string; plan: string; value: string } | null;
    over_limit:      { id: string; name: string; usage: number }[];
    trial_expiring:  { id: string; name: string; expires_at: string | null }[];
    at_risk:         { id: string; name: string; reason: string }[];
  };
};

export default function AdminOverviewPage() {
  const [data,    setData]    = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/overview");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Veri yüklenemedi.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={3} cols={5} />;
  if (error || !data) return <ErrorBox message={error || "Bilinmeyen hata"} />;

  const { totals, health, executive } = data;

  const kpis = [
    { label: "Toplam Acente",      value: fmtNum(totals.agencies),           Icon: Building2,   tone: "indigo"  as const },
    { label: "Aktif Acente",       value: fmtNum(totals.active_agencies),    Icon: Activity,    tone: "emerald" as const },
    { label: "Toplam Kullanıcı",   value: fmtNum(totals.users),              Icon: Users,       tone: "blue"    as const },
    { label: "Toplam Müşteri",     value: fmtNum(totals.customers),          Icon: UserSquare2, tone: "violet"  as const },
    { label: "Toplam Teklif",      value: fmtNum(totals.quotes),             Icon: Zap,         tone: "amber"   as const },
    { label: "Toplam Poliçe",      value: fmtNum(totals.policies),           Icon: FileText,    tone: "blue"    as const },
    { label: "Bugünkü WhatsApp",   value: fmtNum(totals.whatsapp_today),     Icon: MessageCircle, tone: "emerald" as const },
    { label: "Aylık Gelir (MRR)",  value: fmtMoney(totals.monthly_revenue),  Icon: Wallet,      tone: "indigo" as const, sub: "Plan bazlı tahmin" },
    { label: "Bu Ay Yeni Acente",  value: fmtNum(totals.new_agencies_this_month), Icon: Sparkles, tone: "violet" as const },
    { label: "Dönüşüm Oranı",      value: `%${totals.conversion_rate}`,      Icon: Percent,     tone: "rose" as const,   sub: "Teklif → Poliçe" },
  ];

  const execCards = [
    { title: "En Aktif Acente",        e: executive.most_active,     emoji: "🏆" },
    { title: "En Çok Teklif Veren",    e: executive.most_quotes,     emoji: "⚡" },
    { title: "En Çok Poliçe Satan",    e: executive.most_policies,   emoji: "🛡️" },
    { title: "En Çok WhatsApp",        e: executive.most_whatsapp,   emoji: "💬" },
    { title: "En Hızlı Büyüyen (7g)",  e: executive.fastest_growing, emoji: "📈" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operasyon Merkezi"
        subtitle="SigortaOS platform genel durumu — canlı"
        Icon={LayoutDashboard}
        actions={
          <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      {/* ══ KPI Kartları ══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ══ Sistem Sağlığı ══ */}
        <SectionCard title="Sistem Sağlığı" subtitle="Canlı servis durumları">
          <div className="divide-y divide-slate-50">
            {health.map(h => (
              <div key={h.key} className="flex items-center gap-3 px-5 py-3">
                <StatusDot status={h.status} />
                <p className="text-sm font-semibold text-slate-700 flex-1">{h.label}</p>
                <p className={`text-[11px] ${h.status === "down" ? "text-rose-600 font-bold" : h.status === "warn" ? "text-amber-600" : "text-slate-400"}`}>
                  {h.detail}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ══ Executive Overview ══ */}
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {execCards.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                {c.e ? (
                  <Link href={`/admin/agencies/${c.e.id}`} className="block bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{c.emoji} {c.title}</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{c.e.name}</p>
                    <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">{c.e.value || "—"}</p>
                  </Link>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 opacity-60">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{c.emoji} {c.title}</p>
                    <p className="text-sm text-slate-400">Veri yok</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Dikkat gerektirenler */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SectionCard title="Limit Aşanlar" subtitle="%90+ kullanım">
              <AttentionList
                items={executive.over_limit.map(a => ({ id: a.id, name: a.name, detail: `%${a.usage} kullanım` }))}
                empty="Limit aşan acente yok"
                Icon={Trophy} tone="amber"
              />
            </SectionCard>
            <SectionCard title="Deneme Süresi Bitecekler" subtitle="14 gün içinde">
              <AttentionList
                items={executive.trial_expiring.map(a => ({ id: a.id, name: a.name, detail: fmtDate(a.expires_at) }))}
                empty="Yaklaşan bitiş yok"
                Icon={Clock} tone="blue"
              />
            </SectionCard>
            <SectionCard title="Riskli Acenteler" subtitle="Pasif / işlemsiz">
              <AttentionList
                items={executive.at_risk.map(a => ({ id: a.id, name: a.name, detail: a.reason }))}
                empty="Riskli acente yok 🎉"
                Icon={AlertTriangle} tone="rose"
              />
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Hızlı geçişler */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { href: "/admin/agencies", label: "Acenteleri Yönet", Icon: Building2 },
          { href: "/admin/revenue",  label: "Gelir Merkezi",    Icon: Wallet },
          { href: "/admin/whatsapp", label: "WhatsApp Merkezi", Icon: MessageCircle },
          { href: "/admin/ai",       label: "AI Merkezi",       Icon: TrendingUp },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm">
            <a.Icon className="w-3.5 h-3.5" /> {a.label} <ChevronRight className="w-3 h-3 -mr-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function AttentionList({ items, empty, tone }: {
  items: { id: string; name: string; detail: string }[];
  empty: string;
  Icon: typeof Trophy;
  tone: "amber" | "blue" | "rose";
}) {
  const toneCls = { amber: "text-amber-600", blue: "text-blue-600", rose: "text-rose-600" }[tone];
  if (items.length === 0) {
    return <p className="px-5 py-4 text-xs text-slate-400">{empty}</p>;
  }
  return (
    <div className="divide-y divide-slate-50 max-h-44 overflow-y-auto">
      {items.map(it => (
        <Link key={it.id} href={`/admin/agencies/${it.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50 transition-colors">
          <p className="text-xs font-semibold text-slate-700 truncate">{it.name}</p>
          <p className={`text-[10px] font-bold whitespace-nowrap ${toneCls}`}>{it.detail}</p>
        </Link>
      ))}
    </div>
  );
}
