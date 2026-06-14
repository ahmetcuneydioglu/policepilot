"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import AnimatedCounter from "@/components/AnimatedCounter";
import WeeklyChart from "@/components/WeeklyChart";
import UsageLimits from "@/components/UsageLimits";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/lib/NotificationContext";
import NotifPermissionButton from "@/components/NotifPermissionButton";
import { useAuth } from "@/lib/AuthContext";
import { withAgencyFilter, needsOnboarding } from "@/lib/tenant";
import {
  Users, FileText, Clock, MessageSquare, Zap,
  TrendingUp, CheckCircle2, Activity, Car, Home,
  Heart, Shield, ArrowUpRight, Sparkles, Plus,
  AlertTriangle, CalendarClock, ChevronRight, RefreshCw,
  MessageCircle, XCircle,
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

type RawFeedEntry = {
  Icon: IconComp;
  iconBg: string;
  iconColor: string;
  message: string;
  sub: string;
};

// ─── Live feed pool (cycles through these) ────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

// ─── Onboarding screen (agency_user with no agency yet) ───────────────────────
function OnboardingScreen() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <Shield className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Henüz bir acenteye bağlı değilsiniz
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Hesabınız oluşturuldu ancak bir acenteye atanmadı. Süper yöneticinizden hesabınıza acente atamasını isteyin veya destek alın.
        </p>
        <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Yapılacaklar</p>
          {[
            "Süper yöneticinize hesap e-postanızı bildirin",
            "Acenteler → Kullanıcı ata menüsünden atama yapılmasını isteyin",
            "Atama sonrası bu sayfayı yenileyin",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-xs text-gray-600">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { notifications, newNotifAt } = useNotifications();
  const { role, agencyId, loading: authLoading } = useAuth();

  const [cardHighlighted, setCardHighlighted] = useState(false);
  const [isDemo, setIsDemo]         = useState(false);
  const [stats, setStats]           = useState({ customers: 0, requests: 0, renewals: 0, today: 0, renewedThisMonth: 0 });
  const [feedItems, setFeedItems]   = useState<FeedItem[]>([]);
  const [recentReqs, setRecentReqs] = useState<RecentRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [distReady, setDistReady]   = useState(false);
  const [waStats, setWaStats]       = useState<{ pending: number; sent: number; failed: number } | null>(null);

  // ── WhatsApp kuyruk istatistikleri — bugünün kayıtları (TR günü) ───────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/whatsapp/queue?limit=500");
        const json = await res.json();
        if (!res.ok) return;
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
        type Row = { status: string; created_at: string };
        const rows = ((json.items ?? []) as Row[]).filter(r => (r.created_at ?? "").slice(0, 10) === today);
        setWaStats({
          pending: rows.filter(r => r.status === "pending").length,
          sent:    rows.filter(r => r.status === "sent" || r.status === "skipped").length,
          failed:  rows.filter(r => r.status === "failed").length,
        });
      } catch {
        // İstatistik alınamazsa kartlar gizli kalır — dashboard'u bozmaz
      }
    })();
  }, []);
  const [agencyName, setAgencyName]   = useState<string | null>(null);
  const [agencySlug, setAgencySlug]   = useState<string | null>(null);
  const [linkCopied, setLinkCopied]   = useState(false);
  const [renewalInfo, setRenewalInfo] = useState<{ premium: number; topBranch: string | null }>({ premium: 0, topBranch: null });
  const [urgent, setUrgent] = useState<{ tomorrow: number; thisWeek: number; overdue: number }>({ tomorrow: 0, thisWeek: 0, overdue: 0 });
  const feedIdxRef                  = useRef(0);

  // ── Push a new item to the live feed with fade-in animation ───────────────
  const pushFeedItem = useCallback((raw: RawFeedEntry) => {
    const newId = `${Date.now()}-${Math.random()}`;
    setFeedItems((prev) => [
      { ...raw, id: newId, time: "Az önce", isNew: true },
      ...prev,
    ].slice(0, 11));
    setTimeout(() => {
      setFeedItems((prev) => prev.map((f) => (f.id === newId ? { ...f, isNew: false } : f)));
    }, 60);
  }, []);

  // ── Data load — waits for auth, scoped to agency ──────────────────────────
  useEffect(() => {
    if (authLoading) return; // Wait until auth is resolved

    // Onboarding case: agency_user with no agency
    if (role === "agency_user" && !agencyId) {
      setLoading(false);
      return;
    }

    const demo =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1" &&
      role === "super_admin"; // Demo mode only for super_admin
    setIsDemo(demo);

    setLoading(true);

    if (demo) {
      setStats({ customers: 128, requests: 34, renewals: 18, today: 9, renewedThisMonth: 42 });
      const seed = FEED_POOL.slice(0, 6).map((item, i) => ({
        ...item,
        id: `seed-${i}`,
        time: ["Az önce", "3 dk önce", "8 dk önce", "15 dk önce", "28 dk önce", "45 dk önce"][i],
        isNew: false,
      }));
      setFeedItems(seed);
      setRecentReqs([
        { id: "r1", request_type: "Kasko",  status: "Yeni",       created_at: new Date(Date.now() - 4 * 60000).toISOString(),   customers: { name: "Ahmet Yılmaz" } },
        { id: "r2", request_type: "Konut",  status: "İşlemde",    created_at: new Date(Date.now() - 22 * 60000).toISOString(),  customers: { name: "Fatma Kaya" } },
        { id: "r3", request_type: "Sağlık", status: "Tamamlandı", created_at: new Date(Date.now() - 65 * 60000).toISOString(),  customers: { name: "Mehmet Demir" } },
        { id: "r4", request_type: "Trafik", status: "Yeni",       created_at: new Date(Date.now() - 120 * 60000).toISOString(), customers: { name: "Zeynep Arslan" } },
      ]);
      setLoading(false);
      setTimeout(() => setDistReady(true), 300);
      return;
    }

    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const in30  = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await Promise.all([
        withAgencyFilter(supabase.from("customers").select("*", { count: "exact", head: true }), role, agencyId),
        withAgencyFilter(supabase.from("requests").select("*", { count: "exact", head: true }).in("status", ["Yeni", "İşlemde"]), role, agencyId),
        withAgencyFilter(supabase.from("policies").select("*", { count: "exact", head: true }).eq("status", "Aktif").lte("end_date", in30).gte("end_date", today), role, agencyId),
        withAgencyFilter(supabase.from("customers").select("*", { count: "exact", head: true }).gte("created_at", today), role, agencyId),
        withAgencyFilter(supabase.from("customers").select("id, name, created_at").order("created_at", { ascending: false }).limit(4), role, agencyId),
        withAgencyFilter(supabase.from("requests").select("id, request_type, status, created_at, customers(name)").order("created_at", { ascending: false }).limit(6), role, agencyId),
        withAgencyFilter(supabase.from("policies").select("policy_type, premium").eq("status", "Aktif").lte("end_date", in30).gte("end_date", today), role, agencyId),
        withAgencyFilter(supabase.from("policies").select("end_date").eq("status", "Aktif").gte("end_date", new Date(Date.now() - 60 * 864e5).toISOString().split("T")[0]).lte("end_date", new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0]), role, agencyId),
        withAgencyFilter(supabase.from("policies").select("*", { count: "exact", head: true }).eq("renewal_status", "completed").gte("renewed_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()), role, agencyId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]) as any[];

      const [
        { count: totalCustomers },
        { count: openRequests },
        { count: upcomingRenewals },
        { count: todayCount },
        { data: recentCustomers },
        { data: recentRequests },
        { data: renewalPolicies },
        { data: urgentPolicies },
        { count: renewedThisMonth },
      ] = results;

      // Acil İşler: yarın / bu hafta / geciken segmentleri
      const tomorrowStr = new Date(Date.now() + 864e5).toISOString().split("T")[0];
      const up = (urgentPolicies ?? []) as { end_date: string }[];
      setUrgent({
        tomorrow: up.filter(p => p.end_date === tomorrowStr).length,
        thisWeek: up.filter(p => p.end_date >= today && p.end_date <= new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0]).length,
        overdue:  up.filter(p => p.end_date < today).length,
      });

      // Yenileme detayları: tahmini prim + en çok yenilenecek branş
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rp = (renewalPolicies ?? []) as { policy_type: string; premium: number | null }[];
      const renewalPremium = rp.reduce((s, p) => s + (p.premium ?? 0), 0);
      const branchCounts: Record<string, number> = {};
      rp.forEach(p => { branchCounts[p.policy_type] = (branchCounts[p.policy_type] ?? 0) + 1; });
      const topBranch = Object.entries(branchCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      setRenewalInfo({ premium: renewalPremium, topBranch });

      setStats({
        customers:        totalCustomers   ?? 0,
        requests:         openRequests     ?? 0,
        renewals:         upcomingRenewals ?? 0,
        today:            todayCount       ?? 0,
        renewedThisMonth: renewedThisMonth ?? 0,
      });

      // Build feed from real data only (no pool fallback for fresh agencies)
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

      setFeedItems(realFeed); // Empty for new agency — live ticker will fill in

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecentReqs((recentRequests ?? []) as any);

      // Fetch agency name for header
      if (role === "agency_user" && agencyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: agencyData } = await (supabase.from("agencies") as any)
          .select("name, slug")
          .eq("id", agencyId)
          .maybeSingle();
        if (agencyData?.name) setAgencyName(agencyData.name);
        if (agencyData?.slug) setAgencySlug(agencyData.slug);
      }

      setLoading(false);
      setTimeout(() => setDistReady(true), 300);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, role, agencyId]);

  // ── Highlight "Yeni Gelen Talepler" card for 3 s on new realtime notif ───
  useEffect(() => {
    if (newNotifAt === 0) return;
    setCardHighlighted(true);
    const t = setTimeout(() => setCardHighlighted(false), 3000);
    return () => clearTimeout(t);
  }, [newNotifAt]);

  // ── Live feed ticker — adds a new item every ~11 s ───────────────────────
  // Only run for super_admin or agencies with existing data
  useEffect(() => {
    if (loading) return;
    if (role === "agency_user" && stats.customers === 0) return; // No ticker for fresh agencies
    const tick = setInterval(() => {
      const item = FEED_POOL[feedIdxRef.current % FEED_POOL.length];
      feedIdxRef.current += 1;
      pushFeedItem(item);
    }, 11000);
    return () => clearInterval(tick);
  }, [loading, pushFeedItem, role, stats.customers]);

  // ─── AI summary bullets — tenant-specific, no hardcoded fallback numbers ──
  const isNewAgency = role === "agency_user" && !loading && stats.customers === 0;
  const aiBullets = isNewAgency
    ? [
        "Henüz teklif talebi bulunmuyor — sistem yeni kurulmuş",
        "Müşteri eklendiğinde poliçe yenilemeleri burada görünür",
        "Teklif linkinizi müşterilerinizle paylaşmaya başlayın",
        "Sol menü → Müşteriler → Yeni Müşteri ile ilk kaydı oluşturun",
      ]
    : [
        stats.requests > 0
          ? `${stats.requests} açık teklif aksiyon bekliyor`
          : "Tüm teklifler tamamlandı veya bekleyen talep yok",
        stats.renewals > 0
          ? `${stats.renewals} poliçe 30 gün içinde yenilenecek — Yenilemeler sayfasından takip edin`
          : "30 gün içinde yenilenecek poliçe bulunmuyor",
        renewalInfo.premium > 0
          ? `Tahmini yenileme primi: ${renewalInfo.premium.toLocaleString("tr-TR")} ₺ (30 gün)`
          : "Yaklaşan yenilemelerden prim beklentisi henüz oluşmadı",
        renewalInfo.topBranch
          ? `En çok yenilenecek branş: ${renewalInfo.topBranch}`
          : "Trafik sigortası bu hafta en fazla talep gören ürün",
        stats.today > 0
          ? `${stats.today} müşteri bugün sisteme katıldı`
          : "Bugün henüz yeni müşteri eklenmedi",
      ];

  // ── Stat card definitions ────────────────────────────────────────────────
  const STAT_CARDS = [
    { title: "Toplam Müşteri",    value: stats.customers,        Icon: Users,     grad: "from-blue-500 to-blue-600",       bg: "bg-blue-50",    text: "text-blue-600",    badge: "+4 bu hafta",   badgeCls: "text-emerald-700 bg-emerald-50" },
    { title: "Açık Teklif",       value: stats.requests,         Icon: FileText,  grad: "from-indigo-500 to-indigo-600",   bg: "bg-indigo-50",  text: "text-indigo-600",  badge: "Yeni+İşlemde",  badgeCls: "text-gray-500 bg-gray-50" },
    { title: "Yaklaşan Yenileme", value: stats.renewals,         Icon: Clock,     grad: "from-amber-500 to-orange-500",    bg: "bg-amber-50",   text: "text-amber-600",   badge: "30 gün içinde", badgeCls: "text-amber-700 bg-amber-50" },
    { title: "Bu Ay Yenilenen",   value: stats.renewedThisMonth, Icon: RefreshCw, grad: "from-violet-500 to-purple-600",   bg: "bg-violet-50",  text: "text-violet-600",  badge: "tamamlandı",    badgeCls: "text-violet-700 bg-violet-50" },
    { title: "Bugün Eklenen",     value: stats.today,            Icon: Activity,  grad: "from-emerald-500 to-teal-500",    bg: "bg-emerald-50", text: "text-emerald-600", badge: "bugün",         badgeCls: "text-emerald-700 bg-emerald-50" },
  ];

  // ── Show onboarding for agency_user with no agency ────────────────────────
  if (!authLoading && needsOnboarding(role, agencyId, authLoading)) {
    return <OnboardingScreen />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ══ NOTIFICATION PERMISSION BANNER ══════════════════════════════════ */}
      <NotifPermissionButton />

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {isDemo
                ? "Atlas Sigorta — Demo Paneli"
                : agencyName
                ? `${agencyName} Paneli`
                : "Dashboard"}
            </h1>
            {isDemo && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                DEMO
              </span>
            )}
            {!isDemo && agencyName && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                Acente
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            {new Date().toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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

      {/* ══ ACENTE TEKLİF LİNKİ (agency_user only) ════════════════════════ */}
      {role === "agency_user" && agencySlug && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-0.5">Teklif Formu Linkiniz</p>
              <p className="text-sm font-mono text-blue-900 truncate">
                {typeof window !== "undefined" ? window.location.origin : ""}/a/{agencySlug}/teklif-al
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                const url = `${window.location.origin}/a/${agencySlug}/teklif-al`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              {linkCopied ? (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Kopyalandı!</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Kopyala</>
              )}
            </button>
            <a
              href={`/a/${agencySlug}/teklif-al`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Önizle
            </a>
          </div>
        </div>
      )}

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
              {isNewAgency && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium">
                  Yeni sistem
                </span>
              )}
              {!isNewAgency && (
                <span className="text-[10px] text-blue-400 font-medium">
                  {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} güncellendi
                </span>
              )}
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

      {/* ══ WHATSAPP OPERASYON KARTLARI ═════════════════════════════════════ */}
      {waStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Bugün Gönderilecek WhatsApp", value: waStats.pending, Icon: Clock,        ring: "ring-amber-200",   iconBg: "bg-amber-100 text-amber-600",     accent: "text-amber-700" },
            { label: "Başarılı Gönderimler",        value: waStats.sent,    Icon: CheckCircle2, ring: "ring-emerald-200", iconBg: "bg-emerald-100 text-emerald-600", accent: "text-emerald-700" },
            { label: "Başarısız Gönderimler",       value: waStats.failed,  Icon: XCircle,      ring: "ring-rose-200",    iconBg: "bg-rose-100 text-rose-600",       accent: "text-rose-700" },
          ].map(c => (
            <Link key={c.label} href="/whatsapp-queue"
              className={`flex items-center gap-3 bg-white rounded-xl p-3.5 ring-1 ${c.ring} hover:shadow-md hover:-translate-y-0.5 transition-all`}
            >
              <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                <c.Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xl font-bold leading-none ${c.accent}`}>{c.value}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-emerald-500" /> {c.label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ══ ACİL İŞLER ══════════════════════════════════════════════════════ */}
      {!loading && (urgent.tomorrow > 0 || urgent.thisWeek > 0 || urgent.overdue > 0) && (
        <div className="rounded-2xl border-2 border-red-200/70 bg-gradient-to-r from-red-50/80 via-orange-50/60 to-amber-50/50 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shadow-md shadow-red-500/30">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Acil İşler</p>
                <p className="text-[11px] text-slate-400">Yenileme takibi gerektiren poliçeler</p>
              </div>
            </div>
            <Link href="/renewals"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors shadow-sm"
            >
              Yenilemelere Git <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Yarın Bitecek",    value: urgent.tomorrow, Icon: CalendarClock, accent: "text-red-600",    ring: "ring-red-200",    iconBg: "bg-red-100 text-red-600",       filter: "Bugün" },
              { label: "Bu Hafta Bitecek", value: urgent.thisWeek, Icon: Clock,         accent: "text-orange-600", ring: "ring-orange-200", iconBg: "bg-orange-100 text-orange-600", filter: "Bu Hafta" },
              { label: "Geciken Yenileme", value: urgent.overdue,  Icon: AlertTriangle, accent: "text-rose-700",   ring: "ring-rose-200",   iconBg: "bg-rose-100 text-rose-600",     filter: "Geciken" },
            ].map(c => (
              <Link key={c.label} href="/renewals"
                className={`flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-3.5 ring-1 ${c.ring} hover:shadow-md hover:-translate-y-0.5 transition-all`}
              >
                <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <c.Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xl font-bold leading-none ${c.accent}`}>{c.value}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{c.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ STAT CARDS ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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

      {/* ══ PAKET KULLANIMI (agency_user only) ══════════════════════════════ */}
      {role === "agency_user" && agencyId && <UsageLimits />}

      {/* ══ YENİ GELEN TALEPLER — notifications are already agency-scoped ════ */}
      {notifications.length > 0 && (
        <div
          className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-500 ${
            cardHighlighted
              ? "bg-blue-50 border-2 border-blue-400 shadow-blue-100 shadow-lg"
              : "bg-white border border-blue-100"
          }`}
        >
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
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 ${cardHighlighted ? "animate-pulse" : ""}`}>
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
            <span className="text-[10px] text-gray-400">
              {isNewAgency ? "Aktivite bekleniyor" : "Otomatik güncelleniyor"}
            </span>
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
              : feedItems.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center">
                    <Zap className="w-8 h-8 text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">Müşteri eklendikçe burada aktivite görünecek</p>
                  </div>
                )
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
            <div className="px-5 py-10 text-center">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Henüz teklif talebi yok</p>
              <p className="text-xs text-gray-300 mt-1">
                Müşteriler teklif formu doldurduğunda burada görünür
              </p>
            </div>
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
                  <span className="text-xs font-bold text-slate-700">
                    {isNewAgency ? "—" : `${d.pct}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.color} rounded-full`}
                    style={{
                      width:      distReady && !isNewAgency ? `${d.pct}%` : "0%",
                      transition: "width 0.8s ease-out",
                    }}
                  />
                </div>
              </div>
            ))}
            {isNewAgency && (
              <p className="text-[10px] text-gray-400 text-center pt-1">
                Teklifler oluştukça dağılım gösterilecek
              </p>
            )}
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
