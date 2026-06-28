"use client";

/**
 * Genel Bakış — Müşteri Operasyon Merkezi ana sekmesi.
 * AI özeti, müşteri değeri skoru, sonraki aksiyon, son iletişim,
 * istatistikler, bilgiler, hızlı aksiyonlar ve çapraz satış fırsatları.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Zap, FileText, Phone, TrendingUp, Wallet, ShieldCheck, CalendarClock,
  Sparkles, MessageCircle, StickyNote, FolderUp, RefreshCw, LayoutGrid,
  ChevronRight, Clock, Car, Save,
} from "lucide-react";
import type { CustomerBundle } from "./types";
import { fmtMoney, fmtDate, waPhone } from "./types";

const WA_SVG = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const GRADE_CLS: Record<string, { ring: string; bg: string; text: string }> = {
  "A+":   { ring: "ring-emerald-200", bg: "from-emerald-500 to-teal-600",   text: "text-emerald-700" },
  "A":    { ring: "ring-blue-200",    bg: "from-blue-500 to-indigo-600",    text: "text-blue-700" },
  "B":    { ring: "ring-amber-200",   bg: "from-amber-500 to-orange-600",   text: "text-amber-700" },
  "C":    { ring: "ring-slate-200",   bg: "from-slate-500 to-slate-700",    text: "text-slate-600" },
  "Yeni": { ring: "ring-violet-200",  bg: "from-violet-500 to-purple-600",  text: "text-violet-700" },
};

const NEXT_ACTION_STYLE: Record<string, { emoji: string; cls: string }> = {
  renewal:    { emoji: "🔄", cls: "border-amber-200 bg-gradient-to-r from-amber-50/80 to-orange-50/50" },
  quote:      { emoji: "⚡", cls: "border-violet-200 bg-gradient-to-r from-violet-50/80 to-purple-50/50" },
  document:   { emoji: "📎", cls: "border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50" },
  cross_sell: { emoji: "💰", cls: "border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/50" },
  idle:       { emoji: "✅", cls: "border-slate-200 bg-slate-50/60" },
};

export default function OverviewTab({
  data,
  onNavigate,
}: {
  data: CustomerBundle;
  onNavigate: (tab: string) => void;
}) {
  const { customer, stats, insights } = data;
  const extra = customer.extra_data ?? {};
  const grade = GRADE_CLS[insights.score.grade] ?? GRADE_CLS["Yeni"];
  const na    = insights.next_action;
  const naStyle = NEXT_ACTION_STYLE[na.type] ?? NEXT_ACTION_STYLE.idle;

  // Araç muayene — self-contained düzenleme (PATCH /api/customers/[id])
  const [muayene, setMuayene] = useState(customer.muayene_bitis ?? "");
  const [savingM, setSavingM] = useState(false);
  const [savedM, setSavedM]   = useState(false);

  async function saveMuayene() {
    setSavingM(true); setSavedM(false);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muayene_bitis: muayene || null }),
      });
      if (res.ok) setSavedM(true);
    } finally {
      setSavingM(false);
    }
  }

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

  // Sonraki aksiyon CTA hedefi
  const naHref =
    na.type === "renewal" && na.ref_id ? `/renewals/quote/${na.ref_id}` :
    na.type === "quote"   && na.ref_id ? `/quote-center/${na.ref_id}` :
    null;

  return (
    <div className="space-y-4">

      {/* ══ AI Özeti + Müşteri Değeri ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* AI Müşteri Özeti */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-5">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-sm font-semibold text-white">AI Müşteri Özeti</p>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-bold">
                Kural motoru — AI hazır
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6">
              {insights.ai_summary.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-blue-200 leading-relaxed">
                  <span className="text-emerald-400 flex-shrink-0 mt-px">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Müşteri Değeri Skoru */}
        <div className={`rounded-2xl bg-white border border-slate-200 ring-1 ${grade.ring} shadow-sm p-5 flex flex-col`}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Müşteri Değeri</p>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${grade.bg} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-black text-white">{insights.score.grade}</span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-slate-400">Toplam Prim: <b className={grade.text}>{fmtMoney(stats.total_premium)}</b></p>
              <p className="text-slate-400">Komisyon: <b className={grade.text}>{fmtMoney(stats.total_commission)}</b></p>
              <p className="text-slate-400">Aktif Poliçe: <b className={grade.text}>{stats.active_policies}</b></p>
            </div>
          </div>
          <p className="mt-auto pt-3 text-[10px] text-slate-300">İleride AI skorlamasına dönüşecek</p>
        </div>
      </div>

      {/* ══ Sonraki Aksiyon + Son İletişim ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sonraki Aksiyon */}
        <div className={`rounded-2xl border-2 p-4 ${naStyle.cls}`}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sonraki Aksiyon</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl">{naStyle.emoji}</span>
            <div className="flex-1 min-w-[140px]">
              <p className="text-sm font-bold text-slate-900">{na.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{na.detail}</p>
            </div>
            {naHref ? (
              <Link href={naHref} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">
                İşleme Git <ChevronRight className="w-3.5 h-3.5 -mr-1" />
              </Link>
            ) : na.type === "document" ? (
              <button onClick={() => onNavigate("documents")} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">
                Evraklara Git <ChevronRight className="w-3.5 h-3.5 -mr-1" />
              </button>
            ) : na.type === "cross_sell" ? (
              <a href="#cross-sell" className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm">
                Fırsatları Gör <ChevronRight className="w-3.5 h-3.5 -mr-1" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Son İletişim */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Son İletişim</p>
          {insights.last_contact ? (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{fmtDate(insights.last_contact.date)}</p>
                <p className="text-xs text-slate-500">{insights.last_contact.label}</p>
                {customer.note && (
                  <p className="text-[11px] text-slate-400 mt-1.5 italic truncate">
                    Son Not: &ldquo;{customer.note}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">Henüz iletişim kurulmadı</p>
                {customer.note
                  ? <p className="text-[11px] text-slate-400 mt-1.5 italic">Son Not: &ldquo;{customer.note}&rdquo;</p>
                  : <p className="text-xs text-slate-400 mt-0.5">WhatsApp veya arama ile ilk teması kurun</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ İstatistik kartları ══ */}
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

      {/* ══ Araç Muayene ══ */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
            <Car className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Araç Muayene</p>
            <p className="text-[11px] text-slate-400">TÜVTÜRK muayene bitiş tarihi — hatırlatma için kullanılır</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="date"
            value={muayene}
            onChange={(e) => { setMuayene(e.target.value); setSavedM(false); }}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
          <button
            onClick={saveMuayene}
            disabled={savingM}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" /> {savingM ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {savedM && <span className="text-xs font-semibold text-emerald-600">✓ Kaydedildi</span>}
          {muayene && <span className="text-[11px] text-slate-400 ml-auto">Muayene: <b className="text-slate-700">{fmtDate(muayene)}</b></span>}
        </div>
        {customer.muayene_tahmini && !savedM && (
          <p className="mt-2.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            ⚠️ Bu tarih model yılından <b>tahmin</b> edildi. Müşteriyle görüşüp kesin muayene tarihini girin (kaydedince tahmini işareti kalkar).
          </p>
        )}
      </div>

      {/* ══ Bilgiler + Hızlı Aksiyonlar ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Hızlı Aksiyonlar</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/quote-center/new"
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm shadow-violet-500/20">
              <Zap className="w-4 h-4" /> Yeni Teklif
            </Link>
            <Link href="/policies"
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-sm shadow-blue-500/20">
              <FileText className="w-4 h-4" /> Yeni Poliçe
            </Link>
            {customer.phone ? (
              <a href={`https://wa.me/${waPhone(customer.phone)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20">
                {WA_SVG} WhatsApp
              </a>
            ) : (
              <span className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-slate-100 text-slate-300 text-xs font-bold cursor-not-allowed">{WA_SVG} WhatsApp</span>
            )}
            {customer.phone ? (
              <a href={`tel:${customer.phone}`}
                className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-all shadow-sm">
                <Phone className="w-4 h-4" /> Ara
              </a>
            ) : (
              <span className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-slate-100 text-slate-300 text-xs font-bold cursor-not-allowed"><Phone className="w-4 h-4" /> Ara</span>
            )}
            <button onClick={() => onNavigate("renewals")}
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-xs font-bold hover:bg-amber-100 transition-all">
              <RefreshCw className="w-4 h-4" /> Yenileme Başlat
            </button>
            <button onClick={() => onNavigate("documents")}
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-200 text-xs font-bold hover:bg-blue-100 transition-all">
              <FolderUp className="w-4 h-4" /> Evrak Yükle
            </button>
            <button onClick={() => onNavigate("notes")}
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-orange-50 text-orange-700 ring-1 ring-orange-200 text-xs font-bold hover:bg-orange-100 transition-all">
              <StickyNote className="w-4 h-4" /> Not Ekle
            </button>
            <Link href="/quote-center"
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-200 text-xs font-bold hover:bg-violet-100 transition-all">
              <LayoutGrid className="w-4 h-4" /> Teklif Merkezi
            </Link>
          </div>
        </div>
      </div>

      {/* ══ Çapraz Satış Fırsatları ══ */}
      {insights.cross_sell.length > 0 && (
        <div id="cross-sell" className="rounded-2xl border-2 border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-cyan-50/50 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Çapraz Satış Fırsatları</p>
                <p className="text-[11px] text-slate-400">Mevcut ürünlere göre önerilen sigortalar</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-700 shadow-sm">
              Toplam Potansiyel: {fmtMoney(insights.cross_sell_total)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {insights.cross_sell.map(cs => (
              <div key={cs.type} className="bg-white/85 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-emerald-200/60 hover:shadow-md transition-all flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cs.emoji}</span>
                  <p className="text-xs font-bold text-slate-800 leading-tight">{cs.label}</p>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">Tahmini prim: <b className="text-emerald-600">{fmtMoney(cs.est_value)}</b></p>
                <Link
                  href="/quote-center/new"
                  className="mt-auto inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm"
                >
                  <Zap className="w-3 h-3" /> Teklif Oluştur
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
