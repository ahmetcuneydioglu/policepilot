"use client";

/**
 * PolicePilot — Renewal Engine
 *
 * Poliçe bitiş tarihlerini takip eder, yenileme fırsatlarını yönetir.
 * Multi-tenant: agency_user yalnızca kendi kayıtlarını görür.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  RefreshCw, Search, CalendarClock, CalendarDays,
  CalendarRange, AlertTriangle, Mail, Zap, Award,
  TrendingUp, ChevronRight, Trash2, FolderOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type RenewalPolicy = {
  id: string;
  customer_id: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium: number | null;
  status: string;
  agency_id: string | null;
  insurance_company: string | null;
  policy_no: string | null;
  renewal_status: string | null; // pending | quoted | completed
  customers: { name: string; phone: string } | null;
};

type FilterKey = "Tümü" | "Bugün" | "Bu Hafta" | "30 Gün" | "Geciken";

// Quoted poliçenin aktif teklif çalışması (tek kaynak: quote_runs)
type ActiveRun = { runId: string; offerCount: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysLeft(endDate: string): number {
  const end = new Date(endDate); end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}

function dayBadge(days: number): { label: string; cls: string; bar: string; glow: string } {
  // Aciliyet renk sistemi: 0 kırmızı · 1-3 turuncu · 4-7 sarı · 7+ yeşil
  if (days < 0)   return { label: `${Math.abs(days)} gün gecikti`, cls: "bg-red-100 text-red-700 ring-1 ring-red-200",             bar: "bg-red-500",     glow: "bg-red-50/40 shadow-[inset_3px_0_0_0_#ef4444,0_0_16px_-4px_rgba(239,68,68,0.35)]" };
  if (days === 0) return { label: "Bugün",                          cls: "bg-red-100 text-red-700 ring-1 ring-red-200",             bar: "bg-red-500",     glow: "bg-red-50/40 shadow-[inset_3px_0_0_0_#ef4444,0_0_16px_-4px_rgba(239,68,68,0.35)]" };
  if (days <= 3)  return { label: `${days} gün`,                    cls: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",    bar: "bg-orange-500",  glow: "bg-orange-50/40 shadow-[inset_3px_0_0_0_#f97316,0_0_14px_-4px_rgba(249,115,22,0.30)]" };
  if (days <= 7)  return { label: `${days} gün`,                    cls: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200",    bar: "bg-yellow-400",  glow: "bg-yellow-50/40 shadow-[inset_3px_0_0_0_#eab308]" };
  return            { label: `${days} gün`,                          cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", bar: "bg-emerald-500", glow: "" };
}

// ─── Demo tasarruf/komisyon hesabı (deterministik, policy id bazlı) ───────────
function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function demoEconomics(p: { id: string; premium: number | null }): { savings: number; commission: number; bestQuote: number } | null {
  if (p.premium == null || p.premium <= 0) return null;
  const h = hash32(p.id);
  const savingsRate = 0.10 + (h % 9) / 100;            // %10–%18 arası
  const savings     = Math.round(p.premium * savingsRate / 10) * 10;
  const bestQuote   = p.premium - savings;
  const commission  = Math.round(bestQuote * 0.08 / 10) * 10; // ~%8 komisyon
  return { savings, commission, bestQuote };
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function waPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "90");
}

function buildRenewalMessage(p: RenewalPolicy): string {
  const days = daysLeft(p.end_date);
  const when =
    days < 0   ? "süresi dolmuştur" :
    days === 0 ? "bugün sona eriyor" :
    `${days} gün içinde (${fmtDate(p.end_date)}) sona erecek`;
  return (
    `Merhaba ${p.customers?.name ?? "Sayın Müşterimiz"},\n\n` +
    `${p.policy_type} poliçenizin ${when}.\n\n` +
    `Kesintisiz güvenceniz için yenileme teklifinizi hazırlamak isteriz. ` +
    `Size en uygun fiyatları karşılaştırıp sunacağız.\n\n` +
    `Uygun olduğunuz bir zamanda dönüş yapabilirsiniz. 🛡️`
  );
}

const WA_SVG = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid grid-cols-12 gap-2 px-5 py-4 items-center" style={{ animationDelay: `${delay}ms` }}>
      <div className="col-span-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-2 w-14 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="col-span-2"><div className="h-6 w-20 bg-slate-100 rounded-lg animate-pulse" /></div>
      <div className="col-span-2"><div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" /></div>
      <div className="col-span-2"><div className="h-3 w-20 bg-slate-100 rounded animate-pulse" /></div>
      <div className="col-span-2"><div className="h-7 w-24 bg-slate-100 rounded-lg animate-pulse" /></div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RenewalsPage() {
  const router = useRouter();
  const { role, agencyId } = useAuth();

  const [policies, setPolicies] = useState<RenewalPolicy[]>([]);
  const [runs,     setRuns]     = useState<Record<string, ActiveRun>>({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterKey>("Tümü");
  const [search,   setSearch]   = useState("");

  // İptal onay modalı
  const [cancelTarget, setCancelTarget] = useState<RenewalPolicy | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState("");

  // ── Fetch — agency scoped ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    // Pencere: 60 gün geçmiş → 90 gün gelecek (yenileme operasyon penceresi)
    const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const to   = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("policies") as any)
      .select("id, customer_id, policy_type, start_date, end_date, premium, status, agency_id, insurance_company, policy_no, renewal_status, customers(name, phone)")
      .eq("status", "Aktif")
      .neq("renewal_status", "completed") // tamamlanan yenilemeler listeden düşer
      .gte("end_date", from)
      .lte("end_date", to)
      .order("end_date", { ascending: true });
    if (role === "agency_user" && agencyId) q = q.eq("agency_id", agencyId);

    const { data, error } = await q;
    if (error) console.error("[renewals] fetch error:", error.message);
    const pols = (data ?? []) as RenewalPolicy[];
    setPolicies(pols);

    // Quoted poliçelerin aktif teklif çalışmalarını çek — Teklif Merkezi ile
    // aynı API ve aynı kayıt kullanılır, ayrı state/lifecycle tutulmaz.
    const quotedIds = new Set(pols.filter(p => p.renewal_status === "quoted").map(p => p.id));
    if (quotedIds.size > 0) {
      try {
        const res  = await fetch(`/api/quote-runs${agencyId ? `?agency_id=${agencyId}` : ""}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "runs fetch failed");

        const map: Record<string, ActiveRun> = {};
        type RunRow = {
          id: string;
          renewal_of_policy_id: string | null;
          status: string;
          quote_results?: { id: string; price: number | null }[];
        };
        // API created_at desc döner → poliçe başına ilk görülen = en güncel run
        for (const r of (json.runs ?? []) as RunRow[]) {
          const pid = r.renewal_of_policy_id;
          if (!pid || !quotedIds.has(pid) || r.status === "İptal" || map[pid]) continue;
          map[pid] = {
            runId:      r.id,
            offerCount: (r.quote_results ?? []).filter(x => x.price != null).length,
          };
        }
        setRuns(map);
      } catch (e) {
        console.error("[renewals] runs fetch error:", e);
        setRuns({});
      }
    } else {
      setRuns({});
    }
    setLoading(false);
  }, [role, agencyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Segmentler ─────────────────────────────────────────────────────────────
  const overdue  = policies.filter(p => daysLeft(p.end_date) < 0);
  const today    = policies.filter(p => daysLeft(p.end_date) === 0);
  const thisWeek = policies.filter(p => { const d = daysLeft(p.end_date); return d >= 0 && d <= 7; });
  const in30     = policies.filter(p => { const d = daysLeft(p.end_date); return d >= 0 && d <= 30; });

  const estPremium = in30.reduce((s, p) => s + (p.premium ?? 0), 0);

  // ── Filtre + arama ─────────────────────────────────────────────────────────
  const filtered = policies
    .filter(p => {
      const d = daysLeft(p.end_date);
      if (filter === "Bugün")    return d === 0;
      if (filter === "Bu Hafta") return d >= 0 && d <= 7;
      if (filter === "30 Gün")   return d >= 0 && d <= 30;
      if (filter === "Geciken")  return d < 0;
      return true;
    })
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (p.customers?.name ?? "").toLowerCase().includes(q)
        || p.policy_type.toLowerCase().includes(q)
        || (p.insurance_company ?? "").toLowerCase().includes(q)
        || (p.policy_no ?? "").toLowerCase().includes(q);
    });

  // ── Teklif Çalış — tek tıkla otomatik teklif akışı ─────────────────────────
  // Tüm bilgiler poliçeden otomatik çekilir; müşteri/ürün/araç adımları atlanır.
  function startQuote(p: RenewalPolicy) {
    router.push(`/renewals/quote/${p.id}`);
  }

  // ── Teklifi Aç — mevcut çalışmanın detayına git (çift quote oluşmaz) ───────
  function openQuote(p: RenewalPolicy) {
    const run = runs[p.id];
    if (run) router.push(`/quote-center/${run.runId}`);
  }

  // ── İptal Et — run "İptal" olur, poliçe "pending"e döner ───────────────────
  async function confirmCancel() {
    if (!cancelTarget) return;
    const run = runs[cancelTarget.id];
    if (!run) { setCancelTarget(null); return; }

    setCancelling(true);
    setCancelError("");
    try {
      const res  = await fetch(`/api/quote-runs/${run.runId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "İptal" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCancelError(json.error ?? "İptal işlemi başarısız oldu.");
        return;
      }
      // UI'ı sayfa yenilemeden güncelle
      setPolicies(prev => prev.map(p =>
        p.id === cancelTarget.id ? { ...p, renewal_status: "pending" } : p
      ));
      setRuns(prev => {
        const next = { ...prev };
        delete next[cancelTarget.id];
        return next;
      });
      setCancelTarget(null);
    } catch {
      setCancelError("Sunucuya ulaşılamadı. Tekrar deneyin.");
    } finally {
      setCancelling(false);
    }
  }

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const KPI_CARDS: { key: FilterKey; label: string; value: number; Icon: typeof CalendarClock; grad: string; ring: string; iconBg: string; val: string }[] = [
    { key: "Bugün",    label: "Bugün Yenilenecek", value: today.length,    Icon: CalendarClock, grad: "from-red-50 to-red-100/60",       ring: "ring-red-200/60",     iconBg: "bg-red-500",     val: "text-red-700" },
    { key: "Bu Hafta", label: "Bu Hafta",          value: thisWeek.length, Icon: CalendarDays,  grad: "from-orange-50 to-orange-100/60", ring: "ring-orange-200/60",  iconBg: "bg-orange-500",  val: "text-orange-700" },
    { key: "30 Gün",   label: "30 Gün İçinde",     value: in30.length,     Icon: CalendarRange, grad: "from-amber-50 to-amber-100/60",   ring: "ring-amber-200/60",   iconBg: "bg-amber-500",   val: "text-amber-700" },
    { key: "Geciken",  label: "Gecikenler",        value: overdue.length,  Icon: AlertTriangle, grad: "from-rose-50 to-rose-100/60",     ring: "ring-rose-200/60",    iconBg: "bg-rose-600",    val: "text-rose-700" },
  ];

  const FILTERS: FilterKey[] = ["Tümü", "Bugün", "Bu Hafta", "30 Gün", "Geciken"];

  return (
    <div className="relative space-y-6">

      {/* ── Ambient background ── */}
      <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-slate-50 via-amber-50/20 to-orange-50/10 pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/30">
              <RefreshCw className="w-[18px] h-[18px] text-white" />
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Yenilemeler</h1>
          </div>
          <p className="text-sm text-slate-400 pl-[46px]">
            Poliçe bitiş tarihlerini takip edin, yenileme fırsatlarını kaçırmayın.
          </p>
        </div>

        {estPremium > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/70 backdrop-blur-sm border border-emerald-200/60 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tahmini Yenileme Primi (30 gün)</p>
              <p className="text-lg font-bold text-emerald-700 leading-tight">{fmt(estPremium)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(filter === c.key ? "Tümü" : c.key)}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} ring-1 ${c.ring} p-4 text-left
              hover:-translate-y-0.5 hover:shadow-md transition-all duration-200
              ${filter === c.key ? "ring-2 shadow-md" : ""}`}
          >
            <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center mb-3 shadow-sm`}>
              <c.Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{c.label}</p>
            <p className={`text-[26px] font-bold mt-1 leading-none ${c.val}`}>
              {loading ? <span className="inline-block w-10 h-6 rounded bg-current opacity-20 animate-pulse" /> : c.value}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri, tür, şirket veya poliçe no ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>

        <div className="flex items-center bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm gap-0.5 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                filter === f
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="p-2.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">

        {loading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} delay={i * 80} />)}
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="absolute inset-0 bg-amber-100 rounded-2xl animate-ping opacity-30" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center shadow-inner">
                <CalendarClock className="w-7 h-7 text-amber-400" />
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">
              {search || filter !== "Tümü" ? "Sonuç bulunamadı" : "Yaklaşan yenileme yok"}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              {search || filter !== "Tümü"
                ? "Arama kriterlerinizi veya filtreyi değiştirin"
                : "Önümüzdeki 90 gün içinde bitecek aktif poliçe bulunmuyor"}
            </p>
          </div>

        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Müşteri</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Poliçe</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kalan</div>
              <div className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prim</div>
              <div className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasarruf</div>
              <div className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Komisyon</div>
              <div className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Aksiyonlar</div>
            </div>

            <div className="divide-y divide-slate-50/80">
              {filtered.map(p => {
                const d     = daysLeft(p.end_date);
                const badge = dayBadge(d);
                const phone = p.customers?.phone ?? "";
                const waMsg = buildRenewalMessage(p);
                const eco   = demoEconomics(p);

                return (
                  <div key={p.id} className={`grid grid-cols-12 gap-2 px-5 py-4 hover:bg-amber-50/30 transition-all duration-150 group items-center ${badge.glow}`}>

                    {/* Müşteri */}
                    <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                          {initials(p.customers?.name ?? null)}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${badge.bar}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.customers?.name ?? "—"}</p>
                        {phone && <p className="text-[11px] text-slate-400 truncate">{phone}</p>}
                      </div>
                    </div>

                    {/* Poliçe */}
                    <div className="col-span-2 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-700">{p.policy_type}</p>
                        {p.renewal_status === "quoted" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold ring-1 ring-violet-200">
                            <Zap className="w-2.5 h-2.5" /> Teklif Çalışıldı
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold ring-1 ring-slate-200">
                            Hazır
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{p.insurance_company ?? "—"}</p>
                    </div>

                    {/* Kalan */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.bar}`} />
                        {badge.label}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">{fmtDate(p.end_date)}</p>
                    </div>

                    {/* Mevcut Prim */}
                    <div className="col-span-1">
                      <span className={`text-xs font-bold ${p.premium ? "text-slate-700" : "text-slate-300"}`}>{fmt(p.premium)}</span>
                    </div>

                    {/* Potansiyel Tasarruf */}
                    <div className="col-span-1">
                      {eco ? (
                        <div>
                          <span className="text-xs font-bold text-emerald-600">{fmt(eco.savings)}</span>
                          <p className="text-[10px] text-slate-400">en düşük {fmt(eco.bestQuote)}</p>
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </div>

                    {/* Tahmini Komisyon */}
                    <div className="col-span-1">
                      {eco ? (
                        <span className="text-xs font-bold text-violet-600">{fmt(eco.commission)}</span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </div>

                    {/* Aksiyonlar */}
                    <div className="col-span-3 flex items-center justify-end gap-1.5 flex-wrap">
                      {/* WhatsApp */}
                      {phone ? (
                        <a
                          href={`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(waMsg)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200"
                          title="WhatsApp yenileme mesajı"
                        >
                          {WA_SVG} WA
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-300 text-[11px] font-bold ring-1 ring-slate-100 cursor-not-allowed" title="Telefon bilgisi yok">
                          {WA_SVG} WA
                        </span>
                      )}

                      {/* Mail */}
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`${p.policy_type} Poliçe Yenileme Hatırlatması`)}&body=${encodeURIComponent(waMsg)}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100 transition-colors ring-1 ring-blue-200"
                        title="E-posta gönder"
                      >
                        <Mail className="w-3 h-3" /> Mail
                      </a>

                      {/* Durum bazlı aksiyon: pending → Teklif Çalış · quoted → Teklifi Aç + İptal */}
                      {p.renewal_status === "quoted" && runs[p.id] ? (
                        <>
                          <button
                            onClick={() => openQuote(p)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-bold hover:from-violet-500 hover:to-purple-500 transition-all shadow-sm shadow-violet-500/20"
                            title="Hazırlanan teklif çalışmasını aç"
                          >
                            <FolderOpen className="w-3 h-3" />
                            {runs[p.id].offerCount > 0 ? `${runs[p.id].offerCount} Teklifi Aç` : "Teklifi Aç"}
                            <ChevronRight className="w-3 h-3 -mr-0.5" />
                          </button>
                          <button
                            onClick={() => { setCancelError(""); setCancelTarget(p); }}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-bold hover:bg-rose-100 transition-colors ring-1 ring-rose-200"
                            title="Teklif çalışmasını iptal et"
                          >
                            <Trash2 className="w-3 h-3" /> İptal
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startQuote(p)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm shadow-violet-500/20"
                          title="Yenileme teklifi çalış"
                        >
                          <Zap className="w-3 h-3" /> Teklif Çalış
                          <ChevronRight className="w-3 h-3 -mr-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-600">{filtered.length}</span> yenileme fırsatı
                {filter !== "Tümü" && <span> · <span className="text-amber-600">&ldquo;{filter}&rdquo;</span> filtresi</span>}
              </p>
              {estPremium > 0 && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Award className="w-3 h-3 text-emerald-500" />
                  30 günlük potansiyel: <span className="font-bold text-emerald-600">{fmt(estPremium)}</span>
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── İptal onay modalı ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !cancelling && setCancelTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  Teklif çalışmasını iptal etmek istiyor musunuz?
                </h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  <span className="font-semibold text-slate-700">{cancelTarget.customers?.name ?? "Müşteri"}</span> için
                  hazırlanan teklif çalışması iptal edilecek. Kayıt yeniden{" "}
                  <span className="font-semibold">&ldquo;Teklif Çalış&rdquo;</span> durumuna döner; istediğiniz zaman
                  yeni teklif çalışabilirsiniz.
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {cancelError}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-sm shadow-rose-500/20"
              >
                {cancelling ? "İptal ediliyor…" : "İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
