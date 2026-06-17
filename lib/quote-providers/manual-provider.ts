/**
 * SigortaOS — Manual Provider
 *
 * API entegrasyonu olmadan, kullanıcı fiyatları elle girer.
 * runQuote() tüm şirketler için "pending" döner.
 * Fiyatlar daha sonra kullanıcı tarafından doldurulur.
 */

import type { QuoteProvider, QuoteProviderInput, QuoteProviderResult } from "./types";

export class ManualProvider implements QuoteProvider {
  readonly name       = "Manuel";
  readonly sourceType = "manual" as const;

  runQuote(input: QuoteProviderInput): Promise<QuoteProviderResult[]> {
    const results: QuoteProviderResult[] = input.companyNames.map(companyName => ({
      companyName,
      status:       "pending" as const,
      sourceType:   "manual" as const,
      providerName: "Manuel",
      rawResponse:  {},
    }));
    return Promise.resolve(results);
  }
}

export const manualProvider = new ManualProvider();

// ─── Gelecekte eklenecek provider'lar (şablonlar) ────────────────────────────
//
// export class InsurGatewayProvider implements QuoteProvider { ... }
// export class CompanyApiProvider    implements QuoteProvider { ... }
// export class RobotProvider         implements QuoteProvider { ... }
