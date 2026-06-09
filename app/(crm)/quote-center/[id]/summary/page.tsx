"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Printer, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QuoteWhatsAppModal, { type WaQuoteResult, type WaQuoteRun } from "@/components/QuoteWhatsAppModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type QuoteResult = {
  id: string;
  company_name: string;
  price: number | null;
  installment: string | null;
  note: string | null;
  status: string;
};

type QuoteRun = {
  id: string;
  agency_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_tc: string | null;
  product_type: string;
  product_data: Record<string, string>;
  status: string;
  provider_type: string | null;
  created_at: string;
};

type Agency = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function isSuccessStatus(status: string) {
  return ["success", "Aktif", "Seçildi"].includes(status);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 p-6">
      <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QuoteSummaryPage() {
  const { id } = useParams<{ id: string }>();

  const [run,      setRun]      = useState<QuoteRun | null>(null);
  const [results,  setResults]  = useState<QuoteResult[]>([]);
  const [agency,   setAgency]   = useState<Agency | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [waOpen,   setWaOpen]   = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res  = await fetch(`/api/quote-runs/${id}`);
        const data = await res.json();
        if (!res.ok) { setError("Teklif çalışması bulunamadı."); setLoading(false); return; }
        setRun(data.run ?? null);
        setResults(data.results ?? []);

        // Fetch agency
        if (data.run?.agency_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ag } = await (supabase.from("agencies") as any)
            .select("name,email,phone,address")
            .eq("id", data.run.agency_id)
            .single();
          if (ag) setAgency(ag);
        }
      } catch {
        setError("Bir hata oluştu.");
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Skeleton />;

  if (error || !run) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500 mb-4">{error ?? "Bulunamadı."}</p>
        <Link href="/quote-center" className="text-blue-600 text-sm font-semibold hover:underline">
          ← Teklif Merkezi
        </Link>
      </div>
    );
  }

  // Sort results: successes by price, errors/no-offer at end
  const successRows = results
    .filter(r => isSuccessStatus(r.status) && r.price != null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const otherRows = results.filter(r => !(isSuccessStatus(r.status) && r.price != null));
  const sortedResults = [...successRows, ...otherRows];

  const bestPrice = successRows.length > 0 ? successRows[0].price : null;
  const productData = (run.product_data ?? {}) as Record<string, string>;
  const agencyName = agency?.name ?? "Acenteniz";

  const sourceBadge =
    run.provider_type === "api"    ? { label: "API", cls: "bg-violet-100 text-violet-700" } :
    run.provider_type === "manual" ? { label: "Manuel", cls: "bg-slate-100 text-slate-600" } :
    run.provider_type === "demo"   ? { label: "Demo", cls: "bg-amber-100 text-amber-700" } :
    null;

  const statusBadge = {
    "Yeni":              "bg-blue-100 text-blue-700",
    "Teklif Verildi":    "bg-amber-100 text-amber-700",
    "Müşteri Düşünüyor": "bg-orange-100 text-orange-700",
    "Kazanıldı":         "bg-emerald-100 text-emerald-700",
    "Kaybedildi":        "bg-rose-100 text-rose-700",
  }[run.status] ?? "bg-slate-100 text-slate-600";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">

        {/* ── Action bar (no-print) ── */}
        <div className="no-print flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Link
            href={`/quote-center/${run.id}`}
            className="flex items-center gap-1.5 text-sm text-slate-600 font-semibold hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Teklif Detayı
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWaOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Yazdır / PDF
            </button>
          </div>
        </div>

        {/* ── Printable document ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">

          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">PoliçePilot</h1>
              <p className="text-sm text-slate-400 mt-0.5">Teklif Özeti</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-700">{agencyName}</p>
              {agency?.phone && <p className="text-xs text-slate-400 mt-0.5">{agency.phone}</p>}
              {agency?.email && <p className="text-xs text-slate-400">{agency.email}</p>}
              <p className="text-xs text-slate-400 mt-1">{formatDate(run.created_at)}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="px-8 py-3 border-b border-slate-50 flex items-center gap-2 flex-wrap">
            {sourceBadge && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${sourceBadge.cls}`}>
                {sourceBadge.label}
              </span>
            )}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusBadge}`}>
              {run.status}
            </span>
          </div>

          {/* Two-column info */}
          <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
            {/* Left: Sigortalı */}
            <div className="px-8 py-5 border-r border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sigortalı</p>
              <div className="space-y-2">
                {run.customer_name && (
                  <div>
                    <p className="text-[10px] text-slate-400">Ad Soyad</p>
                    <p className="text-sm font-semibold text-slate-800">{run.customer_name}</p>
                  </div>
                )}
                {run.customer_tc && (
                  <div>
                    <p className="text-[10px] text-slate-400">TC Kimlik</p>
                    <p className="text-sm font-mono text-slate-700">{run.customer_tc}</p>
                  </div>
                )}
                {run.customer_phone && (
                  <div>
                    <p className="text-[10px] text-slate-400">Telefon</p>
                    <p className="text-sm text-slate-700">{run.customer_phone}</p>
                  </div>
                )}
                {run.customer_email && (
                  <div>
                    <p className="text-[10px] text-slate-400">E-posta</p>
                    <p className="text-sm text-slate-700">{run.customer_email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Product info */}
            <div className="px-8 py-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                {run.product_type} Bilgileri
              </p>
              <div className="space-y-2">
                {Object.entries(productData)
                  .filter(([k, v]) => k !== "group" && v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] text-slate-400 capitalize">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm font-semibold text-slate-700">{v}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Results table */}
          <div className="px-8 py-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Teklif Tablosu</p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-2.5 w-8">#</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-2.5">Şirket</th>
                  <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-2.5">Fiyat</th>
                  <th className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-2.5">Taksit</th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-2.5">Not</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedResults.map((r, idx) => {
                  const isSuccess = isSuccessStatus(r.status) && r.price != null;
                  const isBest = r.price != null && r.price === bestPrice;
                  const rank = isSuccess ? successRows.findIndex(s => s.id === r.id) + 1 : null;

                  return (
                    <tr
                      key={r.id}
                      className={isBest ? "bg-emerald-50" : !isSuccess ? "opacity-60" : ""}
                    >
                      <td className="py-3 pr-2">
                        {isBest ? (
                          <span className="text-emerald-600 font-bold">🏆</span>
                        ) : rank ? (
                          <span className="text-[11px] text-slate-400 font-semibold">{rank}</span>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-semibold ${isBest ? "text-emerald-800" : !isSuccess ? "text-slate-400 italic" : "text-slate-800"}`}>
                          {r.company_name}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {r.price != null ? (
                          <span className={`font-bold ${isBest ? "text-emerald-700" : "text-slate-700"}`}>
                            {fmt(r.price)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            {r.status === "no_offer" || r.status === "Teklif Yok" ? "Teklif Yok" : r.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="text-[11px] text-slate-500">{r.installment ?? "—"}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-[11px] text-slate-400">{r.note ?? ""}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/60">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bu belge bilgilendirme amaçlı teklif özetidir. Fiyatlar değişebilir.
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-slate-400">{formatDate(run.created_at)}</p>
              <p className="text-[11px] font-semibold text-slate-500">PoliçePilot Sigorta CRM</p>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {waOpen && (
        <QuoteWhatsAppModal
          run={run as WaQuoteRun}
          results={results as WaQuoteResult[]}
          agencyName={agencyName}
          onClose={() => setWaOpen(false)}
        />
      )}
    </>
  );
}
