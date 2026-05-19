"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import AnimatedCounter from "@/components/AnimatedCounter";
import WeeklyChart from "@/components/WeeklyChart";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/lib/NotificationContext";
import {
  Users, FileText, Clock, MessageSquare, Zap,
  TrendingUp, CheckCircle2, Activity, Car, Home,
  Heart, Shield, ArrowUpRight, Sparkles, Plus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type IconComp = ComponentType<{ className?: string }>;

type FeedItem = {
  id: string;
  Icon: IconComp;
  iconBg: string;
  iconColor: string;
  message: string;
  sub: string;
  time: string;
  isNew: boolean;
};

type RecentRequest = {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
  customers: { name: string } | null;
};

// ─── Live feed pool (cycles through these) ────────────────────────────────────
type RawFeedEntry = {
  Icon: IconComp;
  iconBg: string;
  iconColor: string;
  message: string;
  sub: string;
};

const FEED_POOL: RawFeedEntry[] = [
  { Icon: Users,         iconBg: "bg-blue-50",    iconColor: "text-blue-600",    message: "Ali Koç trafik sigortası talebi bıraktı",    sub: "Trafik · Yeni" },
  { Icon: MessageSquare, iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", message: "WhatsApp mesajı hazırlandı ve gönderildi",    sub: "AI tarafından oluşturuldu" },
  { Icon: CheckCircle2,  iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", message: "Kasko teklifi tamamlandı",                    sub: "Ayşe Kaya · ₺3.200/yıl" },
  { Icon: Clock,         iconBg: "bg-amber-50",    iconColor: "text-amber-600",   message: "Poliçe yenileme hatırlatması gönderildi",     sub: "Mehmet Demir · 5 gün kaldı" },
  { Icon: Users,         iconBg: "bg-indigo-50",   iconColor: "text-indigo-600",  message: "Zeynep Arslan yeni müşteri olarak eklendi",   sub: "Sağlık sigortası talebi" },
  { Icon: Sparkles,      iconBg: "bg-violet-50",   iconColor: "text-violet-600",  message: "AI teklif mesajı oluşturdu",                  sub: "DASK · 3 sigorta karşılaştırması" },
  { Icon: FileText,      iconBg: "bg-blue-50",     iconColor: "text-blue-600",    message: "Yusuf Aydın kasko formu doldurdu",            sub: "Kasko · Değerlendirmede" },
  { Icon: CheckCircle2,  iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", message: "Fatma Şahin poliçesi başarıyla yenilendi",    sub: "Konut · 1 yıl uzatıldı" },
  { Icon: MessageSquare, iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", message: "Müşteriye dönüş yapıldı",                     sub: "Hasan Bulut · WhatsApp" },
  { Icon: TrendingUp,    iconBg: "bg-indigo-50",   iconColor: "text-indigo-600",  message: "Sağlık talebi artışı tespit edildi",          sub: "Bu hafta +23%" },
  { Icon: Shield,        iconBg: "bg-blue-50",     iconColor: "text-blue-600",    message: "Mert Yıldız İMM talebi bıraktı",             sub: "İMM · Yeni" },
  { Icon: Sparkles,      iconBg: "bg-violet-50",   iconColor: "text-violet-600",  message: "AI operasyon özeti güncellendi",              sub: "Günlük analiz tamamlandı" },
  { Icon: Users,         iconBg: "bg-blue-50",     iconColor: "text-blue-600",    message: "Seda Yıldırım DASK formu tamamladı",         sub: "DASK · Zorunlu" },
  { Icon: CheckCircle2,  iconBg: "bg-emerald-50",  iconColor: "text-emerald-600", message: "Teklif onaylandı ve poliçe kesildi",          sub: "Trafik · 34ABC123" },
];

// ─── Product distribution (mock — last 30 days) ───────────────────────────────
const PRODUCT_DIST = [
  { label: "Trafik", pct: 38, color: "bg-blue-500",    Icon: Car },
  { label: "Kasko",  pct: 24, color: "bg-indigo-500",  Icon: Shield },
  { label: "Sağlık", pct: 18, color: "bg-emerald-500", Icon: Heart },
  { label: "Konut",  pct: 12, color: "bg-amber-500",   Icon: Home },
  { label: "Diğer",  pct:  8, color: "bg-violet-400",  Icon: FileText },
];

// ─── Status map ───────────────────────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  Yeni:       "bg-blue-50 text-blue-700 border border-blue-100",
  İşlemde:    "bg-indigo-50 text-indigo-700 border border-indigo-100",
  Tamamlandı: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  İptal:      "bg-red-50 text-red-700 border border-red-100",
};

// ─── Demo fallback data ───────────────────────────────────────────────────────
const DEMO_STATS = { customers: 128, requests: 34, renewals: 18, today: 9 };
const DEMO_REQUESTS: RecentRequest[] = [
  { id: "r1", request_type: "Kasko",  status: "Yeni",       created_at: new Date(Date.now() - 4 * 60000).toISOString(),   customers: { name: "Ahmet Yılmaz" } },
  { id: "r2", request_type: "Konut",  status: "İşlemde",    created_at: new Date(Date.now() - 22 * 60000).toISOString(),  customers: { name: "Fatma Kaya" } },
  { id: "r3", request_type: "Sağlık", status: "Tamamlandı", created_at: new Date(Date.now() - 65 * 60000).toISOString(),  customers: { name: "Mehmet Demir" } },
  { id: "r4", request_type: "Trafik", status: "Yeni",       created_at: new Date(Date.now() - 120 * 60000).toISOString(), customers: { name: "Zeynep Arslan" } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { notifications } = useNotifications();
  const [isDemo, setIsDemo]         = useState(false);
  const [stats, setStats]           = useState({ customers: 0, requests: 0, renewals: 0, today: 0 });
  const [feedItems, setFeedItems]   = useState<FeedItem[]>([]);
  const [recentReqs, setRecentReqs] = useState<RecentRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [distReady, setDistReady]   = useState(false);
  const feedIdxRef                  = useRef(0);

  // Push a new item to the live feed with fade-in animation
  const pushFeedItem = useCallback((raw: RawFeedEntry) => {
    const newId = `${Date.now()}-${Math.random()}`;
    setFeedItems((prev) => [
      { ...raw, id: newId, time: "Az önce", isNew: true },
      ...prev,
    ].slice(0, 11));
    // Trigger transition after paint
    setTimeout(() => {
      setFeedItems((prev) => prev.map((f) => (f.id === newId ? { ...f, isNew: false } : f)));
    }, 60);
  }, []);

  // ── Data load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const demo =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1";
    setIsDemo(demo);

    if (demo) {
      setStats(DEMO_STATS);
      const seed = FEED_POOL.slice(0, 6).map((item, i) => ({
        ...item,
        id: `seed-${i}`,
        time: ["Az önce", "3 dk önce", "8 dk önce", "15 dk önce", "28 dk önce", "45 dk önce"][i],
        isNew: false,
      }));
      setFeedItems(seed);
      setRecentReqs(DEMO_REQUESTS);
      setLoading(false);
      setTimeout(() => setDistReady(true), 300);
      return;
    }

    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const in30  = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("requests").select("*", { count: "exact", head: true }).in("status", ["Yeni", "İşlemde"]),
        supabase.from("policies").select("*", { count: "exact", head: true }).eq("status", "Aktif").lte("end_date", in30).gte("end_date", today),
        supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("customers").select("id, name, created_at").order("created_at", { ascending: false }).limit(4),
        supabase.from("requests").select("id, request_type, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(6),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any[];

      const [
        { count: totalCustomers },
        { count: openRequests },
        { count: upcomingRenewals },
        { count: todayCount },
        { data: recentCustomers },
        { data: recentRequests },
      ] = results;

      setStats({
        customers:  totalCustomers      ?? 0,
        requests:   openRequests        ?? 0,
        renewals:   upcomingRenewals    ?? 0,
        today:      todayCount          ?? 0,
      });

      // Build feed from real data, fall back to pool items if empty
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const realFeed: FeedItem[] = [
        ...(recentCustomers ?? []).map((c: any) => ({
          id:         c.id,
          Icon:       Users,
          iconBg:     "bg-blue-50",
          iconColor:  "text-blue-600",
          message:    `${c.name} müşteri olarak eklendi`,
          sub:        "Yeni müşteri",
          time:       timeAgo(c.created_at),
          isNew:      false,
        })),
        ...(recentRequests ?? []).map((r: any) => ({
          id:         r.id,
          Icon:       FileText,
          iconBg:     "bg-indigo-50",
          iconColor:  "text-indigo-600",
          message:    `${r.customers?.name ?? "Müşteri"} ${r.request_type} talebi bıraktı`,
          sub:        `${r.request_type} · ${r.status}`,
          time:       timeAgo(r.created_at),
          isNew:      false,
        })),
      ].slice(0, 8);

      const initialFeed = realFeed.length > 0
        ? realFeed
        : FEED_POOL.slice(0, 5).map((item, i) => ({
            ...item,
            id:    `seed-${i}`,
            time:  ["Az önce", "5 dk önce", "14 dk önce", "30 dk önce", "1 sa önce"][i],
            isNew: false,
          }));

      setFeedItems(initialFeed);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecentReqs((recentRequests ?? []) as any);
      setLoading(false);
      setTimeout(() => setDistReady(true), 300);
    }

    load();
  }, []);

  // ── Live feed ticker — adds a new item every ~11 s ───────────────────────
  useEffect(() => {
    if (loading) return;
    const tick = setInterval(() => {
      const item = FEED_POOL[feedIdxRef.current % FEED_POOL.length];
      feedIdxRef.current += 1;
      pushFeedItem(item);
    }, 11000);
    return () => clearInterval(tick);
  }, [loading, pushFeedItem]);

  // ── Stat card definitions ────────────────────────────────────────────────
  const STAT_CARDS = [
    { title: "Toplam Müşteri",    value: stats.customers, Icon: Users,     grad: "from-blue-500 to-blue-600",       bg: "bg-blue-50",    text: "text-blue-600",    badge: "+4 bu hafta",   badgeCls: "text-emerald-700 bg-emerald-50" },
    { title: "Açık Teklif",       value: stats.requests,  Icon: FileText,  grad: "from-indigo-500 to-indigo-600",   bg: "bg-indigo-50",  text: "text-indigo-600",  badge: "Yeni+İşlemde",  badgeCls: "text-gray-500 bg-gray-50" },
    { title: "Yaklaşan Yenileme", value: stats.renewals,  Icon: Clock,     grad: "from-amber-500 to-orange-500",    bg: "bg-amber-50",   text: "text-amber-600",   badge: "30 gün içinde", badgeCls: "text-amber-700 bg-amber-50" },
    { title: "Bugün Eklenen",     value: stats.today,     Icon: Activity,  grad: "from-emerald-500 to-teal-500",    bg: "bg-emerald-50", text: "text-emerald-600", badge: "+3 dün",        badgeCls: "text-emerald-700 bg-emerald-50" },
  ];

  // ── AI summary bullets — use real stats when available ───────────────────
  const aiBullets = [
    `${stats.requests  > 0 ? stats.requests  : 14} açık teklif aksiyon bekliyor`,
    `${stats.renewals  > 0 ? stats.renewals  : 3}  poliçe 30 gün içinde yenilenecek`,
    `Trafik sigortası bu hafta en fazla talep gören ürün`,
    `${stats.today > 0 ? stats.today : 9} müşteri bugün sisteme katıldı`,
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {isDemo ? "Atlas Sigorta — Demo Paneli" : "Dashboard"}
            </h1>
            {isDemo && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                DEMO
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            {new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* System status dots */}
          {["Sistem aktif", "WhatsApp bağlı", "AI hazır"].map((label) => (
            <div key={label} className="hidden sm:flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
          ))}

          <Link
            href="/teklif-al"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Teklif Al
          </Link>
        </div>
      </div>

      {/* ══ AI OPERASYON ÖZETİ ══════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-5">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-blue-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-sm font-semibold text-white">AI Operasyon Özeti</p>
              <span className="text-[10px] text-blue-400 font-medium">
                {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} güncellendi
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6">
              {aiBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-blue-200 leading-relaxed">
                  <span className="text-blue-500 flex-shrink-0 mt-px">▸</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ══ STAT CARDS ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${card.bg} ${card.text} flex items-center justify-center`}>
                <card.Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeCls}`}>
                {card.badge}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{card.title}</p>
            {loading ? (
              <div className="h-8 w-14 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <p className={`text-3xl font-bold bg-gradient-to-r ${card.grad} bg-clip-text text-transparent`}>
                <AnimatedCounter target={card.value} />
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ══ YENİ GELEN TALEPLER ══════════════════════════════════════════════ */}
      {notifications.length > 0 && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <h2 className="font-semibold text-slate-800 text-sm">Yeni Gelen Talepler</h2>
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {notifications.length}
              </span>
            </div>
            <Link href="/requests" className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors flex items-center gap-0.5">
              Tümünü İşleme Al <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                    {n.customer_name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{n.customer_name}</p>
                    <p className="text-[11px] text-gray-400">{n.request_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {n.customer_phone && (
                    <a
                      href={`https://wa.me/${n.customer_phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    Yeni
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ CHART + LIVE FEED ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Weekly chart */}
        <div className="lg:col-span-2">
          <WeeklyChart />
        </div>

        {/* Live activity feed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <h2 className="font-semibold text-slate-800 text-sm">Canlı Akış</h2>
            </div>
            <span className="text-[10px] text-gray-400">Otomatik güncelleniyor</span>
          </div>

          <div className="flex-1 divide-y divide-gray-50 overflow-hidden">
            {loading
              ? [...Array(6)].map((_, i) => (
                  <div key={i} className="px-4 py-3 flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
                      <div className="h-2 bg-gray-50 rounded animate-pulse w-2/5" />
                    </div>
                  </div>
                ))
              : feedItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50/70"
                    style={{
                      opacity:    item.isNew ? 0 : 1,
                      transform:  item.isNew ? "translateY(-6px)" : "translateY(0)",
                      transition: "opacity 0.45s ease, transform 0.45s ease",
                    }}
                  >
                    <div className={`w-7 h-7 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <item.Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 leading-snug">{item.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5 whitespace-nowrap">{item.time}</span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* ══ RECENT REQUESTS + PRODUCT DIST ══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent requests */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Son Teklif Talepleri</h2>
            <Link href="/requests" className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors flex items-center gap-0.5">
              Tümünü gör <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : recentReqs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Henüz teklif talebi yok</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentReqs.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                      {(r.customers?.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.customers?.name ?? "—"}</p>
                      <p className="text-[11px] text-gray-400">{r.request_type} · {timeAgo(r.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? "bg-gray-50 text-gray-600 border border-gray-100"}`}>
                      {r.status}
                    </span>
                    <button className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product distribution + Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h2 className="font-semibold text-slate-800 text-sm">Ürün Dağılımı</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Son 30 gün · teklif bazlı</p>
          </div>

          <div className="p-5 space-y-3.5">
            {PRODUCT_DIST.map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <d.Icon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-slate-600">{d.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{d.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.color} rounded-full`}
                    style={{
                      width:      distReady ? `${d.pct}%` : "0%",
                      transition: "width 0.8s ease-out",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-5 pb-5 mt-auto">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Hızlı İşlemler</p>
            <div className="space-y-2">
              {[
                { label: "Yeni Müşteri Ekle",  href: "/customers", Icon: Plus,          cls: "text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100" },
                { label: "WhatsApp Gönder",     href: "/customers", Icon: MessageSquare, cls: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100" },
                { label: "Teklifleri İncele",   href: "/requests",  Icon: FileText,      cls: "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100" },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${a.cls}`}
                >
                  <a.Icon className="w-3.5 h-3.5" />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
