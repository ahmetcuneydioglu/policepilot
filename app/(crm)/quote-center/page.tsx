"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, TrendingUp, CheckCircle2,
  ChevronRight, Search,
  FileText, Car, Home, Heart, Shield, Globe,
  RefreshCw, Trash2, Zap, Target, BarChart3, Activity,
} from "lucide-react";

// ─── WA SVG (small) ───────────────────────────────────────────────────────────
const WA_SMALL = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
export type QuoteRunStatus =
  | "Yeni"
  | "Teklif Verildi"
  | "Müşteri Düşünüyor"
  | "Kazanıldı"
  | "Kaybedildi";

type QuoteRun = {
  id: string;
  agency_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_type: string;
  status: QuoteRunStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  result_count: number;
  best_price: number | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<QuoteRunStatus, { label: string; pill: string; dot: string }> = {
  "Yeni":               { label: "Yeni",               pill: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20",           dot: "bg-blue-500" },
  "Teklif Verildi":     { label: "Teklif Verildi",     pill: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",       dot: "bg-amber-500" },
  "Müşteri Düşünüyor":  { label: "Müşteri Düşünüyor",  pill: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",        dot: "bg-amber-500" },
  "Kazanıldı":          { label: "Kazanıldı",          pill: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",  dot: "bg-emerald-500" },
  "Kaybedildi":         { label: "Kaybedildi",         pill: "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20",           dot: "bg-rose-500" },
};

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  Trafik:        <Car    className="w-3.5 h-3.5" />,
  Kasko:         <Shield className="w-3.5 h-3.5" />,
  İMM:           <Shield className="w-3.5 h-3.5" />,
  DASK:          <Home   className="w-3.5 h-3.5" />,
  Konut:         <Home   className="w-3.5 h-3.5" />,
  TSS:           <Heart  className="w-3.5 h-3.5" />,
  "Ferdi Kaza":  <Heart  className="w-3.5 h-3.5" />,
  "Özel Sağlık": <Heart  className="w-3.5 h-3.5" />,
  Seyahat:       <Globe  className="w-3.5 h-3.5" />,
};

const PRODUCT_COLORS: Record<string, { bg: string; text: string }> = {
  Trafik:        { bg: "bg-blue-100",    text: "text-blue-600" },
  Kasko:         { bg: "bg-indigo-100",  text: "text-indigo-600" },
  İMM:           { bg: "bg-purple-100",  text: "text-purple-600" },
  DASK:          { bg: "bg-orange-100",  text: "text-orange-600" },
  Konut:         { bg: "bg-amber-100",   text: "text-amber-600" },
  TSS:           { bg: "bg-pink-100",    text: "text-pink-600" },
  "Ferdi Kaza":  { bg: "bg-rose-100",    text: "text-rose-600" },
  "Özel Sağlık": { bg: "bg-red-100",     text: "text-red-600" },
  Seyahat:       { bg: "bg-cyan-100",    text: "text-cyan-600" },
};

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

const ALL_TABS = [
  { key: "Tümü",              label: "Tümü" },
  { key: "Yeni",              label: "Yeni" },
  { key: "Teklif Verildi",    label: "Verildi" },
  { key: "Müşteri Düşünüyor", label: "Düşünüyor" },
  { key: "Kazanıldı",         label: "Kazanıldı" },
  { key: "Kaybedildi",        label: "Kaybedildi" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "Az önce";
  if (mins < 60) return `${mins}dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}sa`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}g`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarGrad(name: string | null) {
  return AVATAR_GRADIENTS[(name?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length];
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
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
      <div className="col-span-1"><div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse" /></div>
      <div className="col-span-1" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function QuoteCenterPage() {
  const router = useRouter();
  const { agencyId } = useAuth();

  const [runs,    setRuns]    = useState<QuoteRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("Tümü");
  const [search,  setSearch]  = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = agencyId ? `?agency_id=${agencyId}` : "";
      const res    = await fetch(`/api/quote-runs${params}`);
      const data   = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shaped: QuoteRun[] = (data.runs ?? []).map((r: any) => {
        const results = r.quote_results ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prices  = results.map((x: any) => x.price).filter((p: any) => p != null);
        return { ...r, result_count: results.length, best_price: prices.length > 0 ? Math.min(...prices) : null };
      });
      setRuns(shaped);
    } catch { setRuns([]); }
    setLoading(false);
  }, [agencyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = runs.length;
  const active   = runs.filter(r => ["Yeni","Teklif Verildi","Müşteri Düşünüyor"].includes(r.status)).length;
  const won      = runs.filter(r => r.status === "Kazanıldı").length;
  const winRate  = total > 0 ? Math.round((won / total) * 100) : 0;
  const thisMonth = runs.filter(r => {
    const d = new Date(r.created_at); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = runs
    .filter(r => tab === "Tümü" || r.status === tab)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.customer_name ?? "").toLowerCase().includes(q) || r.product_type.toLowerCase().includes(q);
    });

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteRun(id: string) {
    if (!confirm("Bu teklif çalışması silinecek. Onaylıyor musunuz?")) return;
    setDeleting(id);
    await fetch(`/api/quote-runs/${id}`, { method: "DELETE" });
    await load();
    setDeleting(null);
  }

  // ── KPI data ─────────────────────────────────────────────────────────────
  const KPI_CARDS = [
    { label: "Toplam Çalışma", value: total,        Icon: FileText,    grad: "from-blue-50 to-blue-100/60",    ring: "ring-blue-200/60",    icon: "bg-blue-500",    val: "text-blue-700" },
    { label: "Aktif",          value: active,       Icon: Activity,    grad: "from-violet-50 to-violet-100/60",ring: "ring-violet-200/60",  icon: "bg-violet-500",  val: "text-violet-700" },
    { label: "Kazanıldı",      value: won,          Icon: CheckCircle2,grad: "from-emerald-50 to-emerald-100/60",ring:"ring-emerald-200/60",icon: "bg-emerald-500", val: "text-emerald-700" },
    { label: "Kazanma Oranı",  value: `%${winRate}`,Icon: Target,      grad: "from-amber-50 to-amber-100/60",  ring: "ring-amber-200/60",   icon: "bg-amber-500",   val: "text-amber-700" },
    { label: "Bu Ay",          value: thisMonth,    Icon: BarChart3,   grad: "from-cyan-50 to-cyan-100/60",    ring: "ring-cyan-200/60",    icon: "bg-cyan-500",    val: "text-cyan-700" },
  ];

  return (
    <div className="relative space-y-6">

      {/* ── Ambient background ── */}
      <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/30">
              <Zap className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Teklif Merkezi</h1>
          </div>
          <p className="text-sm text-slate-400 pl-[46px]">
            Teklif çalışmalarınızı yönetin, karşılaştırın ve müşteriye profesyonel şekilde iletin.
          </p>
        </div>

        <Link
          href="/quote-center/new"
          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
          Yeni Teklif Çalışması
        </Link>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {KPI_CARDS.map(c => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} ring-1 ${c.ring} p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`}
          >
            <div className={`w-8 h-8 rounded-xl ${c.icon} flex items-center justify-center mb-3 shadow-sm`}>
              <c.Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{c.label}</p>
            <p className={`text-[26px] font-bold mt-1 leading-none ${c.val}`}>
              {loading ? <span className="inline-block w-10 h-6 rounded bg-current opacity-20 animate-pulse" /> : c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri veya ürün ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm gap-0.5 overflow-x-auto">
          {ALL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                tab === t.key
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {t.key !== "Tümü" && (
                <span className={`ml-1.5 text-[10px] font-bold ${tab === t.key ? "text-white/70" : "text-slate-400"}`}>
                  {runs.filter(r => r.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">

        {loading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} delay={i * 80} />)}
          </div>

        ) : filtered.length === 0 ? (
          /* ── Empty state ── */
          <div className="py-20 text-center px-6">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="absolute inset-0 bg-blue-100 rounded-2xl animate-ping opacity-30" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center shadow-inner">
                <TrendingUp className="w-7 h-7 text-blue-400" />
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1.5">
              {search || tab !== "Tümü" ? "Sonuç bulunamadı" : "Henüz teklif çalışması yok"}
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto leading-relaxed">
              {search || tab !== "Tümü"
                ? "Arama kriterlerinizi veya filtreyi değiştirin"
                : "İlk teklif çalışmanızı oluşturun ve müşterilerinize profesyonel teklifler sunun"}
            </p>
            {!search && tab === "Tümü" && (
              <Link
                href="/quote-center/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all"
              >
                <Plus className="w-4 h-4" />
                Teklif Çalışması Başlat
              </Link>
            )}
          </div>

        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/70">
              <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Müşteri</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ürün</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teklifler</div>
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">En İyi Fiyat</div>
              <div className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Durum</div>
              <div className="col-span-1" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50/80">
              {filtered.map(run => {
                const sc   = STATUS_CFG[run.status] ?? STATUS_CFG["Yeni"];
                const ico  = PRODUCT_ICONS[run.product_type] ?? <FileText className="w-3.5 h-3.5" />;
                const pc   = PRODUCT_COLORS[run.product_type] ?? { bg: "bg-slate-100", text: "text-slate-600" };
                const grad = avatarGrad(run.customer_name);

                return (
                  <div
                    key={run.id}
                    onClick={() => router.push(`/quote-center/${run.id}`)}
                    className="grid grid-cols-12 gap-2 px-5 py-4 hover:bg-slate-50/80 transition-all duration-150 cursor-pointer group items-center"
                  >
                    {/* Customer */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-sm group-hover:shadow transition-shadow`}>
                        {initials(run.customer_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{run.customer_name ?? "—"}</p>
                        <p className="text-[11px] text-slate-400">{timeAgo(run.created_at)}</p>
                      </div>
                    </div>

                    {/* Product */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${pc.bg} ${pc.text} text-[11px] font-semibold`}>
                        {ico}
                        {run.product_type}
                      </span>
                    </div>

                    {/* Results */}
                    <div className="col-span-2">
                      {run.result_count === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold ring-1 ring-indigo-100">
                          {run.result_count} şirket
                        </span>
                      )}
                    </div>

                    {/* Best price */}
                    <div className="col-span-2">
                      <span className={`text-sm font-bold ${run.best_price ? "text-emerald-600" : "text-slate-300"}`}>
                        {fmt(run.best_price)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${sc.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} flex-shrink-0`} />
                        <span className="hidden sm:inline">{sc.label}</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {/* WA hızlı buton */}
                      {run.customer_phone && (
                        <a
                          href={`https://wa.me/${run.customer_phone.replace(/\D/g, "").replace(/^0/, "90")}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                          title="WhatsApp"
                        >
                          {WA_SMALL}
                        </a>
                      )}
                      {/* Özet linki */}
                      <Link
                        href={`/quote-center/${run.id}/summary`}
                        onClick={e => e.stopPropagation()}
                        className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                        title="Teklif Özeti"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={e => { e.stopPropagation(); deleteRun(run.id); }}
                        disabled={deleting === run.id}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {deleting === run.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-600">{filtered.length}</span> teklif çalışması
                {tab !== "Tümü" && <span> · <span className="text-blue-500">&ldquo;{tab}&rdquo;</span> filtresi</span>}
              </p>
              <button
                onClick={() => router.push("/quote-center/new")}
                className="text-[11px] text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Yeni Çalışma
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
