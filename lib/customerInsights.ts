/**
 * PolicePilot — Müşteri İçgörü Motoru (kural tabanlı)
 *
 * Müşteri Kontrol Merkezi'nin "akıllı" katmanı: AI özeti, sonraki aksiyon,
 * çapraz satış fırsatları, müşteri değeri skoru, son iletişim.
 *
 * Saf fonksiyon — DB erişimi yok; API'den gelen ham veriyle çalışır.
 * İleride gerçek AI'ya geçiş: yalnız buildCustomerInsights içi değişir,
 * çıktı sözleşmesi (CustomerInsights) sabit kalır — UI ve mobil etkilenmez.
 */

// ─── Girdi tipleri (API satırlarının alt kümesi) ──────────────────────────────

type PolicyIn = {
  id: string;
  policy_type: string;
  status: string;
  premium: number | null;
  commission: number | null;
  end_date: string;
  renewal_status: string | null;
  document_path?: string | null;
};

type QuoteRunIn = { id: string; status: string; created_at: string; product_type: string };
type WhatsAppIn = { status: string; sent_at: string | null; created_at: string };

export interface InsightsInput {
  customer: { name: string; note: string | null; created_at: string };
  policies: PolicyIn[];
  quote_runs: QuoteRunIn[];
  documents: { id: string }[];
  whatsapp: WhatsAppIn[];
}

// ─── Çıktı sözleşmesi ─────────────────────────────────────────────────────────

export interface CrossSellSuggestion {
  type: string;        // INSURANCE_TYPES value'su (Teklif Oluştur ile eşleşir)
  label: string;
  emoji: string;
  est_value: number;   // tahmini yıllık prim (₺)
}

export interface NextAction {
  type: "renewal" | "quote" | "document" | "cross_sell" | "idle";
  label: string;
  detail: string;
  /** UI yönlendirmesi: renewal → policyId, quote → runId */
  ref_id: string | null;
}

export interface CustomerInsights {
  ai_summary: string[];
  next_action: NextAction;
  cross_sell: CrossSellSuggestion[];
  cross_sell_total: number;
  score: { grade: "A+" | "A" | "B" | "C" | "Yeni"; color: string };
  last_contact: { date: string; channel: string; label: string } | null;
  status_summary: {
    state: "active" | "passive";
    active_policies: number;
    upcoming_renewals: number;
    documents: number;
    open_quotes: number;
    cross_sell: number;
  };
}

// ─── Çapraz satış kataloğu: tahmini yıllık primler (₺, kural tabanlı) ────────
const CROSS_SELL_CATALOG: CrossSellSuggestion[] = [
  { type: "Trafik",      label: "Trafik Sigortası",    emoji: "🚗", est_value: 4500 },
  { type: "Kasko",       label: "Kasko",               emoji: "🛡️", est_value: 18500 },
  { type: "Konut",       label: "Konut Sigortası",     emoji: "🏠", est_value: 3500 },
  { type: "DASK",        label: "DASK",                emoji: "🏚️", est_value: 1800 },
  { type: "Tamamlayıcı", label: "Tamamlayıcı Sağlık",  emoji: "❤️", est_value: 12000 },
  { type: "Ferdi Kaza",  label: "Ferdi Kaza",          emoji: "⚡", est_value: 900 },
  { type: "Evcil Hayvan",label: "Evcil Hayvan",        emoji: "🐶", est_value: 2500 },
];

// Mevcut ürün → mantıklı öneri eşlemesi (araç varsa kasko, konut varsa DASK…)
const RELATED: Record<string, string[]> = {
  "Trafik":      ["Kasko", "Ferdi Kaza", "Tamamlayıcı"],
  "Kasko":       ["Trafik", "Ferdi Kaza", "Tamamlayıcı"],
  "İMM":         ["Kasko", "Trafik"],
  "DASK":        ["Konut", "Trafik", "Tamamlayıcı", "Evcil Hayvan"],
  "Konut":       ["DASK", "Trafik", "Tamamlayıcı"],
  "Sağlık":      ["Ferdi Kaza", "Trafik", "Konut"],
  "Tamamlayıcı": ["Ferdi Kaza", "Trafik", "Konut"],
  "Seyahat":     ["Tamamlayıcı", "Ferdi Kaza"],
};

const OPEN_QUOTE_STATUSES = ["Yeni", "Teklif Verildi", "Müşteri Düşünüyor"];

function daysTo(dateIso: string): number {
  const end = new Date(dateIso); end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}

// ─── Ana motor ────────────────────────────────────────────────────────────────

export function buildCustomerInsights(input: InsightsInput): CustomerInsights {
  const { policies, quote_runs, documents, whatsapp } = input;

  const active = policies.filter(p => p.status === "Aktif");
  const ownedTypes = new Set(policies.map(p => p.policy_type));

  const upcoming = active
    .filter(p => p.renewal_status !== "completed" && daysTo(p.end_date) <= 90)
    .sort((a, b) => daysTo(a.end_date) - daysTo(b.end_date));

  const openQuotes = quote_runs.filter(r => OPEN_QUOTE_STATUSES.includes(r.status));

  // ── Çapraz satış ──────────────────────────────────────────────────────────
  const relatedTypes = new Set<string>();
  for (const t of ownedTypes) for (const r of RELATED[t] ?? []) relatedTypes.add(r);
  let crossSell = CROSS_SELL_CATALOG.filter(c => relatedTypes.has(c.type) && !ownedTypes.has(c.type));
  if (crossSell.length === 0) {
    crossSell = CROSS_SELL_CATALOG.filter(c => !ownedTypes.has(c.type)).slice(0, 3);
  }
  crossSell = crossSell.slice(0, 4);
  const crossSellTotal = crossSell.reduce((s, c) => s + c.est_value, 0);

  // ── Son iletişim ──────────────────────────────────────────────────────────
  const sentWa = whatsapp
    .filter(w => w.status === "sent" || w.status === "skipped")
    .sort((a, b) => ((a.sent_at ?? a.created_at) < (b.sent_at ?? b.created_at) ? 1 : -1));
  const lastContact = sentWa.length > 0
    ? {
        date: sentWa[0].sent_at ?? sentWa[0].created_at,
        channel: "whatsapp",
        label: sentWa[0].status === "skipped" ? "WhatsApp (test) oluşturuldu" : "WhatsApp gönderildi",
      }
    : null;

  const daysSinceContact = lastContact
    ? Math.floor((Date.now() - new Date(lastContact.date).getTime()) / 864e5)
    : null;

  // ── Sonraki aksiyon (öncelik sırası) ──────────────────────────────────────
  let nextAction: NextAction;
  const overdueOrSoon = upcoming.find(p => daysTo(p.end_date) <= 30);
  const missingDoc    = active.find(p => !p.document_path);

  if (overdueOrSoon) {
    const d = daysTo(overdueOrSoon.end_date);
    nextAction = {
      type: "renewal",
      label: "Yenileme bekleniyor",
      detail: `${overdueOrSoon.policy_type} poliçesi ${d < 0 ? `${Math.abs(d)} gün gecikti` : d === 0 ? "bugün bitiyor" : `${d} gün içinde bitiyor`}`,
      ref_id: overdueOrSoon.id,
    };
  } else if (openQuotes.length > 0) {
    nextAction = {
      type: "quote",
      label: "Teklif bekleniyor",
      detail: `${openQuotes[0].product_type} teklifi müşteri yanıtı bekliyor`,
      ref_id: openQuotes[0].id,
    };
  } else if (missingDoc) {
    nextAction = {
      type: "document",
      label: "Evrak eksik",
      detail: `${missingDoc.policy_type} poliçesine evrak yüklenmemiş`,
      ref_id: missingDoc.id,
    };
  } else if (crossSell.length > 0) {
    nextAction = {
      type: "cross_sell",
      label: "Çapraz satış fırsatı mevcut",
      detail: `${crossSell[0].label} önerilebilir (~${crossSell[0].est_value.toLocaleString("tr-TR")} ₺)`,
      ref_id: null,
    };
  } else {
    nextAction = { type: "idle", label: "Takipte", detail: "Bekleyen acil iş bulunmuyor", ref_id: null };
  }

  // ── Müşteri değeri skoru ──────────────────────────────────────────────────
  const totalPremium = policies.reduce((s, p) => s + (p.premium ?? 0), 0);
  let grade: CustomerInsights["score"]["grade"];
  if (policies.length === 0)                                grade = "Yeni";
  else if (totalPremium >= 40000 || active.length >= 3)     grade = "A+";
  else if (totalPremium >= 15000 || active.length >= 2)     grade = "A";
  else if (totalPremium >= 5000)                            grade = "B";
  else                                                      grade = "C";

  const gradeColor: Record<string, string> = {
    "A+": "emerald", "A": "blue", "B": "amber", "C": "slate", "Yeni": "violet",
  };

  // ── AI özeti (kural tabanlı maddeler) ─────────────────────────────────────
  const summary: string[] = [];
  if (active.length > 0) {
    const types = [...new Set(active.map(p => p.policy_type))].join(", ");
    summary.push(`Aktif ${types} müşterisi`);
  } else {
    summary.push("Aktif poliçesi bulunmuyor");
  }
  if (upcoming.length > 0) {
    const d = daysTo(upcoming[0].end_date);
    summary.push(d < 0 ? `Yenileme ${Math.abs(d)} gün gecikti` : `${d} gün sonra yenilenecek (${upcoming[0].policy_type})`);
  } else if (active.length > 0) {
    const soonest = [...active].sort((a, b) => daysTo(a.end_date) - daysTo(b.end_date))[0];
    summary.push(`${daysTo(soonest.end_date)} gün sonra yenilenecek (${soonest.policy_type})`);
  }
  if (daysSinceContact == null)          summary.push("Henüz iletişim kurulmadı");
  else if (daysSinceContact > 30)        summary.push(`Son ${daysSinceContact} gündür işlem yapılmadı`);
  else                                   summary.push(`Son iletişim ${daysSinceContact === 0 ? "bugün" : `${daysSinceContact} gün önce`}`);
  for (const miss of ["Trafik", "Konut", "Tamamlayıcı"]) {
    if (!ownedTypes.has(miss)) {
      const item = CROSS_SELL_CATALOG.find(c => c.type === miss)!;
      summary.push(`${item.label} bulunmuyor — satılabilir`);
      break;
    }
  }
  if (crossSellTotal > 0) {
    summary.push(`Tahmini çapraz satış değeri: ${crossSellTotal.toLocaleString("tr-TR")} ₺`);
  }

  return {
    ai_summary: summary.slice(0, 6),
    next_action: nextAction,
    cross_sell: crossSell,
    cross_sell_total: crossSellTotal,
    score: { grade, color: gradeColor[grade] },
    last_contact: lastContact,
    status_summary: {
      state: active.length > 0 ? "active" : "passive",
      active_policies: active.length,
      upcoming_renewals: upcoming.filter(p => daysTo(p.end_date) <= 30 && daysTo(p.end_date) >= -60).length,
      documents: documents.length,
      open_quotes: openQuotes.length,
      cross_sell: crossSell.length,
    },
  };
}
