/**
 * src/lib/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web /api/* köprüsü için hafif istemci. Supabase oturum access_token'ını
 * `Authorization: Bearer` olarak gönderir (web tarafı resolveCaller bunu kabul
 * eder). Sunucu-sır/RLS gerektiren özellikler (WhatsApp, AI, OCR) bunu kullanır.
 *
 * Taban URL: EXPO_PUBLIC_API_URL (yoksa prod: https://sigortaos.com).
 */

import { supabase } from './supabase';

// ÖNEMLİ: www'li kanonik domain — apex (sigortaos.com) 308 ile www'ye yönlendirir
// ve fetch çapraz-origin redirect'te Authorization başlığını düşürür → 401.
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://www.sigortaos.com').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `Sunucu hatası (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return json as T;
}

// Zayıf şebekede sonsuz spinner önlemi: her istek 15 sn'de iptal olur.
const TIMEOUT_MS = 15_000;

function withTimeout(init: RequestInit): RequestInit {
  try {
    return { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) };
  } catch {
    return init; // eski runtime'da timeout desteklenmiyorsa vazgeç
  }
}

function friendlyNetworkError(e: unknown): ApiError {
  const aborted = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
  return new ApiError(
    aborted ? 'Sunucu yanıt vermedi. Bağlantını kontrol edip tekrar dene.' : 'Bağlantı kurulamadı. İnternetini kontrol et.',
    0
  );
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const doFetch = async () =>
    fetch(`${API_BASE}${path}`, withTimeout({ headers: { ...(await authHeaders()) } }));
  try {
    return await handle<T>(await doFetch());
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // GET idempotent → tek sessiz retry (geçici kopukluk/timeout için)
    try {
      return await handle<T>(await doFetch());
    } catch (e2) {
      if (e2 instanceof ApiError) throw e2;
      throw friendlyNetworkError(e2);
    }
  }
}

async function mutate<T>(path: string, method: 'POST' | 'PUT' | 'PATCH', body?: unknown): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, withTimeout({
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body ?? {}),
    }));
    return await handle<T>(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw friendlyNetworkError(e); // mutasyonda otomatik retry YOK (çift kayıt riski)
  }
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  return mutate<T>(path, 'POST', body);
}

export async function apiPut<T = any>(path: string, body?: unknown): Promise<T> {
  return mutate<T>(path, 'PUT', body);
}

export async function apiPatch<T = any>(path: string, body?: unknown): Promise<T> {
  return mutate<T>(path, 'PATCH', body);
}

/** multipart/form-data POST — Content-Type'ı fetch'in boundary ile koymasına bırak. */
export async function apiPostForm<T = any>(path: string, form: FormData): Promise<T> {
  try {
    // OCR yüklemeleri büyük olabilir → form isteklerinde timeout uygulanmaz.
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { ...(await authHeaders()) },
      body: form,
    });
    return await handle<T>(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw friendlyNetworkError(e);
  }
}
