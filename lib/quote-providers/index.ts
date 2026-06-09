/**
 * PolicePilot — Quote Providers Index
 *
 * Tüm provider'ları bir arada dışa aktarır.
 * DEMO_MODE = true  → DemoProvider
 * DEMO_MODE = false → ManualProvider
 *
 * İleride: getProvider("gateway") → InsurGatewayProvider
 */

export * from "./types";
export { demoProvider,  DemoProvider  } from "./demo-provider";
export { manualProvider, ManualProvider } from "./manual-provider";

import { DEMO_MODE }     from "@/lib/demo-mode";
import { demoProvider }  from "./demo-provider";
import { manualProvider } from "./manual-provider";
import type { QuoteProvider, SourceType } from "./types";

/** Aktif provider — DEMO_MODE flag'ine göre otomatik seçilir */
export const activeProvider: QuoteProvider = DEMO_MODE ? demoProvider : manualProvider;

/** Belirli bir source_type için provider döner (ileride genişletilecek) */
export function getProvider(type: SourceType): QuoteProvider {
  switch (type) {
    case "demo":    return demoProvider;
    case "manual":  return manualProvider;
    // case "gateway": return insurGatewayProvider;
    // case "api":     return companyApiProvider;
    // case "robot":   return robotProvider;
    default:        return manualProvider;
  }
}
