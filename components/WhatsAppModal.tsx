"use client";

import { useState } from "react";

// ─── Phone normalization ───────────────────────────────────────────────────────
// 05xx... (11 digits)  → 905xx...
// +905xx... / 905xx... → 905xx...
// 5xx...  (10 digits)  → 905xx...
export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 11) return "9" + d;
  if (d.length === 10) return "90" + d;
  return d;
}

// ─── Message templates ────────────────────────────────────────────────────────
type Template = {
  id: string;
  label: string;
  icon: string;
  body: (name: string, type: string) => string;
};

const TEMPLATES: Template[] = [
  {
    id: "renewal",
    label: "Poliçe Yenileme Hatırlatma",
    icon: "🔔",
    body: (name, type) =>
      `Sayın ${name}, ${type} poliçenizin yenileme zamanı yaklaşıyor. Kesintisiz koruma için en kısa sürede iletişime geçelim. Yardımcı olmaktan memnuniyet duyarım. 🔔`,
  },
  {
    id: "offer",
    label: "Teklif Hazır Bildirimi",
    icon: "📋",
    body: (name, type) =>
      `Sayın ${name}, ${type} sigortanız için hazırladığımız teklif incelemenize sunulmuştur. En uygun seçeneği birlikte değerlendirmek için sizi arayabilir miyim? 📋`,
  },
  {
    id: "docs",
    label: "Eksik Evrak Talebi",
    icon: "📎",
    body: (name, type) =>
      `Sayın ${name}, ${type} işleminizin tamamlanması için bazı belgeler eksik. Lütfen gerekli belgeleri iletir misiniz? Herhangi bir sorunuzda buradayım. 📎`,
  },
  {
    id: "price",
    label: "Fiyat İtirazına Cevap",
    icon: "💰",
    body: (name, type) =>
      `Sayın ${name}, ${type} sigortası konusundaki fiyat endişenizi anlıyorum. Bütçenize uygun alternatif seçenekler sunmak için sizinle özel görüşmek isterim. 💰`,
  },
];

const WA_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  customerName: string;
  phone: string;
  insuranceType?: string;
  onClose: () => void;
  onSent?: () => void;
};

export default function WhatsAppModal({ customerName, phone, insuranceType = "", onClose, onSent }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const waNumber = normalizePhone(phone);
  const template = TEMPLATES.find((t) => t.id === selectedId) ?? null;
  const preview = template ? template.body(customerName, insuranceType || "sigorta") : "";
  const waUrl = template
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(preview)}`
    : "";

  function handleOpen() {
    if (!waUrl) return;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onSent?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              {WA_ICON}
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm leading-tight">{customerName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {waNumber ? `+${waNumber}` : phone}
                {insuranceType && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{insuranceType}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template grid */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mesaj Şablonu Seç</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-left transition-all ${
                    selectedId === t.id
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xl leading-none flex-shrink-0 mt-0.5">{t.icon}</span>
                  <span className="text-xs font-medium text-slate-700 leading-snug">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className={`transition-all duration-200 ${preview ? "opacity-100" : "opacity-0 pointer-events-none h-0 overflow-hidden"}`}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mesaj Önizlemesi</p>
            <div className="relative bg-emerald-50 border border-emerald-100 rounded-2xl rounded-tl-none px-4 py-3.5">
              <p className="text-sm text-slate-700 leading-relaxed">{preview}</p>
              <span className="block text-right text-[10px] text-emerald-400 mt-1.5">SigortaOS</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={!selectedId}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow"
            >
              {WA_ICON}
              WhatsApp&apos;ta Aç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
