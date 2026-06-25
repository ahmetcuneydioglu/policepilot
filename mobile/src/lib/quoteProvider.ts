/**
 * src/lib/quoteProvider.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ASENKRON TEKLİF SAĞLAYICI SOYUTLAMASI (Adapter)
 *
 * Gerçek sigorta teklif platformları (Fora vb.) async çalışır: sorgu başlatılır,
 * şirketler botlar çalıştıkça fiyatlarını YAVAŞ YAVAŞ döndürür, frontend belirli
 * aralıklarla "poll" eder. Bu dosya o davranışı SOYUTLAR.
 *
 * ⚠️ Şu an YALNIZ yerel `DemoAsyncProvider` aktif — HİÇBİR DIŞ İSTEK ATMAZ, hiçbir
 *    3. taraf sunucusuna bağlanmaz. Tamamen deterministik bir SİMÜLASYON (aynı seed
 *    → aynı sonuç, zamanla gelen). Test/geliştirme ortamı içindir.
 *
 *    Yetkili (resmî API'li) bir gerçek entegrasyon geldiğinde, `ApiQuoteProvider`
 *    aynı `QuoteProvider` arayüzünü uygular (kendi sunucumuzda, resmî credential ile);
 *    UI ve poll mekanizması HİÇ DEĞİŞMEZ.
 */

import { runQuoteDemo, QuoteResultInput } from './quoteDemo';

// ─── DIŞ (sağlayıcı) ham yanıt şekli — gerçek API yanıtının normalize edileceği model ──
/** Bir Fora-tarzı API'nin şirket başına döndüreceği ham kayıt. */
export interface RawForaQuote {
  TeklifId: string;
  SirketKodu: string;
  SirketAdi: string;
  Prim: number;                 // 0 = henüz gelmedi / teklif yok
  DurumKodu: 'BEKLENIYOR' | 'SORGULANIYOR' | 'TAMAM' | 'TEKLIF_YOK' | 'HATA';
  DurumAdi: string;             // insan-okur durum
  TaksitSecenek: string | null;
  HataMesaji: string | null;
}

// ─── İÇERİ normalize edilmiş tek tip (UI + persist) ──────────────────────────
export type ProviderStatus = 'pending' | 'running' | 'success' | 'no_offer' | 'error';
export interface NormalizedQuote {
  teklifId: string;
  companyCode: string;
  companyName: string;
  status: ProviderStatus;
  durumAdi: string;
  price: number | null;
  installment: string | null;
  errorMessage: string | null;
}

export interface PollResult {
  done: boolean;       // tüm şirketler yanıtladı / zaman aşımı doldu
  total: number;
  answered: number;    // success + no_offer + error
  quotes: NormalizedQuote[];
}

export interface StartQuoteInput { productType: string; seed: string; }

/** Tüm sağlayıcılar (demo/gerçek) bu arayüzü uygular. */
export interface QuoteProvider {
  name: string;
  providerType: 'demo' | 'api';
  startQuote(input: StartQuoteInput): Promise<{ jobId: string }>;
  pollResults(jobId: string): Promise<PollResult>;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function rhash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return Math.abs(h >>> 0);
}
function companyCode(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w.length >= 2 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}
/** Şirketin yanıt vereceği an (ms, deterministik). Timeout şirketler en geç döner. */
function readyAtMs(company: string, seed: string, status: string): number {
  const h = rhash(`ready|${company}|${seed}`);
  if (status === 'timeout') return 8000 + (h % 1600);   // 8.0–9.6 sn (en son, hata)
  return 700 + (h % 6300);                                // 0.7–7.0 sn
}
function mapDurum(kodu: RawForaQuote['DurumKodu']): ProviderStatus {
  switch (kodu) {
    case 'TAMAM': return 'success';
    case 'TEKLIF_YOK': return 'no_offer';
    case 'HATA': return 'error';
    case 'SORGULANIYOR': return 'running';
    default: return 'pending';
  }
}
function errLabel(status: string): string {
  if (status === 'sbm_error') return 'SBM Hatası';
  if (status === 'timeout') return 'Zaman Aşımı';
  return 'Şirket Hatası';
}

/** Ham (Fora-tarzı) → normalize. Gerçek API geldiğinde de TEK kullanılacak mapper. */
export function normalizeForaQuote(raw: RawForaQuote): NormalizedQuote {
  const status = mapDurum(raw.DurumKodu);
  return {
    teklifId: raw.TeklifId,
    companyCode: raw.SirketKodu,
    companyName: raw.SirketAdi,
    status,
    durumAdi: raw.DurumAdi,
    price: status === 'success' ? (raw.Prim || null) : null,
    installment: raw.TaksitSecenek,
    errorMessage: raw.HataMesaji,
  };
}

// ─── DEMO async sağlayıcı (yerel simülasyon, dış istek YOK) ───────────────────
function synthRaw(f: QuoteResultInput, seed: string, elapsed: number): RawForaQuote {
  const ready = readyAtMs(f.company_name, seed, f.status);
  const base = { TeklifId: `T-${rhash(f.company_name + seed) % 1_000_000}`, SirketKodu: companyCode(f.company_name), SirketAdi: f.company_name };
  if (elapsed < ready) {
    const running = ready - elapsed <= 1800;
    return { ...base, Prim: 0, DurumKodu: running ? 'SORGULANIYOR' : 'BEKLENIYOR', DurumAdi: running ? 'Sorgulanıyor…' : 'Sırada', TaksitSecenek: null, HataMesaji: null };
  }
  if (f.status === 'success') return { ...base, Prim: f.price ?? 0, DurumKodu: 'TAMAM', DurumAdi: 'Teklif Hazır', TaksitSecenek: f.installment ?? 'Peşin', HataMesaji: null };
  if (f.status === 'no_offer') return { ...base, Prim: 0, DurumKodu: 'TEKLIF_YOK', DurumAdi: 'Teklif Yok', TaksitSecenek: null, HataMesaji: null };
  return { ...base, Prim: 0, DurumKodu: 'HATA', DurumAdi: errLabel(f.status), TaksitSecenek: null, HataMesaji: f.error_message ?? 'Hata' };
}

class DemoAsyncProvider implements QuoteProvider {
  name = 'Demo (Async Simülasyon)';
  providerType = 'demo' as const;

  async startQuote(input: StartQuoteInput): Promise<{ jobId: string }> {
    // jobId başlangıç zamanını taşır → poll stateless/deterministik
    return { jobId: `${Date.now()}::${input.productType}::${input.seed}` };
  }

  async pollResults(jobId: string): Promise<PollResult> {
    const parts = jobId.split('::');
    const startMs = Number(parts[0]);
    const productType = parts[1] ?? '';
    const seed = parts.slice(2).join('::');
    const elapsed = Date.now() - startMs;

    const finals = runQuoteDemo(productType, seed);
    const quotes = finals.map((f) => normalizeForaQuote(synthRaw(f, seed, elapsed)));
    const maxReady = Math.max(...finals.map((f) => readyAtMs(f.company_name, seed, f.status)));
    const isAnswered = (q: NormalizedQuote) => q.status === 'success' || q.status === 'no_offer' || q.status === 'error';

    return { done: elapsed >= maxReady, total: quotes.length, answered: quotes.filter(isAnswered).length, quotes };
  }
}

// ─── GERÇEK API sağlayıcı (yer tutucu — yetkili erişim geldiğinde doldurulacak) ─
/* eslint-disable @typescript-eslint/no-unused-vars */
class ApiQuoteProvider implements QuoteProvider {
  name = 'Gerçek API';
  providerType = 'api' as const;
  async startQuote(_input: StartQuoteInput): Promise<{ jobId: string }> {
    throw new Error('Gerçek teklif API entegrasyonu için YETKİLİ erişim (resmî credential + endpoint) gerekir. Şu an devre dışı.');
  }
  async pollResults(_jobId: string): Promise<PollResult> {
    throw new Error('Gerçek teklif API entegrasyonu için YETKİLİ erişim gerekir. Şu an devre dışı.');
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const demoProvider = new DemoAsyncProvider();

/** Aktif sağlayıcı. Şu an demo simülasyon; yetkili API gelince burada değişir. */
export function getActiveProvider(): QuoteProvider {
  return demoProvider;
}
