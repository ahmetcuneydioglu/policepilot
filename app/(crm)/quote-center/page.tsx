"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, TrendingUp, CheckCircle2, XCircle, Clock,
  ChevronRight, Search, Filter, ArrowUpRight,
  FileText, Car, Home, Heart, Shield, Globe,
  RefreshCw, Trash2,
} from "lucide-react";

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

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<QuoteRunStatus, { label: string; cls: string; dot: string }> = {
  "Yeni":               { label: "Yeni",               cls: "bg-blue-50 text-blue-700 border border-blue-100",      dot: "bg-blue-500" },
  "Teklif Verildi":     { label: "Teklif Verildi",     cls: "bg-indigo-50 text-indigo-700 border border-indigo-100", dot: "bg-indigo-500" },
  "Müşteri Düşünüyor":  { label: "Müşteri Düşünüyor",  cls: "bg-amber-50 text-amber-700 border border-amber-100",    dot: "bg-amber-500" },
  "Kazanıldı":          { label: "Kazanıldı",          cls: "bg-emerald-50 text-emerald-700 border border-emerald-100", dot: "bg-emerald-500" },
  "Kaybedildi":         { label: "Kaybedildi",         cls: "bg-red-50 text-red-700 border border-red-100",          dot: "bg-red-400" },
};

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  Trafik:       <Car    className="w-4 h-4" />,
  Kasko:        <Shield className="w-4 h-4" />,
  İMM:          <Shield className="w-4 h-4" />,
  DASK:         <Home   className="w-4 h-4" />,
  Konut:        <Home   className="w-4 h-4" />,
  TSS:          <Heart  className="w-4 h-4" />,
  "Ferdi Kaza": <Heart  className="w-4 h-4" />,
  "Özel Sağlık":<Heart  className="w-4 h-4" />,
  Seyahat:      <Globe  className="w-4 h-4" />,
};

const ALL_TABS: Array<{ key: string; label: string }> = [
  { key: "Tümü",              label: "Tümü" },
  { key: "Yeni",              label: "Yeni" },
  { key: "Teklif Verildi",    label: "Teklif Verildi" },
  { key: "Müşteri Düşünüyor", label: "Müşteri Düşünüyor" },
  { key: "Kazanıldı",         label: "Kazanıldı" },
  { key: "Kaybedildi",        label: "Kaybedildi" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "Az önce";
  if (mins < 60) return `${mins} dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} sa`;
  return `${Math.floor(hrs / 24)} gün`;
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuoteCenterPage() {
  const router = useRouter();
  const { role, agencyId } = useAuth();

  const [runs, setRuns]         = useState<QuoteRun[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("Tümü");
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("quote_runs") as any)
      .select(`
        id, agency_id, customer_name, customer_phone, product_type,
        status, notes, created_at, updated_at,
        quote_results(id, price)
      `)
      .order("created_at", { ascending: false });

    if (role === "agency_user" && agencyId) q = q.eq("agency_id", agencyId);

    const { data } = await q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shaped: QuoteRun[] = (data ?? []).map((r: any) => {
      const results = r.quote_results ?? [];
      const prices  = results.map((x: any) => x.price).filter((p: any) => p != null);
      return {
        ...r,
        result_count: results.length,
        best_price:   prices.length > 0 ? Math.min(...prices) : null,
      };
    });
    setRuns(shaped);
    setLoading(false);
  }, [role, agencyId]);

  useEffect(() => { load(); }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = runs.length;
  const active   = runs.filter(r => ["Yeni","Teklif Verildi","Müşteri Düşünüyor"].includes(r.status)).length;
  const won      = runs.filter(r => r.status === "Kazanıldı").length;
  const winRate  = total > 0 ? Math.round((won / total) * 100) : 0;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = runs
    .filter(r => tab === "Tümü" || r.status === tab)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        r.product_type.toLowerCase().includes(q)
      );
    });

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteRun(id: string) {
    if (!confirm("Bu teklif çalışması silinecek. Onaylıyor musunuz?")) return;
    setDeleting(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quote_runs") as any).delete().eq("id", id);
    await load();
    setDeleting(null);
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teklif Merkezi</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tüm teklif çalışmalarınızı yönetin</p>
        </div>
        <Link
          href="/quote-center/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
        >
          <Plus className="w-4 h-4" />
          Yeni Teklif Çalışması
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Toplam Çalışma", value: total,   Icon: FileText,    grad: "from-blue-500 to-blue-600",       bg: "bg-blue-50",    text: "text-blue-600" },
          { label: "Aktif",          value: active,  Icon: Clock,        grad: "from-indigo-500 to-indigo-600",   bg: "bg-indigo-50",  text: "text-indigo-600" },
          { label: "Kazanıldı",      value: won,     Icon: CheckCircle2, grad: "from-emerald-500 to-teal-600",    bg: "bg-emerald-50", text: "text-emerald-600" },
          { label: "Kazanma Oranı",  value: `${winRate}%`, Icon: TrendingUp, grad: "from-violet-500 to-purple-600", bg: "bg-violet-50", text: "text-violet-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-xl ${c.bg} ${c.text} flex items-center justify-center`}>
                <c.Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{c.label}</p>
            <p className={`text-2xl font-bold mt-0.5 bg-gradient-to-r ${c.grad} bg-clip-text text-transparent`}>
              {loading ? "—" : c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Müşteri veya ürün ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Tab filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {ALL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tab === t.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.key !== "Tümü" && (
                <span className="ml-1.5 text-[10px] text-gray-400">
                  {runs.filter(r => r.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-slate-600 font-semibold mb-1">
              {search || tab !== "Tümü" ? "Sonuç bulunamadı" : "Henüz teklif çalışması yok"}
            </p>
            <p className="text-sm text-gray-400 mb-5">
              {search || tab !== "Tümü"
                ? "Filtrelerinizi değiştirmeyi deneyin"
                : "İlk teklif çalışmanızı oluşturun"}
            </p>
            {!search && tab === "Tümü" && (
              <Link
                href="/quote-center/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Yeni Teklif Çalışması
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Müşteri</div>
              <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ürün</div>
              <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teklifler</div>
              <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">En İyi Fiyat</div>
              <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Durum</div>
              <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">İşlem</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {filtered.map(run => {
                const sc  = STATUS_CFG[run.status] ?? STATUS_CFG["Yeni"];
                const ico = PRODUCT_ICONS[run.product_type] ?? <FileText className="w-4 h-4" />;
                return (
                  <div
                    key={run.id}
                    className="grid grid-cols-12 gap-2 px-5 py-3.5 hover:bg-gray-50/60 transition-colors cursor-pointer group items-center"
                    onClick={() => router.push(`/quote-center/${run.id}`)}
                  >
                    {/* Müşteri */}
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {(run.customer_name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{run.customer_name ?? "—"}</p>
                        <p className="text-[10px] text-gray-400">{timeAgo(run.created_at)} önce</p>
                      </div>
                    </div>

                    {/* Ürün */}
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-indigo-500">{ico}</span>
                      <span className="text-sm text-slate-700 font-medium">{run.product_type}</span>
                    </div>

                    {/* Teklifler */}
                    <div className="col-span-2">
                      {run.result_count === 0 ? (
                        <span className="text-xs text-gray-400 italic">Teklif yok</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                          {run.result_count} şirket
                        </span>
                      )}
                    </div>

                    {/* En iyi fiyat */}
                    <div className="col-span-2">
                      <span className={`text-sm font-bold ${run.best_price ? "text-emerald-600" : "text-gray-400"}`}>
                        {fmt(run.best_price)}
                      </span>
                    </div>

                    {/* Durum */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} flex-shrink-0`} />
                        {sc.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); deleteRun(run.id); }}
                        disabled={deleting === run.id}
                        className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30">
              <p className="text-xs text-gray-400">
                {filtered.length} teklif çalışması gösteriliyor
                {tab !== "Tümü" && ` · "${tab}" filtresi aktif`}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
