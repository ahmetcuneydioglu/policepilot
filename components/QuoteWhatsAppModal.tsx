"use client";

import { useState } from "react";
import { Copy, Check, MessageSquare, Sparkles, X, Phone } from "lucide-react";
import { normalizePhone } from "@/lib/phone";

// ─── Types ────────────────────────────────────────────────────────────────────
export type WaQuoteResult = {
  id: string;
  company_name: string;
  price: number | null;
  installment: string | null;
  status: string;
};

export type WaQuoteRun = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_type: string;
};

type Props = {
  run: WaQuoteRun;
  results: WaQuoteResult[];
  agencyName?: string;
  onClose: () => void;
  onSent?: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

function getSuccessResults(results: WaQuoteResult[]): WaQuoteResult[] {
  return results
    .filter(r => ["success", "Aktif", "Seçildi"].includes(r.status) && r.price != null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
}

function buildDefaultMessage(run: WaQuoteRun, successResults: WaQuoteResult[], agencyName?: string): string {
  const agency = agencyName ?? "SigortaOS Sigorta";
  if (successResults.length === 0) return "";

  const best = successResults[0];
  const rest = successResults.slice(1);

  const bestLine = `🏆 ${best.company_name} — ${fmt(best.price)}${best.installment && best.installment !== "Peşin" ? ` (${best.installment})` : ""}`;

  const otherLines = rest.length > 0
    ? `\nDiğer alternatifler:\n${rest.map(r => `• ${r.company_name} — ${fmt(r.price)}`).join("\n")}`
    : "";

  return `Merhaba ${run.customer_name || "Sayın Müşterimiz"},

${run.product_type} için tekliflerinizi hazırladık.

En uygun teklif:
${bestLine}${otherLines}

Detaylı bilgi için bize dönüş yapabilirsiniz.

${agency}`;
}

function buildAiMessage(run: WaQuoteRun, successResults: WaQuoteResult[], agencyName?: string): string {
  const agency = agencyName ?? "SigortaOS Sigorta";
  if (successResults.length === 0) return "";

  const firstName = (run.customer_name ?? "").split(" ")[0] || "Sayın Müşterimiz";
  const best = successResults[0];
  const rest = successResults.slice(1);
  const worst = successResults[successResults.length - 1];

  let savingsLine = "";
  if (successResults.length > 1 && best.price && worst.price && worst.price > best.price) {
    const savingPct = Math.round(((worst.price - best.price) / worst.price) * 100);
    if (savingPct > 0) {
      savingsLine = `\n✅ En pahalı seçeneğe göre *%${savingPct} tasarruf*`;
    }
  }

  const installmentLine = best.installment && best.installment !== "Peşin"
    ? ` (${best.installment})`
    : "";

  const otherLines = rest.length > 0
    ? `\nDiğer seçenekler:\n${rest.map(r => `• ${r.company_name}: ${fmt(r.price)}`).join("\n")}`
    : "";

  return `Merhaba ${firstName},

${run.product_type} sigortanız için ${successResults.length} farklı şirketin teklifini karşılaştırdık.

Size en uygun teklif olarak *${best.company_name}*'i öneriyoruz:
💰 *${fmt(best.price)}*${installmentLine}${savingsLine}${otherLines}

Sorularınız için her zaman buradayım.

${agency}`;
}

// ─── WA Icon ─────────────────────────────────────────────────────────────────
const WA_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuoteWhatsAppModal({ run, results, agencyName, onClose, onSent }: Props) {
  const successResults = getSuccessResults(results);
  const defaultMsg = buildDefaultMessage(run, successResults, agencyName);

  const [message, setMessage] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const hasPhone = !!run.customer_phone;
  const waNumber = hasPhone ? normalizePhone(run.customer_phone!) : "";

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGenerateAi() {
    setGeneratingAi(true);
    setTimeout(() => {
      setMessage(buildAiMessage(run, successResults, agencyName));
      setGeneratingAi(false);
    }, 600);
  }

  function handleOpenWa() {
    if (!hasPhone) return;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onSent?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              {WA_ICON}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">WhatsApp Teklif Mesajı</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {run.customer_name ?? "Müşteri"} · {run.product_type}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* No phone warning */}
        {!hasPhone && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex-shrink-0">
            <Phone className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <p className="text-xs text-rose-700 font-semibold">
              Müşterinin telefon numarası tanımlı değil. WhatsApp&apos;ta açma özelliği kullanılamaz.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* AI button */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mesaj</label>
            <button
              onClick={handleGenerateAi}
              disabled={generatingAi || successResults.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-sm"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAi ? "animate-spin" : ""}`} />
              {generatingAi ? "Oluşturuluyor…" : "AI Mesaj Oluştur"}
            </button>
          </div>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 text-sm text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none leading-relaxed font-sans bg-slate-50"
          />

          {successResults.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 font-medium">
              Henüz başarılı teklif bulunamadı. Önce teklif ekleyin.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 space-y-2.5 flex-shrink-0">
          {/* Row 1: İptal + Kopyala */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopyalandı!</>
                : <><Copy className="w-3.5 h-3.5" /> Kopyala</>}
            </button>
          </div>

          {/* Row 2: WA full-width */}
          <button
            onClick={handleOpenWa}
            disabled={!hasPhone}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {WA_ICON}
            WhatsApp&apos;ta Aç
          </button>

          {/* onSent note */}
          {onSent && hasPhone && (
            <p className="text-center text-[10px] text-slate-400">
              • Durum &ldquo;Teklif Verildi&rdquo; olarak güncellenecek
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
