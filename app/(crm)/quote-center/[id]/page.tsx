"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, CheckCircle2, XCircle, Clock, Plus,
  Trash2, Edit3, MessageSquare, FileText, Copy,
  Sparkles, TrendingUp, Car, Home, Heart, Globe,
  Shield, RefreshCw, Check, ArrowUpRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type QuoteRunStatus = "Yeni" | "Teklif Verildi" | "Müşteri Düşünüyor" | "Kazanıldı" | "Kaybedildi";

type QuoteRun = {
  id: string;
  agency_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_tc: string | null;
  product_type: string;
  product_data: Record<string, string>;
  status: QuoteRunStatus;
  notes: string | null;
  won_result_id: string | null;
  created_at: string;
  updated_at: string;
};

type QuoteResult = {
  id: string;
  quote_run_id: string;
  company_name: string;
  price: number | null;
  installment: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_CFG: Record<QuoteRunStatus, { label: string; cls: string; dot: string }> = {
  "Yeni":               { label: "Yeni",               cls: "bg-blue-50 text-blue-700 border border-blue-100",       dot: "bg-blue-500" },
  "Teklif Verildi":     { label: "Teklif Verildi",     cls: "bg-indigo-50 text-indigo-700 border border-indigo-100",  dot: "bg-indigo-500" },
  "Müşteri Düşünüyor":  { label: "Müşteri Düşünüyor",  cls: "bg-amber-50 text-amber-700 border border-amber-100",     dot: "bg-amber-500" },
  "Kazanıldı":          { label: "Kazanıldı",          cls: "bg-emerald-50 text-emerald-700 border border-emerald-100", dot: "bg-emerald-500" },
  "Kaybedildi":         { label: "Kaybedildi",         cls: "bg-red-50 text-red-700 border border-red-100",           dot: "bg-red-400" },
};

const PRODUCT_ICON: Record<string, React.ReactNode> = {
  Trafik: <Car className="w-4 h-4" />, Kasko: <Shield className="w-4 h-4" />,
  İMM: <Shield className="w-4 h-4" />, DASK: <Home className="w-4 h-4" />,
  Konut: <Home className="w-4 h-4" />, TSS: <Heart className="w-4 h-4" />,
  "Ferdi Kaza": <Heart className="w-4 h-4" />, "Özel Sağlık": <Heart className="w-4 h-4" />,
  Seyahat: <Globe className="w-4 h-4" />,
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}
function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

// ─── Add result form ─────────────────────────────────────────────────────────
function AddResultForm({ runId, onAdded }: { runId: string; onAdded: () => void }) {
  const [company,     setCompany]     = useState("");
  const [price,       setPrice]       = useState("");
  const [installment, setInstallment] = useState("Peşin");
  const [note,        setNote]        = useState("");
  const [saving,      setSaving]      = useState(false);

  async function handleAdd() {
    if (!company) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quote_results") as any).insert({
      quote_run_id: runId,
      company_name: company,
      price:        price ? parseFloat(price) : null,
      installment,
      note: note || null,
      status: "Aktif",
    });
    setCompany(""); setPrice(""); setNote("");
    setSaving(false);
    onAdded();
  }

  return (
    <div className="flex flex-wrap gap-2 items-end p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex-1 min-w-[140px]">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Şirket *</label>
        <input type="text" placeholder="Neova Sigorta" value={company} onChange={e => setCompany(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fiyat (₺)</label>
        <input type="number" placeholder="17500" value={price} onChange={e => setPrice(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Taksit</label>
        <select value={installment} onChange={e => setInstallment(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {["Peşin","3 taksit","6 taksit","9 taksit","12 taksit"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-[100px]">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Not</label>
        <input type="text" placeholder="Ek bilgi…" value={note} onChange={e => setNote(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button onClick={handleAdd} disabled={!company || saving}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Ekle
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function QuoteRunDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const { agencyId } = useAuth();

  const [run,      setRun]      = useState<QuoteRun | null>(null);
  const [results,  setResults]  = useState<QuoteResult[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: runData }, { data: resultsData }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("quote_runs") as any).select("*").eq("id", id).maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("quote_results") as any).select("*").eq("quote_run_id", id).order("price", { ascending: true }),
    ]);
    setRun(runData ?? null);
    setResults(resultsData ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function updateStatus(status: QuoteRunStatus, wonResultId?: string) {
    if (!run) return;
    setSavingStatus(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quote_runs") as any)
      .update({ status, ...(wonResultId ? { won_result_id: wonResultId } : {}) })
      .eq("id", run.id);
    await load();
    setSavingStatus(false);
  }

  // ── Delete result ─────────────────────────────────────────────────────────
  async function deleteResult(resultId: string) {
    if (!confirm("Bu teklif silinecek. Onaylıyor musunuz?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quote_results") as any).delete().eq("id", resultId);
    load();
  }

  // ── Mark as won ───────────────────────────────────────────────────────────
  async function markWon(result: QuoteResult) {
    // Mark this result as selected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("quote_results") as any)
      .update({ status: "Seçildi" }).eq("id", result.id);
    // Reset others
    const others = results.filter(r => r.id !== result.id).map(r => r.id);
    if (others.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("quote_results") as any)
        .update({ status: "Aktif" }).in("id", others);
    }
    await updateStatus("Kazanıldı", result.id);
  }

  // ── WhatsApp message ──────────────────────────────────────────────────────
  function buildWhatsApp() {
    if (!run) return "";
    const topResults = results
      .filter(r => r.price && r.status !== "Teklif Yok")
      .slice(0, 5);
    const lines = topResults.map((r, i) =>
      `${i === 0 ? "🏆" : `${i + 1}.`} ${r.company_name}: ${fmt(r.price)}${r.installment && r.installment !== "Peşin" ? ` (${r.installment})` : ""}`
    );
    return `Merhaba ${run.customer_name || "Sayın Müşterimiz"},\n\n${run.product_type} sigortanız için teklifleriniz hazır:\n\n${lines.join("\n")}\n\nEn uygun seçenek için sizi arayacağız.\n\nİyi günler dileriz.`;
  }

  // ── AI analysis ───────────────────────────────────────────────────────────
  function buildAiAnalysis(): string[] {
    if (!run || results.length === 0) return ["Henüz teklif girişi yapılmamış."];
    const withPrice = results.filter(r => r.price != null);
    if (withPrice.length === 0) return ["Fiyat girişi yapılmamış, analiz yapılamıyor."];
    const sorted  = [...withPrice].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    const best    = sorted[0];
    const worst   = sorted[sorted.length - 1];
    const avg     = Math.round(withPrice.reduce((s, r) => s + (r.price ?? 0), 0) / withPrice.length);
    const diff    = worst.price && best.price ? Math.round(((worst.price - best.price) / best.price) * 100) : 0;
    return [
      `${best.company_name} en uygun teklifi sundu: ${fmt(best.price)}`,
      withPrice.length > 1 ? `${worst.company_name} en pahalı teklif — ${best.company_name}'den %${diff} daha yüksek` : "Tek teklif var, karşılaştırma yapılamıyor",
      `Ortalama piyasa fiyatı: ${fmt(avg)}`,
      withPrice.length >= 3 ? `${withPrice.length} şirket teklif verdi, rekabet yoğun` : `Daha fazla şirket teklifi alınması önerilir`,
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Teklif çalışması bulunamadı.</p>
        <Link href="/quote-center" className="text-blue-600 text-sm font-semibold mt-2 inline-block">← Teklif Merkezi</Link>
      </div>
    );
  }

  const sc           = STATUS_CFG[run.status] ?? STATUS_CFG["Yeni"];
  const productIcon  = PRODUCT_ICON[run.product_type] ?? <FileText className="w-4 h-4" />;
  const withPrice    = results.filter(r => r.price != null);
  const bestPrice    = withPrice.length > 0 ? Math.min(...withPrice.map(r => r.price ?? Infinity)) : null;
  const minPrice     = bestPrice;
  const whatsappMsg  = buildWhatsApp();
  const aiBullets    = buildAiAnalysis();
  const productData  = (run.product_data ?? {}) as Record<string, string>;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/quote-center" className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{run.customer_name ?? "—"}</h1>
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="text-indigo-500">{productIcon}</span>
              <span>{run.product_type} Sigortası</span>
              <span>·</span>
              <span>{timeAgo(run.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick status buttons */}
          {run.status !== "Kazanıldı" && run.status !== "Kaybedildi" && (
            <>
              <button
                onClick={() => updateStatus("Teklif Verildi")}
                disabled={savingStatus || run.status === "Teklif Verildi"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                Teklif Verildi
              </button>
              <button
                onClick={() => updateStatus("Müşteri Düşünüyor")}
                disabled={savingStatus || run.status === "Müşteri Düşünüyor"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                Düşünüyor
              </button>
              <button
                onClick={() => updateStatus("Kaybedildi")}
                disabled={savingStatus}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Kaybedildi
              </button>
            </>
          )}
          {(run.status === "Kazanıldı" || run.status === "Kaybedildi") && (
            <button
              onClick={() => updateStatus("Yeni")}
              disabled={savingStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Info panels ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Customer info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Müşteri Bilgileri</p>
            <div className="space-y-2.5">
              {[
                { label: "Ad Soyad",  val: run.customer_name  },
                { label: "Telefon",   val: run.customer_phone },
                { label: "E-posta",   val: run.customer_email },
                { label: "TC/VKN",    val: run.customer_tc    },
              ].map(row => row.val ? (
                <div key={row.label} className="flex justify-between gap-3">
                  <span className="text-xs text-gray-400">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-700 text-right">{row.val}</span>
                </div>
              ) : null)}
              {run.customer_id && (
                <Link href="/customers" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 mt-1">
                  CRM'de Görüntüle <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Product data */}
          {Object.keys(productData).filter(k => k !== "group" && productData[k]).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {run.product_type} Bilgileri
              </p>
              <div className="space-y-2">
                {Object.entries(productData)
                  .filter(([k, v]) => k !== "group" && v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-xs text-gray-400 capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="text-xs font-semibold text-slate-700 text-right font-mono">{v}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {run.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Notlar</p>
              <p className="text-sm text-amber-900">{run.notes}</p>
            </div>
          )}

          {/* Convert to Policy (if won) */}
          {run.status === "Kazanıldı" && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">Teklif Kazanıldı!</p>
              </div>
              <p className="text-xs text-emerald-700">
                {results.find(r => r.id === run.won_result_id)?.company_name ?? "—"} ·{" "}
                {fmt(results.find(r => r.id === run.won_result_id)?.price ?? null)}
              </p>
              <Link
                href={`/policies?prefill=${run.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors w-full justify-center"
              >
                <FileText className="w-4 h-4" />
                Poliçeye Dönüştür
              </Link>
            </div>
          )}
        </div>

        {/* ── RIGHT: Quote results + AI + WhatsApp ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Quote results card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Şirket Teklifleri</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {withPrice.length} fiyatlı · {results.filter(r => r.status === "Teklif Yok").length} teklif yok
                </p>
              </div>
              <button onClick={() => setShowAdd(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Teklif Ekle
              </button>
            </div>

            {/* Add form */}
            {showAdd && (
              <div className="px-5 py-3 border-b border-gray-50">
                <AddResultForm runId={run.id} onAdded={() => { setShowAdd(false); load(); }} />
              </div>
            )}

            {/* Results table */}
            {results.length === 0 ? (
              <div className="py-10 text-center">
                <TrendingUp className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Henüz teklif girilmemiş</p>
                <button onClick={() => setShowAdd(true)} className="text-xs text-blue-600 font-semibold mt-1 hover:underline">
                  İlk teklifi ekle →
                </button>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-gray-50/70 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <div className="col-span-1"></div>
                  <div className="col-span-4">Şirket</div>
                  <div className="col-span-3">Fiyat</div>
                  <div className="col-span-2">Taksit</div>
                  <div className="col-span-2 text-right">İşlem</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {results.map((r, idx) => {
                    const myPrice  = r.price ?? 0;
                    const isBest   = r.price != null && r.price === minPrice;
                    const isMid    = !isBest && myPrice > 0 && minPrice != null && myPrice <= minPrice * 1.15;
                    const isExpensive = !isBest && !isMid && myPrice > 0;
                    const isWon    = r.id === run.won_result_id;

                    const badgeCls = isBest   ? "bg-emerald-500 text-white"
                                   : isMid    ? "bg-amber-400 text-white"
                                   : isExpensive ? "bg-red-400 text-white"
                                   : "bg-gray-100 text-gray-600";

                    return (
                      <div key={r.id} className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors ${isWon ? "bg-emerald-50/50" : "hover:bg-gray-50/40"}`}>
                        {/* Rank */}
                        <div className="col-span-1 text-[10px] font-bold text-gray-300">
                          {r.price != null ? (
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              isBest ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {idx + 1}
                            </span>
                          ) : "—"}
                        </div>

                        {/* Company */}
                        <div className="col-span-4 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 flex-shrink-0">
                            {r.company_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{r.company_name}</p>
                            {r.note && <p className="text-[10px] text-gray-400 truncate">{r.note}</p>}
                          </div>
                          {isWon && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                        </div>

                        {/* Price */}
                        <div className="col-span-3">
                          {r.status === "Teklif Yok" ? (
                            <span className="text-[11px] text-gray-400 italic">Teklif yok</span>
                          ) : (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${badgeCls}`}>
                              {fmt(r.price)}
                            </span>
                          )}
                        </div>

                        {/* Installment */}
                        <div className="col-span-2">
                          <span className="text-[11px] text-gray-500">{r.installment ?? "—"}</span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          {r.price != null && run.status !== "Kazanıldı" && (
                            <button onClick={() => markWon(r)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                              title="Kazanıldı olarak işaretle"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Seç
                            </button>
                          )}
                          <button onClick={() => deleteResult(r.id)}
                            className="w-6 h-6 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Best price footer */}
                {bestPrice != null && (
                  <div className="px-5 py-3 border-t border-gray-50 bg-emerald-50/40 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold">En iyi teklif</span>
                    <span className="text-sm font-bold text-emerald-700">{fmt(bestPrice)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI analysis */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-5">
            <div className="absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />
            <div className="relative flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-2">AI Teklif Analizi</p>
                <ul className="space-y-1.5">
                  {aiBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-blue-200 leading-relaxed">
                      <span className="text-blue-500 flex-shrink-0 mt-px">▸</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* WhatsApp message */}
          {withPrice.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-800">WhatsApp Mesajı</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(whatsappMsg);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Kopyalandı!" : "Kopyala"}
                  </button>
                  {run.customer_phone && (
                    <a
                      href={`https://wa.me/${run.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp Gönder
                    </a>
                  )}
                </div>
              </div>
              <div className="p-5">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
                  {whatsappMsg}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
