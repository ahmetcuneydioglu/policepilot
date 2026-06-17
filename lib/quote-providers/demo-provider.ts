/**
 * SigortaOS — Demo Provider
 *
 * Gerçekçi demo sonuçlar üretir:
 * - Belirli şirketler deterministik hata döndürür
 * - Geri kalanı deterministik fiyat üretir
 * - Aynı seed her zaman aynı sonucu verir
 */

import { PRICE_RANGES }                           from "@/lib/demo-mode";
import type { QuoteProvider, QuoteProviderInput, QuoteProviderResult } from "./types";

// ─── djb2 hash (demo-mode ile aynı) ──────────────────────────────────────────
function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h >>> 0);
}

// ─── Deterministik hata senaryoları ──────────────────────────────────────────
/**
 * Belirli şirketler için sabit hata türleri.
 * Bu tablodakiler HER ZAMAN bu hatayla döner — demo realism için.
 */
const FIXED_ERROR_COMPANIES: Record<string, {
  status:       "company_error" | "sbm_error" | "timeout" | "no_offer";
  errorSource:  "SBM" | "COMPANY" | "SYSTEM" | "TIMEOUT" | null;
  errorCode?:   string;
  errorMessage: string;
  actionHint:   string;
}> = {
  "Allianz Sigorta": {
    status:       "company_error",
    errorSource:  "COMPANY",
    errorCode:    "ALZ-SYS-0042",
    errorMessage: "Şirket sistemine bağlanılamadı. Bakım penceresi aktif olabilir.",
    actionHint:   "10-15 dakika sonra tekrar deneyin veya Allianz acente hattını arayın.",
  },
  "Aksigorta": {
    status:       "sbm_error",
    errorSource:  "SBM",
    errorCode:    "BRV-OVM-POLICE-00358",
    errorMessage: "Havuz kapsamına giriş veya çıkış söz konusu olmadığından mükerrer poliçe girişi yapılamaz.",
    actionHint:   "Mevcut poliçe bilgisini ve yenileme durumunu kontrol edin. Geçerli poliçe bitiş tarihinden önce yenileme yapılıyorsa SBM'ye bildirim gerekebilir.",
  },
  "Mapfre Sigorta": {
    status:       "timeout",
    errorSource:  "TIMEOUT",
    errorCode:    "TIMEOUT-30S",
    errorMessage: "Mapfre sistemi 30 saniye içinde yanıt vermedi.",
    actionHint:   "Mapfre web arayüzünden manuel teklif alabilirsiniz veya tekrar deneyin.",
  },
  "Sompo Sigorta": {
    status:       "no_offer",
    errorSource:  null,
    errorMessage: "Bu araç/profil için teklif kapsamı dışında.",
    actionHint:   "Sompo farklı kullanım tarzları veya hasar geçmişi olan araçlara teklif vermeyebilir.",
  },
};

/** Fiyat aralığı dışındaki ürünler için varsayılan */
const DEFAULT_RANGE: [number, number] = [5_000, 30_000];

/** ~%8 oranında rastgele "no_offer" (deterministik) */
function isRandomNoOffer(h: number): boolean {
  return h % 13 === 0;
}

// ─── Demo Provider ─────────────────────────────────────────────────────────────
export class DemoProvider implements QuoteProvider {
  readonly name       = "Demo";
  readonly sourceType = "demo" as const;

  runQuote(input: QuoteProviderInput): Promise<QuoteProviderResult[]> {
    const results: QuoteProviderResult[] = input.companyNames.map(companyName => {
      // Sabit hata senaryosu?
      const fixedErr = FIXED_ERROR_COMPANIES[companyName];
      if (fixedErr) {
        return {
          companyName,
          status:       fixedErr.status,
          sourceType:   "demo",
          providerName: "Demo",
          errorSource:  fixedErr.errorSource ?? null,
          errorCode:    fixedErr.errorCode,
          errorMessage: fixedErr.errorMessage,
          actionHint:   fixedErr.actionHint,
          rawResponse:  { simulated: true, scenario: "fixed_error" },
        } as QuoteProviderResult;
      }

      // Deterministik hash: productType + company + seed
      const h = hash32(`${input.productType}||${companyName}||${input.seed}`);

      // Rastgele no_offer?
      if (isRandomNoOffer(h)) {
        return {
          companyName,
          status:       "no_offer",
          sourceType:   "demo",
          providerName: "Demo",
          rawResponse:  { simulated: true, scenario: "no_offer" },
        } as QuoteProviderResult;
      }

      // Fiyat üret
      const [min, max] = PRICE_RANGES[input.productType] ?? DEFAULT_RANGE;
      const range  = max - min;
      const raw    = min + (h % range);
      const round  = (input.productType === "DASK" || input.productType === "Seyahat") ? 10 : 100;
      const price  = Math.round(raw / round) * round;

      // Taksit: hash'ten deterministik seç
      const taksitOptions = ["Peşin", "3 taksit", "6 taksit", "9 taksit", "12 taksit"];
      const installment   = taksitOptions[(h >>> 12) % taksitOptions.length];

      return {
        companyName,
        status:       "success",
        price,
        installment,
        sourceType:   "demo",
        providerName: "Demo",
        rawResponse:  { simulated: true, scenario: "success" },
      } as QuoteProviderResult;
    });

    return Promise.resolve(results);
  }
}

export const demoProvider = new DemoProvider();
