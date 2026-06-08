"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, CheckCircle2, XCircle, Clock, Plus,
  Trash2, MessageSquare, FileText, Copy,
  Sparkles, TrendingUp, Car, Home, Heart, Globe,
  Shield, RefreshCw, Check, ArrowUpRight, Zap,
  Phone, Mail, User, Award, AlertTriangle,
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

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<QuoteRunStatus, { label: string; pill: string; dot: string; bg: string }> = {
  "Yeni":               { label: "Yeni",               pill: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20",          dot: "bg-blue-500",    bg: "bg-blue-50" },
  "Teklif Verildi":     { label: "Teklif Verildi",     pill: "bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20",    dot: "bg-violet-500",  bg: "bg-violet-50" },
  "Müşteri Düşünüyor":  { label: "Müşteri Düşünüyor",  pill: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",       dot: "bg-amber-500",   bg: "bg-amber-50" },
  "Kazanıldı":          { label: "Kazanıldı",          pill: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20", dot: "bg-emerald-500", bg: "bg-emerald-50" },
  "Kaybedildi":         { label: "Kaybedildi",         pill: "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20",          dot: "bg-rose-500",    bg: "bg-rose-50" },
};

const PRODUCT_ICON: Record<string, React.ReactNode> = {
  Trafik:        <Car    className="w-4 h-4" />,
  Kasko:         <Shield className="w-4 h-4" />,
  İMM:           <Shield className="w-4 h-4" />,
  DASK:          <Home   className="w-4 h-4" />,
  Konut:         <Home   className="w-4 h-4" />,
  TSS:           <Heart  className="w-4 h-4" />,
  "Ferdi Kaza":  <Heart  className="w-4 h-4" />,
  "Özel Sağlık": <Heart  className="w-4 h-4" />,
  Seyahat:       <Globe  className="w-4 h-4" />,
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
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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
    await fetch("/api/quote-results", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_run_id: runId,
        company_name: company,
        price:        price ? parseFloat(price) : null,
        installment,
        note: note || null,
      }),
    });
    setCompany(""); setPrice(""); setNote("");
    setSaving(false);
    onAdded();
  }

  return (
    <div className="flex flex-wrap gap-2.5 items-end p-4 bg-slate-50/80 rounded-xl border border-slate-100">
      <div className="flex-1 min-w-[150px]">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Şirket *</label>
        <input type="text" placeholder="Neova Sigorta" value={company} onChange={e => setCompany(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white placeholder:text-slate-400"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fiyat (₺)</label>
        <input type="number" placeholder="17500" value={price} onChange={e => setPrice(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
        />
      </div>
      <div className="w-28">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Taksit</label>
        <select value={installment} onChange={e => setInstallment(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
        >
          {["Peşin","3 taksit","6 taksit","9 taksit","12 taksit"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-[100px]">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Not</label>
        <input type="text" placeholder="Ek bilgi…" value={note} onChange={e => setNote(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white placeholder:text-slate-400"
        />
      </div>
      <button onClick={handleAdd} disabled={!company || saving}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
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
  useRouter(); // layout navigation guard
  useAuth();

  const [run,         setRun]         = useState<QuoteRun | null>(null);
  const [results,     setResults]     = useState<QuoteResult[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res  = await fetch(`/api/quote-runs/${id}`);
      const data = await res.json();
      if (!res.ok) { setRun(null); setResults([]); }
      else { setRun(data.run ?? null); setResults(data.results ?? []); }
    } catch { setRun(null); setResults([]); }
    setLoading(false);
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function updateStatus(status: QuoteRunStatus, wonResultId?: string) {
    if (!run) return;
    setSavingStatus(true);
    await fetch(`/api/quote-runs/${run.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(wonResultId !== undefined ? { won_result_id: wonResultId } : {}) }),
    });
    await load();
    setSavingStatus(false);
  }

  async function deleteResult(resultId: string) {
    if (!confirm("Bu teklif silinecek. Onaylıyor musunuz?")) return;
    await fetch(`/api/quote-results/${resultId}`, { method: "DELETE" });
    load();
  }

  async function markWon(result: QuoteResult) {
    await fetch(`/api/quote-results/${result.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Seçildi" }),
    });
    await Promise.all(
      results.filter(r => r.id !== result.id).map(r =>
        fetch(`/api/quote-results/${r.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Aktif" }),
        })
      )
    );
    await updateStatus("Kazanıldı", result.id);
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function buildWhatsApp() {
    if (!run) return "";
    const topResults = results.filter(r => r.price && r.status !== "Teklif Yok").slice(0, 5);
    const lines = topResults.map((r, i) =>
      `${i === 0 ? "🏆" : `${i + 1}.`} ${r.company_name}: ${fmt(r.price)}${r.installment && r.installment !== "Peşin" ? ` (${r.installment})` : ""}`
    );
    return `Merhaba ${run.customer_name || "Sayın Müşterimiz"},\n\n${run.product_type} sigortanız için teklifleriniz hazır:\n\n${lines.join("\n")}\n\nEn uygun seçenek için sizi arayacağız.\n\nİyi günler dileriz.`;
  }

  // ── AI Analysis ───────────────────────────────────────────────────────────
  function buildAiAnalysis(): { icon: React.ReactNode; text: string; cls: string }[] {
    if (!run || results.length === 0) return [{ icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Henüz teklif girişi yapılmamış.", cls: "text-slate-400" }];
    const withPrice = results.filter(r => r.price != null);
    if (withPrice.length === 0) return [{ icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Fiyat girişi yapılmamış, analiz yapılamıyor.", cls: "text-slate-400" }];
    const sorted = [...withPrice].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    const best   = sorted[0];
    const worst  = sorted[sorted.length - 1];
    const avg    = Math.round(withPrice.reduce((s, r) => s + (r.price ?? 0), 0) / withPrice.length);
    const diff   = worst.price && best.price ? Math.round(((worst.price - best.price) / best.price) * 100) : 0;
    return [
      { icon: <Award className="w-3.5 h-3.5" />, text: `${best.company_name} en uygun teklifi sundu: ${fmt(best.price)}`, cls: "text-emerald-300" },
      withPrice.length > 1
        ? { icon: <TrendingUp className="w-3.5 h-3.5" />, text: `${worst.company_name} en pahalı — ${best.company_name}'den %${diff} daha yüksek`, cls: "text-amber-300" }
        : { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Tek teklif var, karşılaştırma yapılamıyor", cls: "text-slate-400" },
      { icon: <Zap className="w-3.5 h-3.5" />, text: `Ortalama piyasa fiyatı: ${fmt(avg)}`, cls: "text-blue-300" },
      withPrice.length >= 3
        ? { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: `${withPrice.length} şirket teklif verdi, rekabet yoğun`, cls: "text-violet-300" }
        : { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Daha fazla şirket teklifi alınması önerilir", cls: "text-amber-300" },
    ];
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-72 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-5">
          <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="col-span-2 h-64 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-rose-300" />
        </div>
        <h2 className="text-base font-bold text-slate-700 mb-1">Teklif çalışması bulunamadı</h2>
        <p className="text-sm text-slate-400 mb-5">Bu çalışma silinmiş veya erişim yetkiniz olmayabilir.</p>
        <Link href="/quote-center"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Teklif Merkezi
        </Link>
      </div>
    );
  }

  const sc          = STATUS_CFG[run.status] ?? STATUS_CFG["Yeni"];
  const productIcon = PRODUCT_ICON[run.product_type] ?? <FileText className="w-4 h-4" />;
  const withPrice   = results.filter(r => r.price != null);
  const bestPrice   = withPrice.length > 0 ? Math.min(...withPrice.map(r => r.price ?? Infinity)) : null;
  const whatsappMsg = buildWhatsApp();
  const aiBullets   = buildAiAnalysis();
  const productData = (run.product_data ?? {}) as Record<string, string>;
  const wonResult   = results.find(r => r.id === run.won_result_id);

  return (
    <div className="relative space-y-5">

      {/* Ambient background */}
      <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/10 pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/quote-center"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{run.customer_name ?? "—"}</h1>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${sc.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-indigo-500">{productIcon}</span>
              <span>{run.product_type} Sigortası</span>
              <span className="text-slate-300">·</span>
              <span>{timeAgo(run.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {run.status !== "Kazanıldı" && run.status !== "Kaybedildi" && (
            <>
              <button onClick={() => updateStatus("Teklif Verildi")} disabled={savingStatus || run.status === "Teklif Verildi"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" /> Teklif Verildi
              </button>
              <button onClick={() => updateStatus("Müşteri Düşünüyor")} disabled={savingStatus || run.status === "Müşteri Düşünüyor"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" /> Düşünüyor
              </button>
              <button onClick={() => updateStatus("Kaybedildi")} disabled={savingStatus}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Kaybedildi
              </button>
            </>
          )}
          {(run.status === "Kazanıldı" || run.status === "Kaybedildi") && (
            <button onClick={() => updateStatus("Yeni")} disabled={savingStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sıfırla
            </button>
          )}
          {savingStatus && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Info ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Müşteri Bilgileri</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm flex-shrink-0">
                  {initials(run.customer_name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{run.customer_name ?? "—"}</p>
                  {run.customer_tc && <p className="text-[11px] text-slate-400 font-mono">{run.customer_tc}</p>}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Contact rows */}
              <div className="space-y-2">
                {run.customer_phone && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {run.customer_phone}
                  </div>
                )}
                {run.customer_email && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {run.customer_email}
                  </div>
                )}
                {run.customer_id && (
                  <Link href="/customers"
                    className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold hover:text-blue-700 mt-1"
                  >
                    <User className="w-3 h-3" />
                    CRM&apos;de Görüntüle
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Product data */}
          {Object.keys(productData).filter(k => k !== "group" && productData[k]).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {run.product_type} Bilgileri
                </p>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(productData)
                  .filter(([k, v]) => k !== "group" && v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-[11px] text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="text-[11px] font-semibold text-slate-700 text-right font-mono">{v}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {run.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">Notlar</p>
              <p className="text-sm text-amber-900 leading-relaxed">{run.notes}</p>
            </div>
          )}

          {/* Won banner */}
          {run.status === "Kazanıldı" && (
            <div className="rounded-2xl overflow-hidden border border-emerald-200 shadow-sm">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-white" />
                <p className="text-sm font-bold text-white">Teklif Kazanıldı!</p>
              </div>
              <div className="bg-emerald-50 p-4 space-y-3">
                {wonResult && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-emerald-800">{wonResult.company_name}</p>
                    <p className="text-lg font-bold text-emerald-700">{fmt(wonResult.price)}</p>
                    {wonResult.installment && wonResult.installment !== "Peşin" && (
                      <p className="text-[11px] text-emerald-600">{wonResult.installment}</p>
                    )}
                  </div>
                )}
                <Link
                  href={`/policies?prefill=${run.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors w-full justify-center shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  Poliçeye Dönüştür
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results + AI + WhatsApp ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Quote results card */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">Şirket Teklifleri</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {withPrice.length} fiyatlı · {results.filter(r => r.status === "Teklif Yok").length} teklif yok
                </p>
              </div>
              <button
                onClick={() => setShowAdd(s => !s)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  showAdd
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20"
                }`}
              >
                {showAdd ? <XCircle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showAdd ? "Kapat" : "Teklif Ekle"}
              </button>
            </div>

            {/* Add form */}
            {showAdd && (
              <div className="px-5 py-3 border-b border-slate-100">
                <AddResultForm runId={run.id} onAdded={() => { setShowAdd(false); load(); }} />
              </div>
            )}

            {/* Empty */}
            {results.length === 0 ? (
              <div className="py-12 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-600 mb-1">Henüz teklif girilmemiş</p>
                <button onClick={() => setShowAdd(true)} className="text-xs text-blue-600 font-semibold hover:text-blue-700 mt-1">
                  İlk teklifi ekle →
                </button>
              </div>

            ) : (
              <div>
                {/* Col headers */}
                <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50/80 border-b border-slate-50">
                  <div className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">#</div>
                  <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Şirket</div>
                  <div className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fiyat</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taksit</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">İşlem</div>
                </div>

                <div className="divide-y divide-slate-50">
                  {results.map((r, idx) => {
                    const myPrice   = r.price ?? 0;
                    const isBest    = r.price != null && r.price === bestPrice;
                    const isMid     = !isBest && myPrice > 0 && bestPrice != null && myPrice <= bestPrice * 1.15;
                    const isExpensive = !isBest && !isMid && myPrice > 0;
                    const isWon     = r.id === run.won_result_id;

                    const priceBadge = isBest     ? "bg-emerald-500 text-white"
                                     : isMid      ? "bg-amber-400 text-white"
                                     : isExpensive ? "bg-rose-400 text-white"
                                     : "bg-slate-100 text-slate-600";

                    return (
                      <div
                        key={r.id}
                        className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center transition-all ${
                          isWon ? "bg-emerald-50/60" : isBest ? "bg-emerald-50/30" : "hover:bg-slate-50/60"
                        }`}
                      >
                        {/* Rank */}
                        <div className="col-span-1">
                          {r.price != null ? (
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isBest ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {idx + 1}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </div>

                        {/* Company */}
                        <div className="col-span-4 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isBest ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {r.company_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{r.company_name}</p>
                            {r.note && <p className="text-[10px] text-slate-400 truncate">{r.note}</p>}
                            {isWon && (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Seçildi
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="col-span-3">
                          {r.status === "Teklif Yok" ? (
                            <span className="text-[11px] text-slate-400 italic">Teklif yok</span>
                          ) : (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${priceBadge}`}>
                              {fmt(r.price)}
                            </span>
                          )}
                        </div>

                        {/* Installment */}
                        <div className="col-span-2">
                          <span className="text-[11px] text-slate-500">{r.installment ?? "—"}</span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                          {r.price != null && run.status !== "Kazanıldı" && (
                            <button onClick={() => markWon(r)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Seç
                            </button>
                          )}
                          <button onClick={() => deleteResult(r.id)}
                            className="w-6 h-6 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
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
                  <div className="px-5 py-3 border-t border-slate-100 bg-emerald-50/50 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      En iyi teklif
                    </span>
                    <span className="text-sm font-bold text-emerald-700">{fmt(bestPrice)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI Analysis ── */}
          <div className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1a3d 100%)" }}
          >
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            />
            {/* Glow orb */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-blue-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-3">AI Teklif Analizi</p>
                <ul className="space-y-2">
                  {aiBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`flex-shrink-0 mt-0.5 ${b.cls}`}>{b.icon}</span>
                      <span className={`text-xs leading-relaxed ${b.cls}`}>{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── WhatsApp ── */}
          {withPrice.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">WhatsApp Mesajı</h2>
                    <p className="text-[11px] text-slate-400">Müşteriye hazır teklif mesajı</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(whatsappMsg);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopyalandı!</>
                      : <><Copy className="w-3.5 h-3.5" /> Kopyala</>}
                  </button>
                  {run.customer_phone && (
                    <a
                      href={`https://wa.me/${run.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-500/20"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp&apos;ta Aç
                    </a>
                  )}
                </div>
              </div>
              <div className="p-5">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">
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
