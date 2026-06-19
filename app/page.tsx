"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Check, Star,
  Users, Clock, MessageSquare, Zap, ShieldCheck,
  Sparkles, TrendingUp, Bot, Building2, Calendar,
  Trophy, Award, Wallet, Activity, Send, CheckCheck, Bell,
  Smartphone, Target, RefreshCw, Crown,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════
   ÜRÜN MOCKUP'LARI — gerçek SigortaOS ekranlarının canlı (CSS) temsilleri
   ════════════════════════════════════════════════════════════════════════ */

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-white"
      style={{ boxShadow: "0 32px 80px rgba(2,6,23,0.18), 0 8px 24px rgba(2,6,23,0.08)" }}>
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 bg-white rounded-lg px-3 py-1 flex items-center gap-2 max-w-xs">
          <ShieldCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 font-medium truncate">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/* Satış Fırsatları — Kanban */
const KANBAN_COLS = [
  { t: "Yeni Lead", acc: "border-t-blue-500", n: 8, cards: [{ c: "Ahmet Yılmaz", p: "Kasko" }, { c: "Elif Demir", p: "Trafik" }] },
  { t: "İletişime Geçildi", acc: "border-t-orange-500", n: 5, cards: [{ c: "Mert Kaya", p: "Konut" }] },
  { t: "Teklif Hazırlanıyor", acc: "border-t-violet-500", n: 4, cards: [{ c: "Zeynep Ak", p: "Sağlık" }, { c: "Can Öz", p: "DASK" }] },
  { t: "Takip Ediliyor", acc: "border-t-amber-500", n: 3, cards: [{ c: "Ayşe Tan", p: "İMM" }] },
  { t: "Kazanıldı", acc: "border-t-emerald-500", n: 12, cards: [{ c: "Burak Şen", p: "Kasko" }] },
];
function KanbanMock() {
  return (
    <div className="bg-slate-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Satış Fırsatları</p>
          <p className="text-[10px] text-slate-400">32 fırsat · %38 dönüşüm</p>
        </div>
        <div className="flex gap-1 text-[9px]">
          <span className="px-2 py-1 rounded-md bg-white text-slate-400 font-semibold">Liste</span>
          <span className="px-2 py-1 rounded-md bg-indigo-600 text-white font-semibold">Kanban</span>
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {KANBAN_COLS.map((col) => (
          <div key={col.t} className={`w-[120px] flex-shrink-0 bg-slate-100 rounded-xl border-t-[3px] ${col.acc} p-1.5`}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wide truncate">{col.t}</span>
              <span className="text-[8px] font-bold text-slate-400 bg-white rounded-full px-1.5">{col.n}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((c) => (
                <div key={c.c} className="bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-[9px] font-bold text-slate-800 truncate">{c.c}</p>
                  <p className="text-[8px] text-slate-400">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* WhatsApp Merkezi — kuyruk + sohbet */
function WhatsAppMock() {
  const queue = [
    { n: "Mehmet Bey", m: "Yenileme hatırlatması", s: "sent" },
    { n: "Ayşe Hanım", m: "Doğum günü mesajı", s: "sent" },
    { n: "Can Yılmaz", m: "Ödeme hatırlatması", s: "pending" },
    { n: "Elif Demir", m: "Poliçe bitiş bildirimi", s: "pending" },
  ];
  return (
    <div className="bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Kuyruk */}
      <div className="bg-white rounded-xl border border-slate-200/70 p-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-bold text-slate-800">Mesaj Kuyruğu</p>
          <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Bugün 142 gönderildi</span>
        </div>
        <div className="space-y-1.5">
          {queue.map((q) => (
            <div key={q.n} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-3 h-3 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-700 truncate">{q.n}</p>
                <p className="text-[8px] text-slate-400 truncate">{q.m}</p>
              </div>
              {q.s === "sent"
                ? <CheckCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                : <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
      {/* Sohbet */}
      <div className="bg-[#e5ddd5] rounded-xl p-3 flex flex-col justify-end" style={{ backgroundImage: "linear-gradient(rgba(229,221,213,0.6),rgba(229,221,213,0.6))" }}>
        <div className="space-y-2">
          <div className="bg-white rounded-lg rounded-tl-none p-2 max-w-[80%] shadow-sm">
            <p className="text-[9px] text-slate-700 leading-relaxed">Merhaba Mehmet Bey 👋 Kasko poliçeniz 5 gün sonra bitiyor. Aynı teminatlarla en uygun fiyatı hazırladım.</p>
            <p className="text-[7px] text-slate-400 text-right mt-1">09:24</p>
          </div>
          <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-2 max-w-[80%] ml-auto shadow-sm">
            <p className="text-[9px] text-slate-700">Teşekkürler, detayları paylaşır mısınız?</p>
            <p className="text-[7px] text-slate-400 text-right mt-1 flex items-center justify-end gap-0.5">10:02 <CheckCheck className="w-2.5 h-2.5 text-blue-500" /></p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Personel Performansı — sıralama */
function PerformanceMock() {
  const staff = [
    { n: "Ahmet K.", pol: 24, prim: "186K", conv: 42, score: 88, rank: 1 },
    { n: "Elif D.", pol: 19, prim: "142K", conv: 36, score: 74, rank: 2 },
    { n: "Mert Y.", pol: 12, prim: "94K", conv: 28, score: 58, rank: 3 },
  ];
  const tone = (s: number) => s >= 75 ? "text-emerald-600 bg-emerald-50" : s >= 50 ? "text-indigo-600 bg-indigo-50" : "text-amber-600 bg-amber-50";
  return (
    <div className="bg-slate-50 p-4">
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[{ l: "Toplam Prim", v: "422K ₺" }, { l: "Toplam Poliçe", v: "55" }, { l: "Ekip Dönüşüm", v: "%35" }].map((k) => (
          <div key={k.l} className="bg-white rounded-lg border border-slate-200/70 px-2 py-2">
            <p className="text-[7px] font-bold text-slate-400 uppercase">{k.l}</p>
            <p className="text-xs font-extrabold text-slate-900 mt-0.5">{k.v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {staff.map((s) => (
          <div key={s.n} className="bg-white rounded-xl border border-slate-200/70 p-2.5 flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${s.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
              {s.rank === 1 ? <Crown className="w-3 h-3" /> : s.rank}
            </div>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
              {s.n.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-800 truncate">{s.n}</p>
              <p className="text-[8px] text-slate-400">{s.pol} poliçe · {s.prim} prim · %{s.conv}</p>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0 ${tone(s.score)}`}>
              <Award className="w-3 h-3" />
              <span className="text-[11px] font-extrabold">{s.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Operasyon Merkezi — stat tiles */
function OperationsMock() {
  const stats = [
    { l: "Acente", v: "128", Icon: Building2, c: "text-blue-600 bg-blue-50" },
    { l: "Kullanıcı", v: "540", Icon: Users, c: "text-indigo-600 bg-indigo-50" },
    { l: "Müşteri", v: "12.4K", Icon: Users, c: "text-violet-600 bg-violet-50" },
    { l: "Poliçe", v: "8.9K", Icon: ShieldCheck, c: "text-emerald-600 bg-emerald-50" },
  ];
  return (
    <div className="bg-slate-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-800">Operasyon Merkezi</p>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sistem Aktif
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {stats.map((s) => (
          <div key={s.l} className="bg-white rounded-xl border border-slate-200/70 p-2.5">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center mb-1.5 ${s.c}`}><s.Icon className="w-3.5 h-3.5" /></div>
            <p className="text-base font-extrabold text-slate-900 leading-none">{s.v}</p>
            <p className="text-[8px] text-slate-400 mt-1">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200/70 p-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Son 7 Gün Aktivite</p>
        <div className="flex items-end gap-1.5 h-12">
          {[40, 65, 50, 80, 60, 95, 75].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-blue-400" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Yenileme Merkezi */
function RenewalsMock() {
  const rows = [
    { n: "Mehmet Demir", p: "Kasko", d: 3, c: "text-rose-600 bg-rose-50" },
    { n: "Ayşe Yıldız", p: "Konut · DASK", d: 8, c: "text-amber-600 bg-amber-50" },
    { n: "Can Arslan", p: "Trafik", d: 15, c: "text-blue-600 bg-blue-50" },
    { n: "Elif Kaya", p: "Sağlık", d: 22, c: "text-slate-500 bg-slate-100" },
  ];
  return (
    <div className="bg-slate-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-800">Yaklaşan Yenilemeler</p>
        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">4 poliçe · 30 gün</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.n} className="bg-white rounded-xl border border-slate-200/70 p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-800 truncate">{r.n}</p>
              <p className="text-[8px] text-slate-400">{r.p}</p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-lg flex-shrink-0 ${r.c}`}>{r.d} gün</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-3 h-3 text-emerald-600" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Mobil — iPhone mockup */
function PhoneMock({ variant }: { variant: "customers" | "notif" }) {
  return (
    <div className="relative mx-auto" style={{ width: 200 }}>
      <div className="rounded-[2.2rem] bg-slate-900 p-2 shadow-2xl" style={{ boxShadow: "0 24px 60px rgba(2,6,23,0.35)" }}>
        <div className="rounded-[1.7rem] overflow-hidden bg-slate-50" style={{ height: 380 }}>
          {/* notch */}
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-4 pt-6 pb-4">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-full" />
            <p className="text-white text-sm font-bold mt-2">{variant === "customers" ? "Müşteriler" : "Bildirimler"}</p>
            <p className="text-blue-200 text-[10px]">SigortaOS Mobil</p>
          </div>
          <div className="p-2.5 space-y-2">
            {variant === "customers"
              ? [["Ahmet Yılmaz", "3 aktif poliçe"], ["Elif Demir", "Kasko · Trafik"], ["Mert Kaya", "Yenileme yakın"], ["Zeynep Ak", "Yeni müşteri"]].map(([n, s], i) => (
                <div key={i} className="bg-white rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[10px] font-bold">{(n as string).split(" ").map((w) => w[0]).join("")}</div>
                  <div className="min-w-0"><p className="text-[11px] font-bold text-slate-800 truncate">{n}</p><p className="text-[9px] text-slate-400 truncate">{s}</p></div>
                </div>
              ))
              : [["🔔", "Yeni satış fırsatı", "Ali Koç trafik talebi"], ["♻️", "Yenileme yaklaşıyor", "Mehmet Bey · 3 gün"], ["✅", "Poliçe kesildi", "Kasko · 2.490 ₺"], ["💬", "WhatsApp yanıtı", "Ayşe Hanım yanıtladı"]].map(([e, t, s], i) => (
                <div key={i} className="bg-white rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm">{e}</div>
                  <div className="min-w-0"><p className="text-[11px] font-bold text-slate-800 truncate">{t}</p><p className="text-[9px] text-slate-400 truncate">{s}</p></div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* AI sohbet mockup */
function AiMock() {
  return (
    <div className="bg-slate-50 p-4 space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
        <p className="text-sm font-bold text-slate-800">AI Asistan</p>
      </div>
      <div className="bg-white rounded-xl rounded-tl-none p-2.5 max-w-[85%] shadow-sm border border-slate-100">
        <p className="text-[10px] text-slate-600 leading-relaxed">Bu ay <b>Mehmet Y.</b> 40 teklif çalıştı ama yalnız 4&apos;ünü kapattı (%10). Ekip ortalaması %22. Takip otomasyonu önerir misin?</p>
      </div>
      <div className="bg-indigo-600 rounded-xl rounded-tr-none p-2.5 max-w-[85%] ml-auto shadow-sm">
        <p className="text-[10px] text-white">Evet, teklif sonrası 48 saat WhatsApp hatırlatması kur.</p>
      </div>
      <div className="bg-white rounded-xl rounded-tl-none p-2.5 max-w-[85%] shadow-sm border border-slate-100">
        <p className="text-[10px] text-slate-600 leading-relaxed">✅ Kuruldu. 18 açık teklife otomatik takip planlandı. Tahmini +%12 dönüşüm.</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SAYFA
   ════════════════════════════════════════════════════════════════════════ */

const NAV = [
  { label: "Özellikler", href: "#neden" },
  { label: "WhatsApp", href: "#whatsapp" },
  { label: "Satış", href: "#satis" },
  { label: "Paketler", href: "#paketler" },
];

const WHY = [
  { Icon: TrendingUp, t: "Daha Fazla Poliçe", d: "Yenileme kaçırmayın, fırsatları takip edin, dönüşümü artırın.", c: "from-blue-500 to-indigo-600" },
  { Icon: MessageSquare, t: "WhatsApp Otomasyonu", d: "Otomatik hatırlatmalar ve müşteri iletişimi tek tıkla.", c: "from-emerald-500 to-green-600" },
  { Icon: Users, t: "Ekip Yönetimi", d: "Tüm personelin performansını tek ekranda görün.", c: "from-violet-500 to-purple-600" },
  { Icon: Bot, t: "AI Destekli Operasyon", d: "Yapay zeka destekli öneriler ve akıllı iş akışları.", c: "from-amber-500 to-orange-600" },
];

const WA_FEATURES = [
  { Icon: RefreshCw, t: "Yenileme hatırlatmaları" },
  { Icon: Calendar, t: "Doğum günü mesajları" },
  { Icon: Wallet, t: "Ödeme hatırlatmaları" },
  { Icon: Bell, t: "Poliçe bitiş bildirimleri" },
  { Icon: Send, t: "Toplu müşteri iletişimi" },
  { Icon: CheckCheck, t: "Mesaj kuyruğu yönetimi" },
];

const PIPELINE = ["Yeni Lead", "İletişime Geçildi", "Teklif Hazırlanıyor", "Takip Ediliyor", "Kazanıldı"];

const PLANS = [
  {
    name: "Starter", price: "Ücretsiz", per: "deneme", popular: false,
    desc: "Yeni başlayan acenteler için temel CRM.",
    features: ["5 kullanıcı", "500 müşteri", "Temel poliçe & yenileme", "WhatsApp tek-tık mesaj", "Topluluk desteği"],
    cta: "Ücretsiz Başla",
  },
  {
    name: "Professional", price: "₺1.490", per: "/ay", popular: true,
    desc: "Büyüyen acenteler için tam operasyon.",
    features: ["15 kullanıcı", "5.000 müşteri", "Satış Fırsatları + Kanban", "WhatsApp otomasyonu", "Personel performansı", "AI asistan & öneriler", "Öncelikli destek"],
    cta: "Demo Talep Et",
  },
  {
    name: "Enterprise", price: "₺4.990", per: "/ay", popular: false,
    desc: "Çok şubeli ve yüksek hacimli acenteler.",
    features: ["Sınırsız kullanıcı", "Sınırsız müşteri", "Tüm Professional özellikleri", "Özel entegrasyonlar", "Gelişmiş raporlama", "Özel başarı yöneticisi"],
    cta: "Bizimle Görüşün",
  },
];

const ADDONS = [
  { Icon: Users, t: "Ek Kullanıcı", d: "Paket limitinin üstüne kullanıcı ekleyin." },
  { Icon: MessageSquare, t: "WhatsApp Paketi", d: "Aylık ek mesaj kotası satın alın." },
  { Icon: Bot, t: "AI Kredisi", d: "Daha fazla AI analizi ve otomasyon." },
  { Icon: Building2, t: "Ek Depolama", d: "Poliçe ve evraklar için ek alan." },
];

function SectionLabel({ children, color = "text-blue-600" }: { children: React.ReactNode; color?: string }) {
  return <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${color}`}>{children}</p>;
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased">
      {/* ══ NAVBAR ══ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-[17px] tracking-tight">SigortaOS</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV.map((item) => (
                <a key={item.label} href={item.href} className="px-3.5 py-2 text-sm text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-all font-medium">{item.label}</a>
              ))}
            </nav>
            <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
              <Link href="/login" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Giriş Yap</Link>
              <Link href="/register" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">Ücretsiz Demo</Link>
            </div>
            <button className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
              {menuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-0.5">
            {NAV.map((item) => (
              <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">{item.label}</a>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-100 flex gap-3">
              <Link href="/login" className="flex-1 text-center py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Giriş Yap</Link>
              <Link href="/register" className="flex-1 text-center py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Ücretsiz Demo</Link>
            </div>
          </div>
        )}
      </header>

      {/* ══ 1. HERO ══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 pt-16 pb-0">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-center mb-7 pt-4">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-blue-200 rounded-full px-4 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Sigorta Acenteleri İçin İşletim Sistemi
            </div>
          </div>
          <div className="text-center max-w-4xl mx-auto mb-7">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-5">
              Sigorta Acentenizi Yönetmeyin.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">Otomatikleştirin.</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-200/80 max-w-2xl mx-auto leading-relaxed">
              Müşterilerinizden yenilemelere, WhatsApp hatırlatmalarından ekip performansına kadar tüm operasyonunuzu tek platformdan yönetin.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-9">
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 text-white font-bold text-base rounded-xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/50 hover:-translate-y-0.5">
              Ücretsiz Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 text-white font-semibold text-base rounded-xl border border-white/20 hover:bg-white/15 transition-all backdrop-blur-sm">
              Canlı Önizleme <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-12 text-sm text-blue-300/70">
            {[{ Icon: Star, l: "4.9/5 ortalama puan" }, { Icon: Users, l: "500+ aktif acente" }, { Icon: ShieldCheck, l: "KVKK uyumlu" }, { Icon: Zap, l: "5 dakikada kurulum" }].map(({ Icon, l }) => (
              <div key={l} className="flex items-center gap-1.5"><Icon className="w-4 h-4 text-blue-400" /><span>{l}</span></div>
            ))}
          </div>
          {/* Ürün ekranları */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 max-w-5xl mx-auto items-end">
            <div className="lg:col-span-3"><BrowserChrome url="app.sigortaos.com/firsatlar"><KanbanMock /></BrowserChrome></div>
            <div className="lg:col-span-2"><BrowserChrome url="app.sigortaos.com/whatsapp-queue"><WhatsAppMock /></BrowserChrome></div>
          </div>
        </div>
        <div className="h-24 bg-gradient-to-b from-transparent to-white mt-12" />
      </section>

      {/* ══ 2. NEDEN SİGORTAOS ══ */}
      <section id="neden" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <SectionLabel>Neden SigortaOS</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Bir acentenin tüm operasyonu, tek çatı altında</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY.map((w) => (
              <div key={w.t} className="group bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${w.c} flex items-center justify-center mb-4 shadow-lg`}>
                  <w.Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1.5">{w.t}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. WHATSAPP (en güçlü) ══ */}
      <section id="whatsapp" className="py-20 bg-gradient-to-br from-emerald-50 via-white to-white border-y border-emerald-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 rounded-full px-3 py-1 text-xs font-bold mb-4">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Merkezi
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">
                WhatsApp&apos;ta Kaybettiğiniz Müşterileri Geri Kazanın
              </h2>
              <p className="text-slate-500 text-base mb-6 leading-relaxed">
                Meta onaylı WhatsApp altyapısıyla otomatik hatırlatmalar, kuyruk yönetimi ve toplu iletişim. Hiçbir yenileme, hiçbir fırsat kaçmaz.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
                {WA_FEATURES.map((f) => (
                  <div key={f.t} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><f.Icon className="w-4 h-4 text-emerald-600" /></div>
                    <span className="text-sm font-medium text-slate-700">{f.t}</span>
                  </div>
                ))}
              </div>
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
                WhatsApp Otomasyonunu Dene <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <BrowserChrome url="app.sigortaos.com/whatsapp-queue"><WhatsAppMock /></BrowserChrome>
          </div>
        </div>
      </section>

      {/* ══ 4. SATIŞ FIRSATLARI ══ */}
      <section id="satis" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <SectionLabel color="text-indigo-600">Satış Fırsatları</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Tüm Satış Sürecinizi Görün</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Lead&apos;den poliçeye her aşamayı kanban üzerinde sürükle-bırakla yönetin.</p>
          </div>
          {/* pipeline akışı */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {PIPELINE.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">{s}</span>
                {i < PIPELINE.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300" />}
              </div>
            ))}
          </div>
          <div className="max-w-4xl mx-auto"><BrowserChrome url="app.sigortaos.com/firsatlar"><KanbanMock /></BrowserChrome></div>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
            {[{ v: "%38", l: "Dönüşüm Oranı" }, { v: "32", l: "Aktif Fırsat" }, { v: "12", l: "Bu Ay Kazanılan" }].map((k) => (
              <div key={k.l} className="text-center">
                <p className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">{k.v}</p>
                <p className="text-xs text-slate-400 mt-1">{k.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. YENİLEME MERKEZİ ══ */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <BrowserChrome url="app.sigortaos.com/renewals"><RenewalsMock /></BrowserChrome>
            <div className="lg:order-first">
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 rounded-full px-3 py-1 text-xs font-bold mb-4">
                <RefreshCw className="w-3.5 h-3.5" /> Yenileme Merkezi
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">Yenileme Tarihini Kaçırmayın</h2>
              <p className="text-slate-500 text-base mb-6 leading-relaxed">Sigorta işinin can damarı yenilemelerdir. SigortaOS yaklaşan bitişleri otomatik tespit eder, hatırlatır ve müşteri kaybını önler.</p>
              <div className="space-y-3">
                {[["Yaklaşan yenilemeler", "30/60/90 gün önceden otomatik tespit"], ["Otomatik hatırlatmalar", "WhatsApp ile tek tık veya otomatik"], ["Yenileme fırsatları", "Her yenileme yeni bir satış fırsatı"], ["Müşteri kaybını azaltma", "Zamanında iletişimle elde tutma"]].map(([t, d]) => (
                  <div key={t} className="flex gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="w-3.5 h-3.5 text-amber-600" /></div>
                    <div><p className="text-sm font-bold text-slate-800">{t}</p><p className="text-xs text-slate-500">{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 6. EKİP & PERSONEL ══ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-700 rounded-full px-3 py-1 text-xs font-bold mb-4">
                <Users className="w-3.5 h-3.5" /> Personel Yönetimi
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">Ekip Performansınızı Ölçün</h2>
              <p className="text-slate-500 text-base mb-6 leading-relaxed">Acente sahibi olarak tüm ekibinizi tek ekrandan yönetin. Kim üretiyor, kim destek istiyor — performans skorlarıyla net görün.</p>
              <div className="grid grid-cols-2 gap-3">
                {[["Satış sıralaması", Trophy], ["Dönüşüm oranları", Target], ["Poliçe üretimi", ShieldCheck], ["Aktivite takibi", Activity]].map(([t, Ic]) => {
                  const I = Ic as typeof Trophy;
                  return (
                    <div key={t as string} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
                      <I className="w-4 h-4 text-violet-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700">{t as string}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <BrowserChrome url="app.sigortaos.com/team"><PerformanceMock /></BrowserChrome>
          </div>
        </div>
      </section>

      {/* ══ 7. OPERASYON MERKEZİ ══ */}
      <section className="py-20 bg-gradient-to-br from-slate-950 to-blue-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <SectionLabel color="text-blue-400">Operasyon Merkezi</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Tüm Operasyon Tek Ekranda</h2>
            <p className="text-blue-200/70 max-w-xl mx-auto mt-3">Acente, kullanıcı, müşteri ve poliçe sayılarından sistem durumuna kadar her şey gerçek zamanlı.</p>
          </div>
          <div className="max-w-4xl mx-auto"><BrowserChrome url="app.sigortaos.com/admin"><OperationsMock /></BrowserChrome></div>
        </div>
      </section>

      {/* ══ 8. MOBİL ══ */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-full px-3 py-1 text-xs font-bold mb-4">
                <Smartphone className="w-3.5 h-3.5" /> Mobil Uygulama
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">Ofis Dışında da Kontrol Sizde</h2>
              <p className="text-slate-500 text-base mb-6 leading-relaxed">Müşterileriniz, poliçeleriniz, satış fırsatlarınız ve bildirimleriniz cebinizde. Nerede olursanız olun acentenizi yönetin.</p>
              <div className="flex flex-wrap gap-2">
                {["Müşteriler", "Poliçeler", "Satış Fırsatları", "Anlık Bildirimler"].map((t) => (
                  <span key={t} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">{t}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <div className="translate-y-4"><PhoneMock variant="customers" /></div>
              <div className="-translate-y-4 hidden sm:block"><PhoneMock variant="notif" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 9. AI ASİSTAN ══ */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <BrowserChrome url="app.sigortaos.com/ai-assistant"><AiMock /></BrowserChrome>
            <div className="lg:order-first">
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 rounded-full px-3 py-1 text-xs font-bold mb-4">
                <Bot className="w-3.5 h-3.5" /> AI Asistan
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4 leading-tight">Sigorta Operasyonları İçin Yapay Zeka</h2>
              <p className="text-slate-500 text-base mb-6 leading-relaxed">Salt rapor değil, aksiyon. AI ekibinizi analiz eder, müşteri özetleri çıkarır ve ne yapmanız gerektiğini söyler.</p>
              <div className="space-y-3">
                {[["Akıllı özetler", "Müşteri ve poliçe verisinden anında özet"], ["Otomatik hatırlatmalar", "Doğru zamanda doğru aksiyon"], ["Operasyon önerileri", "Koçluk: kim, neyi, nasıl iyileştirmeli"], ["Performans analizleri", "Ekip ve dönüşüm içgörüleri"]].map(([t, d]) => (
                  <div key={t} className="flex gap-3">
                    <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5"><Sparkles className="w-3.5 h-3.5 text-violet-600" /></div>
                    <div><p className="text-sm font-bold text-slate-800">{t}</p><p className="text-xs text-slate-500">{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 10. PAKETLER ══ */}
      <section id="paketler" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <SectionLabel>Paketler</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Acentenize Uygun Planı Seçin</h2>
            <p className="text-slate-500 max-w-lg mx-auto">İhtiyacınız büyüdükçe ek lisans ve modüllerle genişletin. Sözleşme yok, istediğiniz zaman iptal.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {PLANS.map((p) => (
              <div key={p.name} className={`relative rounded-3xl p-7 flex flex-col ${p.popular ? "bg-gradient-to-br from-slate-950 to-blue-950 text-white shadow-2xl scale-[1.03] border border-blue-800" : "bg-white border border-slate-200"}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg">EN POPÜLER</span>}
                <h3 className={`text-lg font-bold ${p.popular ? "text-white" : "text-slate-900"}`}>{p.name}</h3>
                <p className={`text-sm mb-4 ${p.popular ? "text-blue-200/70" : "text-slate-400"}`}>{p.desc}</p>
                <div className="flex items-end gap-1 mb-5">
                  <span className={`text-4xl font-extrabold ${p.popular ? "text-white" : "text-slate-900"}`}>{p.price}</span>
                  <span className={`text-sm mb-1.5 ${p.popular ? "text-blue-200/70" : "text-slate-400"}`}>{p.per}</span>
                </div>
                <Link href="/register" className={`text-center py-3 rounded-xl font-semibold text-sm mb-6 transition-colors ${p.popular ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-slate-900 text-white hover:bg-slate-800"}`}>{p.cta}</Link>
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.popular ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span className={p.popular ? "text-blue-100" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Ek modüller */}
          <div className="mt-12 max-w-5xl mx-auto">
            <p className="text-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Eklenebilir Modüller</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {ADDONS.map((a) => (
                <div key={a.t} className="bg-slate-50 rounded-2xl border border-slate-200/70 p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3"><a.Icon className="w-5 h-5 text-blue-600" /></div>
                  <p className="font-bold text-slate-800 text-sm mb-1">{a.t}</p>
                  <p className="text-xs text-slate-500 leading-snug">{a.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ 11. REFERANS / GÜVEN ══ */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <SectionLabel>Acentelerin Tercihi</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Türkiye&apos;nin Modern Acenteleri SigortaOS Kullanıyor</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/70 p-6">
                <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">&quot;Yorum alanı — gerçek acente referansları buraya eklenecek. WhatsApp otomasyonu ve yenileme takibi sayesinde dönüşümümüz arttı.&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div><p className="text-sm font-bold text-slate-800">Acente Sahibi</p><p className="text-xs text-slate-400">Şehir · Acente Adı</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 12. SON CTA ══ */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 px-8 py-14 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">Sigorta Acentenizi Büyütmeye Hazır Mısınız?</h2>
              <p className="text-blue-100 max-w-lg mx-auto mb-8">5 dakikada kurun, ilk gün üretmeye başlayın. Kredi kartı gerekmez.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-xl hover:-translate-y-0.5">
                  Ücretsiz Demo Talep Et <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all backdrop-blur-sm">
                  Canlı Önizleme <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-white" /></div>
              <span className="font-bold text-white text-[17px]">SigortaOS</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {NAV.map((n) => <a key={n.label} href={n.href} className="hover:text-white transition-colors">{n.label}</a>)}
              <Link href="/login" className="hover:text-white transition-colors">Giriş Yap</Link>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} SigortaOS — Sigorta Acenteleri İçin İşletim Sistemi. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
