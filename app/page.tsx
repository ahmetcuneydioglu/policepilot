"use client";

import { useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Car, Shield, Heart, FileText, Globe, Plane,
  Stethoscope, Building2, Home, Activity, PawPrint, Smartphone,
  MessageCircle, Bell, LayoutGrid, Lock, ChevronDown,
  ArrowRight, Phone, ShieldCheck, Zap, Users, TrendingUp,
  Clock, Star, BadgeCheck, Sparkles, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type IconComp = ComponentType<{ className?: string }>;

type ProductItem = {
  slug: string;
  label: string;
  Icon: IconComp;
  desc: string;
  tag: string;
  tagCls: string;
  iconBg: string;
  iconColor: string;
  isNew?: boolean;
};

type AdvantageItem = {
  Icon: IconComp;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
};

type StatItem = {
  Icon: IconComp;
  value: string;
  label: string;
  sub: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const PRODUCTS: ProductItem[] = [
  {
    slug: "trafik",
    label: "Trafik Sigortası",
    Icon: Car,
    desc: "Üçüncü şahıs zararlarına güvence",
    tag: "Zorunlu",
    tagCls: "bg-red-50 text-red-600 border-red-100",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    slug: "kasko",
    label: "Kasko",
    Icon: Shield,
    desc: "Tam araç koruma paketi",
    tag: "En Çok Tercih",
    tagCls: "bg-blue-50 text-blue-700 border-blue-100",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-700",
  },
  {
    slug: "tamamlayici-saglik",
    label: "Tamamlayıcı Sağlık",
    Icon: Heart,
    desc: "SGK güvencenizi destekler",
    tag: "SGK Destekli",
    tagCls: "bg-emerald-50 text-emerald-700 border-emerald-100",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    slug: "imm",
    label: "İMM",
    Icon: FileText,
    desc: "Üst tazminat güvencesi",
    tag: "Profesyonel",
    tagCls: "bg-violet-50 text-violet-700 border-violet-100",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    slug: "yesil-kart",
    label: "Yeşil Kart",
    Icon: Globe,
    desc: "Avrupa&apos;da tam güvence",
    tag: "Yurt Dışı",
    tagCls: "bg-sky-50 text-sky-700 border-sky-100",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    slug: "seyahat-saglik",
    label: "Seyahat Sağlık",
    Icon: Plane,
    desc: "Acil sağlık güvencesi",
    tag: "Yurt Dışı",
    tagCls: "bg-sky-50 text-sky-700 border-sky-100",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-700",
  },
  {
    slug: "ozel-saglik",
    label: "Özel Sağlık",
    Icon: Stethoscope,
    desc: "Özel hastane erişimi",
    tag: "Kapsamlı",
    tagCls: "bg-emerald-50 text-emerald-700 border-emerald-100",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
  },
  {
    slug: "dask",
    label: "DASK",
    Icon: Building2,
    desc: "Zorunlu deprem sigortası",
    tag: "Zorunlu",
    tagCls: "bg-red-50 text-red-600 border-red-100",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    slug: "konut",
    label: "Konut Sigortası",
    Icon: Home,
    desc: "Yangın, hırsızlık, su baskını",
    tag: "Ev Güvencesi",
    tagCls: "bg-amber-50 text-amber-700 border-amber-100",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
  },
  {
    slug: "ferdi-kaza",
    label: "Ferdi Kaza",
    Icon: Activity,
    desc: "Kaza güvencesi, sakatlık teminatı",
    tag: "Bireysel",
    tagCls: "bg-violet-50 text-violet-700 border-violet-100",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    slug: "evcil-hayvan",
    label: "Evcil Hayvan",
    Icon: PawPrint,
    desc: "Veteriner masrafı güvencesi",
    tag: "Yeni",
    tagCls: "bg-pink-50 text-pink-600 border-pink-100",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    isNew: true,
  },
  {
    slug: "cep-telefonu",
    label: "Cep Telefonu",
    Icon: Smartphone,
    desc: "Kırılma, çalınma, su hasarı",
    tag: "Yeni",
    tagCls: "bg-pink-50 text-pink-600 border-pink-100",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    isNew: true,
  },
];

// Demo marketing numbers — update with real data in production
const STATS: StatItem[] = [
  { Icon: Users,       value: "12.000+",   label: "Mutlu Müşteri",    sub: "aktif kullanıcı" },
  { Icon: TrendingUp,  value: "50.000+",   label: "Teklif Talebi",    sub: "tamamlandı" },
  { Icon: Star,        value: "30+",        label: "Sigorta Şirketi",  sub: "iş ortağı" },
  { Icon: Clock,       value: "15 dk.",     label: "Ortalama Yanıt",   sub: "çalışma saatlerinde" },
];

const ADVANTAGES: AdvantageItem[] = [
  {
    Icon: Zap,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    title: "Tek form ile hızlı teklif",
    desc: "Bilgilerinizi bir kez girin, uzman acentemiz en uygun teklifleri derlesin.",
  },
  {
    Icon: MessageCircle,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "WhatsApp'tan hızlı dönüş",
    desc: "Acentemiz çalışma saatlerinde ortalama 15 dakika içinde WhatsApp'tan size ulaşır.",
  },
  {
    Icon: Bell,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Yenilemeleri kaçırmayın",
    desc: "Poliçe bitiş tarihleriniz takip edilir, zamanında hatırlatılırsınız.",
  },
  {
    Icon: LayoutGrid,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "Her sigorta, tek ekran",
    desc: "Trafik, kasko, sağlık, konut ve DASK için ayrı site aramanıza gerek yok.",
  },
];

const INSURERS = [
  { name: "Allianz",          abbr: "AL", color: "bg-blue-600" },
  { name: "Anadolu Sigorta",  abbr: "AN", color: "bg-indigo-600" },
  { name: "Aksigorta",        abbr: "AK", color: "bg-red-600" },
  { name: "Türkiye Sigorta",  abbr: "TS", color: "bg-emerald-600" },
  { name: "HDI Sigorta",      abbr: "HD", color: "bg-amber-600" },
  { name: "Sompo Sigorta",    abbr: "SO", color: "bg-orange-500" },
  { name: "Zurich",           abbr: "ZR", color: "bg-sky-600" },
  { name: "Mapfre",           abbr: "MP", color: "bg-red-700" },
  { name: "Ray Sigorta",      abbr: "RS", color: "bg-purple-600" },
  { name: "Quick Sigorta",    abbr: "QS", color: "bg-cyan-600" },
  { name: "Neova Sigorta",    abbr: "NE", color: "bg-teal-600" },
  { name: "Generali",         abbr: "GN", color: "bg-rose-600" },
];

const FAQS = [
  {
    q: "Teklif almak ücretli mi?",
    a: "Hayır. PoliçePilot üzerinden teklif almak tamamen ücretsizdir. Herhangi bir ücret talep edilmez.",
  },
  {
    q: "Bilgilerim güvende mi?",
    a: "Bilgileriniz KVKK kapsamında korunur ve yalnızca size teklif sunmak amacıyla kullanılır. Üçüncü taraflara satılmaz.",
  },
  {
    q: "Poliçe kesimi otomatik mi?",
    a: "Hayır. Teklif talebiniz acentemize iletilir. Poliçe kesilmeden önce acentemiz WhatsApp üzerinden sizinle iletişime geçer ve onayınızı alır.",
  },
  {
    q: "Acentem bu sistemi kullanabilir mi?",
    a: "Evet. PoliçePilot, sigorta acenteleri için müşteri ve poliçe yönetim paneli sunar. Demo için bize ulaşın.",
  },
];

const HOW_STEPS = [
  { n: "01", title: "Ürünü seç",           desc: "İlgilendiğiniz sigorta türünü listeden seçin." },
  { n: "02", title: "Formu doldur",         desc: "Birkaç temel bilgi girin. İki dakika yeter." },
  { n: "03", title: "Acenteye iletilir",    desc: "Formunuz anında uzman acentemize iletilir." },
  { n: "04", title: "WhatsApp'tan dönüş",   desc: "Çalışma saatlerinde 15 dk. içinde size ulaşılır." },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-200">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-[17px] tracking-tight">PoliçePilot</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {[
                { label: "Ürünlerimiz",      href: "#urunler" },
                { label: "Kampanyalar",       href: "#avantajlar" },
                { label: "Poliçe İşlemleri", href: "/dashboard" },
                { label: "Bilgi Merkezi",     href: "#sss" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="px-3.5 py-2 text-sm text-slate-500 hover:text-slate-900 rounded-lg hover:bg-gray-50 transition-all font-medium"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Right */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <a href="tel:08500000000" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">
                <Phone className="w-3.5 h-3.5 text-blue-500" />
                0850 000 00 00
              </a>
              <div className="w-px h-4 bg-gray-200" />
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Giriş Yap
              </Link>
            </div>

            {/* Mobile burger */}
            <button
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menü"
            >
              {menuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-0.5">
            {[
              { label: "Ürünlerimiz",      href: "#urunler" },
              { label: "Kampanyalar",       href: "#avantajlar" },
              { label: "Poliçe İşlemleri", href: "/dashboard" },
              { label: "Bilgi Merkezi",     href: "#sss" },
            ].map((item) => (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-gray-50">
                {item.label}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between">
              <a href="tel:08500000000" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Phone className="w-3.5 h-3.5 text-blue-500" /> 0850 000 00 00
              </a>
              <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm">
                Giriş Yap
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-white pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        {/* Gradient blobs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

            {/* ── Left ── */}
            <div className="flex-1 text-center lg:text-left">
              {/* Badge pill */}
              <div className="inline-flex items-center gap-2 bg-white border border-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-xs font-semibold mb-7 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Türkiye&apos;nin sigorta marketplace&apos;i
              </div>

              <h1 className="text-[2.6rem] sm:text-5xl lg:text-[3.25rem] font-extrabold text-slate-900 leading-[1.12] tracking-tight mb-5">
                Sigortanda doğru
                <br className="hidden sm:block" />
                <span className="text-blue-600"> seçimi yap,</span>
                <br className="hidden sm:block" />
                güvenle korun.
              </h1>

              <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                30&apos;a yakın sigorta şirketinden en uygun teklifi al.
                Uzman acentemiz WhatsApp&apos;tan 15 dakikada döner.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-9">
                <Link
                  href="/teklif-al"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5"
                >
                  Hemen Teklif Al
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#nasil-calisir"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-slate-700 text-sm font-semibold rounded-xl border border-gray-200 hover:border-blue-200 hover:text-blue-700 transition-all"
                >
                  Nasıl Çalışır?
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start">
                {[
                  { Icon: Lock,        label: "256-bit SSL" },
                  { Icon: MessageCircle, label: "WhatsApp Destekli" },
                  { Icon: BadgeCheck,  label: "KVKK Uyumlu" },
                  { Icon: Zap,         label: "15 dk Yanıt" },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Icon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Dashboard mockup ── */}
            <div className="flex-shrink-0 w-full max-w-[360px] lg:max-w-[400px] relative mt-8 lg:mt-0">
              {/* Stat badge – top right */}
              <div className="absolute -top-5 -right-3 sm:-right-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl px-3.5 py-2.5 shadow-lg shadow-blue-300/40 z-20">
                <p className="text-sm font-extrabold leading-none">12.000+</p>
                <p className="text-[10px] text-blue-200 mt-0.5 font-medium">Mutlu Müşteri</p>
              </div>

              {/* Main dashboard card */}
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 relative z-10">
                {/* Card header */}
                <div className="flex items-center gap-2 mb-4 pb-3.5 border-b border-gray-50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-xs text-slate-600 font-semibold flex-1">Teklif Talebiniz Alındı</span>
                  <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-100">
                    Aktif
                  </span>
                </div>

                {/* Quote rows */}
                <div className="space-y-2 mb-4">
                  {[
                    { abbr: "AL", name: "Allianz",          price: "₺1.890", yil: "/ yıl", color: "bg-blue-600",    best: false },
                    { abbr: "AK", name: "Aksigorta",        price: "₺2.140", yil: "/ yıl", color: "bg-red-500",     best: false },
                    { abbr: "TS", name: "Türkiye Sigorta",  price: "₺1.750", yil: "/ yıl", color: "bg-emerald-600", best: true  },
                  ].map(({ abbr, name, price, yil, color, best }) => (
                    <div
                      key={abbr}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${best ? "bg-blue-50/60 border-blue-100" : "bg-gray-50/80 border-gray-100"}`}
                    >
                      <div className={`w-8 h-8 rounded-xl ${color} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        {abbr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
                        <p className="text-[10px] text-gray-400">Trafik Sigortası</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${best ? "text-blue-700" : "text-slate-700"}`}>{price}</p>
                        <p className="text-[10px] text-gray-400">{yil}</p>
                      </div>
                      {best && (
                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
                          En İyi
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <button className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-200 hover:from-blue-700 hover:to-blue-800 transition-all">
                  En İyi Teklifi Seç →
                </button>
              </div>

              {/* WhatsApp bubble – bottom left */}
              <div className="absolute -bottom-6 -left-4 sm:-left-8 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-start gap-2.5 max-w-[200px] z-20">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-800">PoliçePilot Acente</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">Teklifinizi hazırladım! İnceleyebilirsiniz 🎉</p>
                  <p className="text-[9px] text-gray-400 mt-1">Az önce</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PRODUCTS ════════════════════════════════════════════════════════ */}
      <section id="urunler" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              Sigorta Ürünlerimiz
            </h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              14 farklı sigorta ürünü — tek formdan teklif alın.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {PRODUCTS.map((p) => (
              <Link
                key={p.slug}
                href={`/teklif-al/${p.slug}`}
                className="group relative flex flex-col gap-3.5 bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-[0_8px_32px_rgba(59,130,246,0.12)] transition-all duration-300 hover:-translate-y-1"
              >
                {p.isNew && (
                  <span className="absolute top-3 right-3 bg-pink-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    Yeni
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl ${p.iconBg} ${p.iconColor} flex items-center justify-center flex-shrink-0`}>
                  <p.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors mb-1">
                    {p.label}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.tagCls}`}>
                    {p.tag}
                  </span>
                  <span className="text-[11px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Teklif Al <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/teklif-al"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors"
            >
              Tüm ürünleri kategoriye göre gör
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ STATS ═══════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        />
        <div className="absolute -top-32 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              PoliçePilot ile sigorta süreçleri daha kolay
            </h2>
            <p className="text-blue-400 text-sm">Rakamlar konuşuyor</p>
          </div>

          {/* Demo marketing numbers — update with real data */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/[0.12] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <s.Icon className="w-5 h-5 text-blue-300" />
                </div>
                <p className="text-3xl font-extrabold text-white mb-1 tracking-tight">{s.value}</p>
                <p className="text-sm font-semibold text-blue-100 mb-0.5">{s.label}</p>
                <p className="text-[11px] text-blue-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ADVANTAGES ══════════════════════════════════════════════════════ */}
      <section id="avantajlar" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              Neden PoliçePilot?
            </h2>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Sigorta sürecini en başından sonuna kolaylaştırmak için tasarlandı.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ADVANTAGES.map((a) => (
              <div
                key={a.title}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${a.iconBg} ${a.iconColor} flex items-center justify-center mb-5`}>
                  <a.Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2 text-sm leading-snug">{a.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ INSURERS ════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              30&apos;a yakın sigorta şirketinden teklif
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Türkiye&apos;nin önde gelen sigorta şirketlerinin tekliflerini karşılaştırın.
            </p>
          </div>

          {/* Logo pill grid — replace with real brand assets when available */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {INSURERS.map((ins) => (
              <div
                key={ins.name}
                className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3.5 py-3 hover:border-gray-200 hover:shadow-sm transition-all cursor-default group"
              >
                <div className={`w-8 h-8 rounded-lg ${ins.color} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  {ins.abbr}
                </div>
                <span className="text-xs font-semibold text-slate-600 truncate group-hover:text-slate-800 transition-colors">
                  {ins.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section id="nasil-calisir" className="py-20 bg-slate-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">Nasıl Çalışır?</h2>
            <p className="text-slate-500 text-sm">Dört adımda sigortanı yaptır.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} className="relative text-center">
                {/* Connector */}
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[58%] w-[84%] h-px bg-gradient-to-r from-blue-200 to-transparent" />
                )}
                <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white items-center justify-center font-bold text-sm mb-4 shadow-lg shadow-blue-200/60 relative z-10">
                  {step.n}
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[160px] mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/teklif-al"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:-translate-y-0.5"
            >
              Hemen Teklif Al
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FAQ ═════════════════════════════════════════════════════════════ */}
      <section id="sss" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-12 tracking-tight">
            Sıkça Sorulan Sorular
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-colors">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
                >
                  <span className="font-semibold text-slate-800 text-sm">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute -top-32 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Teklif almak ücretsiz ve hızlı.
          </h2>
          <p className="text-blue-200 mb-8 leading-relaxed text-sm max-w-md mx-auto">
            Formu doldurun, uzman acentemiz WhatsApp&apos;tan 15 dakika içinde size ulaşsın.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/teklif-al"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-xl hover:-translate-y-0.5"
            >
              Teklif Al
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/905551234567"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp&apos;tan Yaz
            </a>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">

            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-sm">PoliçePilot</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 max-w-[180px]">
                Türkiye&apos;nin sigorta acenteleri için geliştirilmiş teklif ve müşteri yönetim platformu.
              </p>
            </div>

            {/* Ürünler */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Ürünler</p>
              <ul className="space-y-2.5 text-xs">
                {["Trafik Sigortası", "Kasko", "DASK", "Konut Sigortası", "Sağlık"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kurumsal */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Kurumsal</p>
              <ul className="space-y-2.5 text-xs">
                {["Hakkımızda", "Kariyer", "Blog", "Basın"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Yardım */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Yardım</p>
              <ul className="space-y-2.5 text-xs">
                {["SSS", "KVKK", "Gizlilik Politikası", "Kullanım Koşulları"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* İletişim */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">İletişim</p>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <a href="tel:08500000000" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Phone className="w-3 h-3" /> 0850 000 00 00
                  </a>
                </li>
                <li>
                  <a href="mailto:info@policepilot.com" className="hover:text-white transition-colors">
                    info@policepilot.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/905551234567"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp Destek
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p className="text-slate-500">© 2026 PoliçePilot. Tüm hakları saklıdır.</p>
            <Link href="/demo" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
              Acente Demo Paneli <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
