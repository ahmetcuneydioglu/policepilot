"use client";

/**
 * Platform Ayarları — yönetim araçlarına merkezi erişim.
 */

import Link from "next/link";
import { Settings, MessageCircle, Stethoscope, LayoutGrid, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";

const TOOLS = [
  {
    href: "/settings/whatsapp",
    title: "WhatsApp Platform Yönetimi",
    desc: "Meta Cloud API, token yönetimi (60 güne uzatma), test modu, test gönderimi",
    Icon: MessageCircle, tone: "from-emerald-500 to-green-600",
  },
  {
    href: "/api/whatsapp/meta-diag",
    title: "Meta Tanı Aracı",
    desc: "Token + Phone Number ID doğrulaması, hello_world şablon testi (?send=1)",
    Icon: Stethoscope, tone: "from-blue-500 to-indigo-600",
  },
  {
    href: "/dashboard",
    title: "Acente CRM Görünümü",
    desc: "Platformu bir acente gözünden incele (dashboard, müşteriler, poliçeler)",
    Icon: LayoutGrid, tone: "from-violet-500 to-purple-600",
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Platform Ayarları" subtitle="Yönetim araçları ve yapılandırma" Icon={Settings} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map(t => (
          <Link key={t.href} href={t.href}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.tone} flex items-center justify-center shadow-md mb-3`}>
              <t.Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
              {t.title}
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-slate-400">
        Plan fiyatlandırması <code className="bg-slate-100 px-1 rounded">lib/planPricing.ts</code> dosyasından,
        Meta kimlik bilgileri platform_settings tablosundan yönetilir.
      </p>
    </div>
  );
}
