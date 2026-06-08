/**
 * src/lib/limits.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web lib/limits.ts'in mobil portu — anon key ile çalışır.
 *
 * Web'deki API route'lar service role kullanarak kesin limit uygular.
 * Mobil, anon key ile client-side ön kontrol yapar. Race condition riski
 * teorik olarak var ama pratik kullanımda yeterli güvenlik sağlar.
 *
 * Kullanım:
 *   const result = await checkLimit(supabase, agencyId, 'customers');
 *   if (!result.ok) { Alert... return; }
 *   // → insert
 */

import { supabase } from './supabase';

export type LimitResult = {
  ok: boolean;
  current: number;
  max: number;
  isActive: boolean;
  reason?: 'inactive' | 'limit_exceeded' | 'agency_not_found' | 'no_agency';
};

export type LimitEntity = 'customers' | 'requests' | 'policies' | 'users';

const MAX_DEFAULTS: Record<LimitEntity, number> = {
  customers: 200,
  requests:  500,
  policies:  500,
  users:     20,
};

const MAX_KEYS: Record<LimitEntity, string> = {
  customers: 'max_customers',
  requests:  'max_requests',
  policies:  'max_policies',
  users:     'max_users',
};

// Profil sorgusunda kullanılan tablo adı
const COUNT_TABLES: Record<LimitEntity, string> = {
  customers: 'customers',
  requests:  'requests',
  policies:  'policies',
  users:     'profiles',
};

/**
 * Belirli bir varlık (customers, requests, policies, users) için
 * acente limitini kontrol eder.
 *
 * @param agencyId  Kontrol edilecek acente UUID'si
 * @param entity    Hangi varlık için limit kontrolü yapılacak
 */
export async function checkLimit(
  agencyId: string | null,
  entity: LimitEntity
): Promise<LimitResult> {
  if (!agencyId) {
    return { ok: false, current: 0, max: 0, isActive: false, reason: 'no_agency' };
  }

  // 1. Acente limitlerini çek (agencies tablosunu anon key ile oku)
  const { data: agency, error: agencyErr } = await (supabase.from('agencies') as any)
    .select('id, is_active, max_customers, max_requests, max_policies, max_users')
    .eq('id', agencyId)
    .maybeSingle();

  if (agencyErr || !agency) {
    console.warn('[limits] agency fetch error:', agencyErr?.message);
    return { ok: false, current: 0, max: 0, isActive: false, reason: 'agency_not_found' };
  }

  // 2. Acente aktif mi?
  const isActive = agency.is_active ?? true;
  if (!isActive) {
    return {
      ok: false, current: 0,
      max: agency[MAX_KEYS[entity]] ?? MAX_DEFAULTS[entity],
      isActive: false,
      reason: 'inactive',
    };
  }

  const max: number = agency[MAX_KEYS[entity]] ?? MAX_DEFAULTS[entity];
  const table = COUNT_TABLES[entity];

  // 3. Mevcut kayıt sayısını say
  const { count, error: countErr } = await (supabase.from(table) as any)
    .select('*', { count: 'exact', head: true })
    .eq('agency_id', agencyId);

  if (countErr) {
    console.warn(`[limits] count error on ${table}:`, countErr.message);
    // Sayım başarısız olursa izin ver (engelleme yapma)
    return { ok: true, current: 0, max, isActive: true };
  }

  const current = count ?? 0;
  return {
    ok: current < max,
    current,
    max,
    isActive: true,
    reason: current >= max ? 'limit_exceeded' : undefined,
  };
}

/** Kullanıcıya gösterilecek hata mesajları */
export function limitErrorMessage(entity: LimitEntity, result: LimitResult): string {
  if (result.reason === 'no_agency') {
    return 'Hesabınız bir acenteye bağlı değil. Lütfen yöneticinizle iletişime geçin.';
  }
  if (result.reason === 'agency_not_found') {
    return 'Acente bulunamadı. Lütfen yöneticinizle iletişime geçin.';
  }
  if (result.reason === 'inactive') {
    return 'Acenteniz şu anda pasif durumda. Lütfen yöneticinizle iletişime geçin.';
  }
  const entityLabels: Record<LimitEntity, string> = {
    customers: 'müşteri',
    requests:  'teklif talebi',
    policies:  'poliçe',
    users:     'kullanıcı',
  };
  const entityLabel = entityLabels[entity] ?? entity;
  return (
    `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} limitine ulaşıldı ` +
    `(${result.current}/${result.max}). ` +
    `Yeni ${entityLabel} eklemek için planınızı yükseltin.`
  );
}
