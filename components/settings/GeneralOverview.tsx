"use client";

/**
 * Genel Bakış — Ayarlar Merkezi landing. "Buradan şirketimi yönetiyorum" hissi.
 * Acente kimliği + hızlı kısayollar + teklif linki + kullanım özeti.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import type { LucideIcon } from "lucide-react";
import { Building2, Users, MessageCircle, CreditCard, Link2, Copy, Check, ArrowRight } from "lucide-react";
import UsageLimits from "@/components/UsageLimits";
import { PLAN_LABELS } from "@/lib/planPricing";
import type { PermissionKey } from "@/lib/permissions";
import type { SectionKey } from "./sections";

type Agency = { name: string; slug: string; plan: string; primary_color: string | null };

export default function GeneralOverview({ onNavigate, can }: {
  onNavigate: (k: SectionKey) => void;
  can: (perm: PermissionKey) => boolean;
}) {
  const { profile } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch("/api/agency/profile").then((r) => r.json()).then((j) => { if (j?.agency) setAgency(j.agency); }).catch(() => {});
  }, []);

  const color = agency?.primary_color ?? "#4f46e5";
  const teklifLink = agency?.slug ? `${origin}/a/${agency.slug}/teklif-al` : "";

  const allShortcuts: { key: SectionKey; label: string; desc: string; Icon: LucideIcon; perm?: PermissionKey }[] = [
    { key: "sirket",       label: "Şirket Bilgileri", desc: "Profil, vergi no, adres", Icon: Building2 },
    { key: "kullanicilar", label: "Kullanıcılar",     desc: "Ekip ve yetkiler",       Icon: Users, perm: "users.manage" },
    { key: "whatsapp",     label: "WhatsApp",         desc: "Bildirim tercihleri",    Icon: MessageCircle, perm: "settings.manage" },
    { key: "paketim",      label: "Paketim",          desc: "Plan ve kullanım",       Icon: CreditCard },
  ];
  const shortcuts = allShortcuts.filter((s) => !s.perm || can(s.perm));

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-md"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc 60%, #1e1b4b)` }}>
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-1">Yönetim Merkezi</p>
          <h2 className="text-2xl font-extrabold leading-tight">{agency?.name ?? "Acenteniz"}</h2>
          <p className="text-white/75 text-sm mt-1">
            Merhaba {profile?.full_name?.split(" ")[0] ?? "👋"}, şirketinizi buradan yönetin.
            {agency && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-white/15 text-[11px] font-bold">{PLAN_LABELS[agency.plan] ?? "Starter"} Paket</span>}
          </p>
        </div>
      </div>

      {/* Hızlı kısayollar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shortcuts.map((s) => (
          <button key={s.key} onClick={() => onNavigate(s.key)}
            className="group flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left hover:shadow-md hover:border-indigo-200 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
              <s.Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">{s.label}</p>
              <p className="text-[11px] text-slate-400">{s.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      {/* Teklif linki */}
      {teklifLink && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-bold text-slate-800">Müşteri Teklif Linkiniz</p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
            <span className="flex-1 text-xs font-mono text-blue-900 truncate">{teklifLink}</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(teklifLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-emerald-100 text-emerald-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
              {copied ? <><Check className="w-3.5 h-3.5" /> Kopyalandı</> : <><Copy className="w-3.5 h-3.5" /> Kopyala</>}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Bu linki müşterilerinizle paylaşın; doldurulan her form size iletilir.</p>
        </div>
      )}

      {/* Kullanım özeti */}
      <UsageLimits />
    </div>
  );
}
