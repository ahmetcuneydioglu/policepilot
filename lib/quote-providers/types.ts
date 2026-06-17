/**
 * SigortaOS — Quote Engine Types
 * Tüm provider'ların ortak tipler ve interface'i.
 */

// ─── Kaynak tipi ─────────────────────────────────────────────────────────────
export type SourceType = "demo" | "manual" | "api" | "robot" | "gateway";

// ─── Sonuç durumu ─────────────────────────────────────────────────────────────
/** Provider'dan dönen her şirket satırının durumu */
export type ResultStatus =
  | "pending"        // Henüz çalışmadı (initial)
  | "running"        // API/robot çağrısı devam ediyor
  | "success"        // Fiyat geldi
  | "no_offer"       // Şirket teklif vermedi (örn. poliçe kapsamı dışı)
  | "company_error"  // Şirket sistemi hata döndürdü
  | "sbm_error"      // SBM (Sigorta Bilgi Merkezi) kural ihlali
  | "timeout"        // Süre aşımı
  | "cancelled";     // Kullanıcı veya sistem tarafından iptal edildi

/** Hata kaynağı */
export type ErrorSource = "SBM" | "COMPANY" | "SYSTEM" | "TIMEOUT" | null;

// ─── Provider girdisi ─────────────────────────────────────────────────────────
export interface QuoteProviderInput {
  productType: string;
  companyNames: string[];
  /** Deterministik seed için kullanılır (demo mode) */
  seed: string;
  customerTc?: string;
  plaka?: string;
  customerName?: string;
  productData?: Record<string, string>;
}

// ─── Provider çıktısı (tek şirket satırı) ────────────────────────────────────
export interface QuoteProviderResult {
  companyName:    string;
  status:         ResultStatus;
  price?:         number | null;
  installment?:   string;
  note?:          string;
  sourceType:     SourceType;
  providerName:   string;

  // Hata alanları — sadece hatalı durumlarda dolu
  errorSource?:   ErrorSource;
  errorCode?:     string;     // BRV-OVM-POLICE-00358
  errorMessage?:  string;
  actionHint?:    string;
  rawResponse?:   Record<string, unknown>;
}

// ─── Provider interface ────────────────────────────────────────────────────────
/**
 * Tüm provider'ların uygulaması gereken arayüz.
 * İleride: InsurGatewayProvider, AllianzApiProvider, RobotProvider, vs.
 */
export interface QuoteProvider {
  /** Provider'ın okunabilir adı — log/UI'da gösterilir */
  readonly name: string;
  readonly sourceType: SourceType;

  /**
   * Tüm şirketler için tek seferlik asenkron çalıştırma.
   * Her şirket için bir QuoteProviderResult döner.
   */
  runQuote(input: QuoteProviderInput): Promise<QuoteProviderResult[]>;
}

// ─── UI helper: durum metni & renkleri ───────────────────────────────────────
export const STATUS_UI: Record<ResultStatus, {
  label:      string;
  badgeCls:   string;
  rowCls:     string;
  isError:    boolean;
}> = {
  pending: {
    label:    "Bekliyor",
    badgeCls: "bg-slate-100 text-slate-500",
    rowCls:   "opacity-60",
    isError:  false,
  },
  running: {
    label:    "Çalışıyor",
    badgeCls: "bg-blue-50 text-blue-600 border border-blue-200",
    rowCls:   "bg-blue-50/20",
    isError:  false,
  },
  success: {
    label:    "Teklif Hazır",
    badgeCls: "bg-emerald-500 text-white",
    rowCls:   "",
    isError:  false,
  },
  no_offer: {
    label:    "Teklif Yok",
    badgeCls: "bg-slate-100 text-slate-500 border border-slate-200",
    rowCls:   "opacity-55 bg-slate-50/40",
    isError:  false,
  },
  company_error: {
    label:    "Şirket Hatası",
    badgeCls: "bg-orange-100 text-orange-700 border border-orange-200",
    rowCls:   "bg-orange-50/30",
    isError:  true,
  },
  sbm_error: {
    label:    "SBM Hatası",
    badgeCls: "bg-amber-100 text-amber-700 border border-amber-200",
    rowCls:   "bg-amber-50/30",
    isError:  true,
  },
  timeout: {
    label:    "Zaman Aşımı",
    badgeCls: "bg-rose-100 text-rose-600 border border-rose-200",
    rowCls:   "opacity-60",
    isError:  true,
  },
  cancelled: {
    label:    "İptal",
    badgeCls: "bg-slate-100 text-slate-400",
    rowCls:   "opacity-40",
    isError:  false,
  },
};

/** Eski "Aktif/Teklif Yok/Seçildi" değerlerini yeni sisteme map et */
export function legacyStatusToResult(old: string): ResultStatus {
  switch (old) {
    case "Aktif":    return "success";
    case "Seçildi":  return "success";
    case "Teklif Yok": return "no_offer";
    default:         return "success";
  }
}
