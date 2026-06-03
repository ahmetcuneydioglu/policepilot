"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronDown, ChevronRight,
  Users, FileText, Clock, MessageSquare, Zap, BarChart3,
  Shield, ShieldCheck, Sparkles, Star, TrendingUp,
  Building2, Bot, Search,
} from "lucide-react";

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: FileText,
    color: "bg-blue-50 text-blue-600",
    title: "Teklif Yönetimi",
    desc: "Müşteri teklif formları acente bağlantınızdan gelir. Yeni talepler anında bildirim ve WhatsApp toast olarak görünür.",
  },
  {
    icon: Users,
    color: "bg-indigo-50 text-indigo-600",
    title: "Müşteri Yönetimi",
    desc: "Tüm müşteri profillerini, iletişim geçmişini ve sigortalarını tek ekranda yönetin.",
  },
  {
    icon: Clock,
    color: "bg-amber-50 text-amber-600",
    title: "Poliçe Yenileme",
    desc: "Yaklaşan poliçe bitişleri otomatik tespit edilir. Tek tıkla WhatsApp hatırlatması oluşturun.",
  },
  {
    icon: MessageSquare,
    color: "bg-emerald-50 text-emerald-600",
    title: "WhatsApp Entegrasyonu",
    desc: "Her müşteri için hazır WhatsApp mesajları. Ödeme hatırlatma, yenileme ve teklif mesajları tek tıkla.",
  },
  {
    icon: Bot,
    color: "bg-violet-50 text-violet-600",
    title: "AI Operasyon Merkezi",
    desc: "Yapay zeka destekli teklif mesajları, müşteri analizi ve operasyon özetleri ile zamanınızı %40 kazanın.",
  },
  {
    icon: TrendingUp,
    color: "bg-rose-50 text-rose-600",
    title: "Satış Lead Yönetimi",
    desc: "Google Maps ve CSV ile potansiyel acente müşterilerini içe aktarın. Skor bazlı önceliklendirme.",
  },
];

// ─── Screen tabs (carousel) ───────────────────────────────────────────────────
const SCREENS = [
  { id: "dashboard",  label: "Dashboard",         icon: BarChart3 },
  { id: "requests",   label: "Teklif Talepleri",  icon: FileText },
  { id: "customers",  label: "Müşteriler",         icon: Users },
  { id: "policies",   label: "Poliçeler",          icon: Shield },
  { id: "ai",         label: "AI Asistan",         icon: Bot },
  { id: "leads",      label: "Satış Leadleri",     icon: TrendingUp },
] as const;

type ScreenId = typeof SCREENS[number]["id"];

// ─── Workflow steps ───────────────────────────────────────────────────────────
const WORKFLOW = [
  { time: "09:00", icon: "☀️", title: "Güne başlarken",         desc: "Dashboard açılıyor. 3 yeni teklif talebi gece gelmiş. 2 poliçe bu hafta bitiyor. AI özeti 30 saniyede durumu özetledi.", color: "bg-blue-100 text-blue-700" },
  { time: "09:15", icon: "📋", title: "Talepleri işleme al",    desc: "Zeynep Hanım kasko talebi doldurmış. Tek tıkla 'İşleme Al' → WhatsApp teklif mesajı hazır, gönder tuşuna bas.", color: "bg-indigo-100 text-indigo-700" },
  { time: "10:30", icon: "🔔", title: "Yenileme hatırlatmaları", desc: "Mehmet Bey poliçesi 5 gün içinde bitiyor. Önceden hazırlanmış hatırlatma mesajını WhatsApp'tan ilet.", color: "bg-amber-100 text-amber-700" },
  { time: "13:00", icon: "🤖", title: "AI teklif mesajı",       desc: "Yeni müşteri için AI, poliçe geçmişini analiz edip kişiselleştirilmiş teklif mesajını otomatik yazdı.", color: "bg-violet-100 text-violet-700" },
  { time: "17:00", icon: "📊", title: "Günlük kapanış",         desc: "4 teklif tamamlandı, 2 poliçe yenilendi, 1 yeni müşteri eklendi. Dashboard büyüme trendini gösteriyor.", color: "bg-emerald-100 text-emerald-700" },
];

// ─── Pricing ──────────────────────────────────────────────────────────────────
// ─── FAQs ─────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "Kurulum ne kadar sürer?", a: "PoliçePilot bulut tabanlıdır, kurulum gerektirmez. Kaydolduktan sonra 5 dakika içinde acentenizin teklif formunu müşterilerinizle paylaşabilirsiniz." },
  { q: "Mevcut müşteri listemizi taşıyabilir miyiz?", a: "Evet. CSV veya Excel ile toplu müşteri aktarımı desteklenmektedir. Ayrıca Google Maps verilerini doğrudan içe aktarabilirsiniz." },
  { q: "WhatsApp entegrasyonu nasıl çalışır?", a: "Sistem hazır mesaj şablonları oluşturur. Tek tıkla WhatsApp Web açılır ve mesaj otomatik doldurulmuş olarak bekler." },
  { q: "AI Asistan ne tür görevler yapıyor?", a: "Teklif mesajı yazma, poliçe analizi, müşteri segmentasyonu ve operasyon özeti hazırlama. İnsan onayıyla çalışır, otomatik gönderim yapmaz." },
  { q: "Verilerim güvende mi?", a: "Tüm veriler Türkiye KVKK mevzuatına uygun olarak saklanır. Supabase altyapısı ile row-level security ve şifreli aktarım kullanılmaktadır." },
];

// ─── Screen mockups ───────────────────────────────────────────────────────────
function ScreenDashboard() {
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Toplam Müşteri", value: "247", icon: Users,    color: "text-blue-600 bg-blue-50"    },
          { label: "Açık Teklif",    value: "12",  icon: FileText, color: "text-indigo-600 bg-indigo-50" },
          { label: "Yenileme",       value: "8",   icon: Clock,    color: "text-amber-600 bg-amber-50"   },
          { label: "Bugün",          value: "3",   icon: Zap,      color: "text-emerald-600 bg-emerald-50"},
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3">
            <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            <p className="text-xl font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Haftalık Teklif</p>
          <div className="flex items-end gap-2 h-16">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-blue-100 relative overflow-hidden">
                <div className="absolute bottom-0 inset-x-0 bg-blue-500 rounded-t-sm" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            {["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Son Talepler</p>
          <div className="space-y-2">
            {[{ n: "Ahmet Y.", t: "Kasko", c: "bg-blue-100 text-blue-700" }, { n: "Fatma K.", t: "DASK", c: "bg-amber-100 text-amber-700" }, { n: "Mert D.", t: "Sağlık", c: "bg-emerald-100 text-emerald-700" }].map((r) => (
              <div key={r.n} className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">{r.n[0]}</div>
                <p className="text-[9px] font-medium text-slate-700 flex-1 truncate">{r.n}</p>
                <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${r.c}`}>{r.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl p-3 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold text-white">AI Operasyon Özeti</p>
          <p className="text-[9px] text-blue-300 mt-0.5">12 açık teklif aksiyon bekliyor · 8 poliçe 30 gün içinde yenilenecek · Trafik bu hafta en fazla tercih</p>
        </div>
      </div>
    </div>
  );
}

function ScreenRequests() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">Teklif Talepleri</p>
        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">12 Yeni</span>
      </div>
      <div className="space-y-2">
        {[
          { name: "Zeynep Arslan", type: "Kasko", status: "Yeni",       statusC: "bg-blue-50 text-blue-700",    dot: "bg-blue-500" },
          { name: "Ahmet Yılmaz",  type: "Trafik",status: "İşlemde",    statusC: "bg-indigo-50 text-indigo-700",dot: "bg-indigo-500" },
          { name: "Mehmet Demir",  type: "DASK",  status: "Tamamlandı", statusC: "bg-emerald-50 text-emerald-700",dot:"bg-emerald-500"},
          { name: "Fatma Kaya",    type: "Sağlık",status: "Yeni",       statusC: "bg-blue-50 text-blue-700",    dot: "bg-blue-500" },
        ].map((r) => (
          <div key={r.name} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {r.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{r.name}</p>
              <p className="text-[10px] text-gray-400">{r.type}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${r.statusC}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
              {r.status}
            </span>
            <button className="px-2 py-1 text-[10px] bg-emerald-50 text-emerald-700 rounded-lg font-semibold">WA</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenCustomers() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <Search className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] text-gray-400">Müşteri ara...</span>
        </div>
        <button className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">+ Ekle</button>
      </div>
      <div className="space-y-2">
        {[
          { name: "Zeynep Arslan",  phone: "0532 111 22 33", type: "Kasko",   date: "15.03.2026" },
          { name: "Ahmet Yılmaz",   phone: "0533 222 33 44", type: "Trafik",  date: "22.02.2026" },
          { name: "Mehmet Demir",   phone: "0535 333 44 55", type: "DASK",    date: "08.01.2026" },
          { name: "Fatma Kaya",     phone: "0536 444 55 66", type: "Sağlık",  date: "30.11.2025" },
        ].map((c) => (
          <div key={c.name} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {c.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">{c.name}</p>
              <p className="text-[10px] text-gray-400">{c.phone} · {c.type}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">{c.date}</p>
              <button className="text-[10px] text-emerald-600 font-semibold mt-0.5">WA</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPolicies() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[10px] text-red-700 font-semibold">3 poliçe kritik — 5 gün veya daha az kaldı</p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { name: "Ahmet Yılmaz",  type: "Trafik Sigortası",  end: "05.06.2026", days: 3,  crit: true  },
          { name: "Fatma Kaya",    type: "Kasko",              end: "12.06.2026", days: 10, crit: false },
          { name: "Mehmet Demir",  type: "Konut Sigortası",   end: "18.06.2026", days: 16, crit: false },
          { name: "Zeynep Arslan", type: "DASK",              end: "30.06.2026", days: 28, crit: false },
        ].map((p) => (
          <div key={p.name} className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${p.crit ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${p.crit ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>
              {p.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
              <p className="text-[10px] text-gray-400">{p.type} · {p.end}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.crit ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
              {p.days} gün
            </span>
            <button className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-semibold">Hatırlat</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenAI() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-800">AI Asistan</p>
          <p className="text-[10px] text-gray-400">GPT-4o destekli</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktif
        </span>
      </div>
      <div className="space-y-2.5 max-h-44 overflow-hidden">
        <div className="bg-gray-50 rounded-xl rounded-tl-sm p-3 max-w-[85%]">
          <p className="text-[10px] text-slate-700 leading-relaxed">Ahmet Yılmaz için kasko yenileme WhatsApp mesajı yazar mısın?</p>
        </div>
        <div className="bg-violet-600 rounded-xl rounded-tr-sm p-3 ml-auto max-w-[90%]">
          <p className="text-[10px] text-white leading-relaxed">Merhaba Ahmet Bey! 🚗 Araç kasko poliçenizin yenileme zamanı yaklaşıyor. Bu yıl aynı teminatlarla en uygun fiyatı sizin için araştırdım. Detayları paylaşayım mı?</p>
        </div>
        <div className="bg-gray-50 rounded-xl rounded-tl-sm p-3 max-w-[85%]">
          <p className="text-[10px] text-slate-700">Evet, uygun fiyat analizi de ekle.</p>
        </div>
        <div className="bg-violet-600 rounded-xl rounded-tr-sm p-3 ml-auto max-w-[90%]">
          <p className="text-[10px] text-white leading-relaxed">Bu yıl ortalama %12 artış var ancak sizin profilinizde hasarsızlık indirimi uygulanabilir. ₺2.840 → ₺2.490 tahmin ediyorum...</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400">Mesajınızı yazın...</p>
        </div>
        <button className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

function ScreenLeads() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">Satış Leadleri</p>
        <button className="px-2.5 py-1 bg-violet-600 text-white text-[10px] font-bold rounded-lg">CSV İçe Aktar</button>
      </div>
      <div className="space-y-2">
        {[
          { name: "Atlas Sigorta",   district: "Kadıköy",  phone: "0212 444 55 66", score: 92, temp: "🔥", scoreC: "bg-red-100 text-red-700"    },
          { name: "Güven Acentesi", district: "Beşiktaş", phone: "0212 333 44 55", score: 75, temp: "⭐", scoreC: "bg-amber-100 text-amber-700" },
          { name: "Aktif Sigorta",  district: "Şişli",    phone: "0212 222 33 44", score: 61, temp: "👍", scoreC: "bg-blue-100 text-blue-700"   },
          { name: "Pro Acente",     district: "Üsküdar",  phone: "0216 111 22 33", score: 45, temp: "❄️", scoreC: "bg-gray-100 text-gray-600"   },
        ].map((l) => (
          <div key={l.name} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {l.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{l.name}</p>
              <p className="text-[10px] text-gray-400">{l.district} · {l.phone}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{l.temp}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${l.scoreC}`}>{l.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenContent({ id }: { id: ScreenId }) {
  switch (id) {
    case "dashboard":  return <ScreenDashboard />;
    case "requests":   return <ScreenRequests />;
    case "customers":  return <ScreenCustomers />;
    case "policies":   return <ScreenPolicies />;
    case "ai":         return <ScreenAI />;
    case "leads":      return <ScreenLeads />;
  }
}

// ─── Browser chrome wrapper ───────────────────────────────────────────────────
function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200/80" style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)" }}>
      {/* Title bar */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 bg-white rounded-lg px-3 py-1 flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
          <span className="text-[11px] text-gray-500 font-medium truncate">app.policepilot.com/dashboard</span>
        </div>
      </div>
      {/* Sidebar + content */}
      <div className="flex bg-white" style={{ minHeight: 340 }}>
        {/* Mini sidebar */}
        <div className="w-[52px] flex-shrink-0 bg-[#0f172a] flex flex-col items-center py-4 gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
          {[BarChart3, Users, FileText, Shield, Bot].map((Icon, i) => (
            <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center ${i === 0 ? "bg-white/10" : ""}`}>
              <Icon className="w-3.5 h-3.5 text-slate-500" />
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 bg-slate-50 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("dashboard");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-200">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-[17px] tracking-tight">PoliçePilot</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {[
                { label: "Özellikler",    href: "#ozellikler" },
                { label: "Nasıl Çalışır", href: "#ekranlar" },
                { label: "SSS",           href: "#sss" },
              ].map((item) => (
                <a key={item.label} href={item.href}
                  className="px-3.5 py-2 text-sm text-slate-500 hover:text-slate-900 rounded-lg hover:bg-gray-50 transition-all font-medium">
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Right */}
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <Link href="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                Giriş Yap
              </Link>
              <Link href="/register"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Ücretsiz Başla
              </Link>
            </div>

            {/* Mobile burger */}
            <button className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
              {menuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-0.5">
            {[
              { label: "Özellikler",    href: "#ozellikler" },
              { label: "Nasıl Çalışır", href: "#ekranlar" },
              { label: "SSS",           href: "#sss" },
            ].map((item) => (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-gray-50">
                {item.label}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-gray-100 flex gap-3">
              <Link href="/login" className="flex-1 text-center py-2 rounded-xl border border-gray-200 text-sm font-semibold text-slate-700">Giriş Yap</Link>
              <Link href="/register" className="flex-1 text-center py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Ücretsiz Başla</Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 pt-20 pb-0">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-blue-200 rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Sigorta Acenteleri İçin Yapay Zeka Destekli CRM
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-5">
              Sigorta Acentenizi
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Yapay Zeka ile Büyütün
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-200/80 max-w-2xl mx-auto leading-relaxed">
              Teklif yönetimi, müşteri takibi, poliçe yenilemeleri ve AI destekli operasyon yönetimi —
              hepsi tek platformda.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white font-bold text-base rounded-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/50 hover:-translate-y-0.5">
              Ücretsiz Başla
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 text-white font-semibold text-base rounded-xl border border-white/20 hover:bg-white/15 transition-all backdrop-blur-sm">
              CRM&apos;i İncele
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Social proof row */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-14 text-sm text-blue-300/70">
            {[
              { icon: Star,         label: "4.9/5 ortalama puan" },
              { icon: Users,        label: "500+ aktif acente" },
              { icon: ShieldCheck,  label: "KVKK uyumlu" },
              { icon: Zap,          label: "5 dakikada kurulum" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-blue-400" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Dashboard mockup — floats at bottom of hero */}
          <div className="max-w-4xl mx-auto">
            <BrowserChrome>
              <ScreenDashboard />
            </BrowserChrome>
          </div>
        </div>

        {/* Fade-out to white */}
        <div className="h-24 bg-gradient-to-b from-transparent to-white" />
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="ozellikler" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Özellikler</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Bir acentenin tüm operasyonu,<br className="hidden sm:block" /> tek platformda
            </h2>
            <p className="text-slate-500 text-base max-w-lg mx-auto">
              Pipedrive ve HubSpot gibi CRM'lerin tüm gücü, sigorta acentelerine özel kurgulanmış.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:shadow-gray-100/80 hover:-translate-y-1 transition-all duration-300 group">
                <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-2 group-hover:text-blue-700 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SCREENSHOT CAROUSEL ═════════════════════════════════════════════ */}
      <section id="ekranlar" className="py-24 bg-slate-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Platform Ekranları</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Her şey tam göründüğü gibi
            </h2>
            <p className="text-slate-500 text-base">Gerçek arayüz. Karmaşıklık yok.</p>
          </div>

          {/* Tab bar */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveScreen(s.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeScreen === s.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-white text-slate-500 border border-gray-200 hover:border-blue-200 hover:text-blue-600"
                }`}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Screen content */}
          <div className="max-w-3xl mx-auto">
            <BrowserChrome>
              <ScreenContent id={activeScreen} />
            </BrowserChrome>
          </div>
        </div>
      </section>

      {/* ══ BİR ACENTE GÜNÜ ═════════════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Operasyon Akışı</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Bir Acente Günü
            </h2>
            <p className="text-slate-500 text-base">PoliçePilot ile tipik bir iş günü nasıl görünür?</p>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[31px] top-6 bottom-6 w-px bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200 hidden sm:block" />

            <div className="space-y-6">
              {WORKFLOW.map((step, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-xl shadow-sm border border-white ${step.color}`}>
                      <span className="text-xl">{step.icon}</span>
                      <span className="text-[9px] font-bold mt-0.5 opacity-70">{step.time}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:shadow-gray-100 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-800">{step.title}</h3>
                      <span className="text-[10px] text-gray-400 font-medium">{step.time}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ═════════════════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { value: "500+",    label: "Aktif Acente",         sub: "Türkiye genelinde",       Icon: Building2 },
              { value: "%40",     label: "Zaman Tasarrufu",       sub: "AI ile operasyonda",      Icon: Zap },
              { value: "15 dk",   label: "Ortalama Yanıt",        sub: "Teklif taleplerine",      Icon: Clock },
              { value: "4.9/5",   label: "Kullanıcı Memnuniyeti", sub: "Platform değerlendirmesi",Icon: Star },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.07] border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm hover:bg-white/[0.12] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <s.Icon className="w-5 h-5 text-blue-300" />
                </div>
                <p className="text-3xl font-extrabold text-white mb-1">{s.value}</p>
                <p className="text-sm font-semibold text-blue-100 mb-0.5">{s.label}</p>
                <p className="text-[11px] text-blue-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ═════════════════════════════════════════════════════════════ */}
      <section id="sss" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-12 tracking-tight">
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
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
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

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-sm">PoliçePilot</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 max-w-[200px]">
                Sigorta acenteleri için yapay zeka destekli CRM ve operasyon platformu.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Platform</p>
              <ul className="space-y-2.5 text-xs">
                {["Teklif Yönetimi", "Müşteri Takibi", "Poliçe Yenileme", "AI Asistan", "Lead Yönetimi"].map((item) => (
                  <li key={item}><a href="#ozellikler" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            {/* Şirket */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Şirket</p>
              <ul className="space-y-2.5 text-xs">
                {["Hakkımızda", "Blog", "Kariyer", "Basın"].map((item) => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            {/* Destek */}
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-4">Destek</p>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#sss" className="hover:text-white transition-colors">SSS</a></li>
                <li><a href="#" className="hover:text-white transition-colors">KVKK</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Gizlilik Politikası</a></li>
                <li><a href="mailto:info@policepilot.com" className="hover:text-white transition-colors">info@policepilot.com</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p className="text-slate-500">© 2026 PoliçePilot. Tüm hakları saklıdır.</p>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                Acente Girişi
              </Link>
              <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                Ücretsiz Başla <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
