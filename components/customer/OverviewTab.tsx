"use client";

import Link from "next/link";
import { Zap, FileText, Phone, TrendingUp, Wallet, ShieldCheck, CalendarClock } from "lucide-react";
import type { CustomerBundle } from "./types";
import { fmtMoney, fmtDate, waPhone } from "./types";

const WA_SVG = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function OverviewTab({ data }: { data: CustomerBundle }) {
  const { customer, stats } = data;
  const extra = customer.extra_data ?? {};

  const infoRows: [string, string][] = [
    ["Ad Soyad",            customer.name],
    ["Telefon",             customer.phone || "—"],
    ["E-posta",             customer.email || "—"],
    ["TC / VKN",            customer.identity_no || extra.tc_identity_no || extra.tax_no || "—"],
    ["Adres",               extra.address || "—"],
    ["Müşteri Olma Tarihi", fmtDate(customer.created_at)],
  ];

  const statCards = [
    { label: "Toplam Prim",        value: fmtMoney(stats.total_premium),     Icon: Wallet,        cls: "from-blue-50 to-indigo-100/60 ring-blue-200/60",       iconBg: "bg-blue-500",    val: "text-blue-700" },
    { label: "Toplam Komisyon",    value: fmtMoney(stats.total_commission),  Icon: TrendingUp,    cls: "from-violet-50 to-purple-100/60 ring-violet-200/60",   iconBg: "bg-violet-500",  val: "text-violet-700" },
    { label: "Aktif Poliçe",       value: String(stats.active_policies),     Icon: ShieldCheck,   cls: "from-emerald-50 to-teal-100/60 ring-emerald-200/60",   iconBg: "bg-emerald-500", val: "text-emerald-700" },
    { label: "Yaklaşan Yenileme",  value: String(stats.upcoming_renewals),   Icon: CalendarClock, cls: "from-amber-50 to-orange-100/60 ring-amber-200/60",     iconBg: "bg-amber-500",   val: "text-amber-700" },
  ];

  return (
    <div className="space-y-5">

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(c => (
          <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.cls} ring-1 p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center mb-3 shadow-sm`}>
              <c.Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{c.label}</p>
            <p className={`text-xl font-bold mt-1.5 leading-none ${c.val}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Müşteri bilgileri */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Müşteri Bilgileri</p>
          </div>
          <div className="divide-y divide-slate-50">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-slate-400 font-medium w-36 shrink-0">{k}</span>
                <span className="text-sm text-slate-800 font-medium text-right truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hızlı aksiyonlar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Hızlı Aksiyonlar</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href="/quote-center/new"
              className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm shadow-violet-500/20"
            >
              <Zap className="w-4 h-4" /> Yeni Teklif
            </Link>
            <Link
              href="/policies"
              className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-sm shadow-blue-500/20"
            >
              <FileText className="w-4 h-4" /> Yeni Poliçe
            </Link>
            {customer.phone ? (
              <a
                href={`https://wa.me/${waPhone(customer.phone)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20"
              >
                {WA_SVG} WhatsApp Gönder
              </a>
            ) : (
              <span className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-100 text-slate-300 text-sm font-bold cursor-not-allowed">
                {WA_SVG} WhatsApp Gönder
              </span>
            )}
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-all shadow-sm"
              >
                <Phone className="w-4 h-4" /> Ara
              </a>
            ) : (
              <span className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-100 text-slate-300 text-sm font-bold cursor-not-allowed">
                <Phone className="w-4 h-4" /> Ara
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
