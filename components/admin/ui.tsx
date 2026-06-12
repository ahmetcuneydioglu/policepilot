"use client";

/**
 * Command Center ortak UI parçaları — Stripe/Linear/Vercel tasarım dili.
 * Tüm admin sayfaları bu primitifleri kullanır (tutarlılık + mobil taşınabilirlik).
 */

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} gün önce`;
  return fmtDate(iso);
}

// ─── Sayfa başlığı ────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, Icon, actions }: {
  title: string; subtitle?: string; Icon: LucideIcon; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

// ─── KPI kartı ────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, Icon, tone = "slate", index = 0 }: {
  label: string; value: string; sub?: string; Icon?: LucideIcon;
  tone?: "indigo" | "emerald" | "violet" | "amber" | "rose" | "blue" | "slate";
  index?: number;
}) {
  const tones: Record<string, { ring: string; icon: string; val: string }> = {
    indigo:  { ring: "ring-indigo-100",  icon: "bg-indigo-500",  val: "text-indigo-700" },
    emerald: { ring: "ring-emerald-100", icon: "bg-emerald-500", val: "text-emerald-700" },
    violet:  { ring: "ring-violet-100",  icon: "bg-violet-500",  val: "text-violet-700" },
    amber:   { ring: "ring-amber-100",   icon: "bg-amber-500",   val: "text-amber-700" },
    rose:    { ring: "ring-rose-100",    icon: "bg-rose-500",    val: "text-rose-700" },
    blue:    { ring: "ring-blue-100",    icon: "bg-blue-500",    val: "text-blue-700" },
    slate:   { ring: "ring-slate-100",   icon: "bg-slate-600",   val: "text-slate-800" },
  };
  const t = tones[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`bg-white rounded-2xl border border-slate-200/80 ring-1 ${t.ring} shadow-sm p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg ${t.icon} flex items-center justify-center shadow-sm flex-shrink-0`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold leading-none tracking-tight ${t.val}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>}
    </motion.div>
  );
}

// ─── Bölüm kartı ──────────────────────────────────────────────────────────────

export function SectionCard({ title, subtitle, children, actions, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Durum noktası (sağlık) ───────────────────────────────────────────────────

export function StatusDot({ status }: { status: "ok" | "warn" | "down" | "off" }) {
  const cls = {
    ok:   "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    warn: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    down: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse",
    off:  "bg-slate-300",
  }[status];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

// ─── Plan rozeti ──────────────────────────────────────────────────────────────

export function PlanBadge({ plan }: { plan: string }) {
  const cls: Record<string, string> = {
    starter:    "bg-slate-100 text-slate-600 ring-slate-200",
    pro:        "bg-indigo-50 text-indigo-700 ring-indigo-200",
    enterprise: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 capitalize ${cls[plan] ?? cls.starter}`}>
      {plan}
    </span>
  );
}

// ─── Yükleme iskeleti ─────────────────────────────────────────────────────────

export function LoadingGrid({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4">
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {[...Array(cols)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" style={{ animationDelay: `${(cols + i) * 60}ms` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
      ⚠️ {message}
    </div>
  );
}
