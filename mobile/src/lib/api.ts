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

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...(await authHeaders()) } });
  return handle<T>(res);
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}

export async function apiPut<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}
