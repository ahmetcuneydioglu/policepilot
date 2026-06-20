/**
 * src/lib/quoteDemo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Teklif Merkezi demo motoru — web lib/quote-providers/demo-provider.ts'in
 * birebir mobil portu (saf, deterministik; sunucu sırrı yok). Aynı seed → aynı
 * sonuç. Sonuçlar /api/quote-runs'a POST-ready snake_case döner.
 */

// Web DEMO_COMPANIES (12)
export const DEMO_COMPANIES = [
  'Allianz Sigorta', 'AXA Sigorta', 'Anadolu Sigorta', 'HDI Sigorta',
  'Mapfre Sigorta', 'Sompo Sigorta', 'Ray Sigorta', 'Neova Sigorta',
  'Türkiye Sigorta', 'Aksigorta', 'Zurich Sigorta', 'Quick Sigorta',
];

// Web lib/demo-mode.ts PRICE_RANGES (ürün → [min,max] TL)
const PRICE_RANGES: Record<string, [number, number]> = {
  'Trafik': [12_000, 35_000],
  'Kasko': [15_000, 80_000],
  'İMM': [3_000, 15_000],
  'DASK': [500, 4_000],
  'Konut': [2_000, 12_000],
  'TSS': [2_000, 15_000],
  'Ferdi Kaza': [800, 5_000],
  'Özel Sağlık': [8_000, 50_000],
  'Seyahat': [200, 2_000],
};
const DEFAULT_RANGE: [number, number] = [5_000, 30_000];

// Teklif çalışması için seçilebilir ürünler (fiyat aralığı olanlar)
export const QUOTE_PRODUCTS = Object.keys(PRICE_RANGES);

function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return Math.abs(h >>> 0);
}

const FIXED_ERROR_COMPANIES: Record<string, {
  status: 'company_error' | 'sbm_error' | 'timeout' | 'no_offer';
  errorSource: 'SBM' | 'COMPANY' | 'SYSTEM' | 'TIMEOUT' | null;
  errorCode?: string;
  errorMessage: string;
  actionHint: string;
}> = {
  'Allianz Sigorta': { status: 'company_error', errorSource: 'COMPANY', errorCode: 'ALZ-SYS-0042', errorMessage: 'Şirket sistemine bağlanılamadı. Bakım penceresi aktif olabilir.', actionHint: '10-15 dakika sonra tekrar deneyin veya Allianz acente hattını arayın.' },
  'Aksigorta': { status: 'sbm_error', errorSource: 'SBM', errorCode: 'BRV-OVM-POLICE-00358', errorMessage: 'Havuz kapsamına giriş veya çıkış söz konusu olmadığından mükerrer poliçe girişi yapılamaz.', actionHint: 'Mevcut poliçe bilgisini ve yenileme durumunu kontrol edin.' },
  'Mapfre Sigorta': { status: 'timeout', errorSource: 'TIMEOUT', errorCode: 'TIMEOUT-30S', errorMessage: 'Mapfre sistemi 30 saniye içinde yanıt vermedi.', actionHint: 'Mapfre web arayüzünden manuel teklif alabilirsiniz veya tekrar deneyin.' },
  'Sompo Sigorta': { status: 'no_offer', errorSource: null, errorMessage: 'Bu araç/profil için teklif kapsamı dışında.', actionHint: 'Sompo farklı kullanım tarzları veya hasar geçmişi olan araçlara teklif vermeyebilir.' },
};

/** POST /api/quote-runs results[] elemanı (snake_case). */
export type QuoteResultInput = {
  company_name: string;
  price?: number | null;
  installment?: string;
  status: string;
  source_type: 'demo';
  provider_name: 'Demo';
  error_source?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  action_hint?: string | null;
  raw_response: Record<string, unknown>;
};

/** Demo motoru: ürün + seed → 12 şirket sonucu (deterministik). */
export function runQuoteDemo(productType: string, seed: string): QuoteResultInput[] {
  return DEMO_COMPANIES.map((companyName) => {
    const fixed = FIXED_ERROR_COMPANIES[companyName];
    if (fixed) {
      return {
        company_name: companyName, status: fixed.status, source_type: 'demo', provider_name: 'Demo',
        error_source: fixed.errorSource ?? null, error_code: fixed.errorCode ?? null,
        error_message: fixed.errorMessage, action_hint: fixed.actionHint,
        raw_response: { simulated: true, scenario: 'fixed_error' },
      };
    }
    const h = hash32(`${productType}||${companyName}||${seed}`);
    if (h % 13 === 0) {
      return { company_name: companyName, status: 'no_offer', source_type: 'demo', provider_name: 'Demo', raw_response: { simulated: true, scenario: 'no_offer' } };
    }
    const [min, max] = PRICE_RANGES[productType] ?? DEFAULT_RANGE;
    const raw = min + (h % (max - min));
    const round = (productType === 'DASK' || productType === 'Seyahat') ? 10 : 100;
    const price = Math.round(raw / round) * round;
    const taksit = ['Peşin', '3 taksit', '6 taksit', '9 taksit', '12 taksit'];
    const installment = taksit[(h >>> 12) % taksit.length];
    return { company_name: companyName, status: 'success', price, installment, source_type: 'demo', provider_name: 'Demo', raw_response: { simulated: true, scenario: 'success' } };
  });
}
