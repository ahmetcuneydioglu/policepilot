/**
 * Public uygulama origin'i — davet/aktivasyon linklerinde kullanılır.
 *
 * `new URL(request.url).origin` Vercel'de sunucunun İÇ host'unu (localhost) dönebilir.
 * Doğru public adres için sırasıyla:
 *   1. NEXT_PUBLIC_APP_URL env (en güvenilir; canlıda tek doğru kaynak)
 *   2. x-forwarded-host + x-forwarded-proto (Vercel otomatik gerçek domain'i verir)
 *   3. host header
 *   4. request.url origin (son çare)
 */

import type { NextRequest } from "next/server";

/**
 * generateLink çıktısından WhatsApp-güvenli davet linki üretir.
 *
 * Ham Supabase `action_link` (`/auth/v1/verify?...`) TEK KULLANIMLIKTIR ve
 * WhatsApp/iMessage link önizleme botları onu arka planda açıp token'ı tüketir.
 * Bunun yerine kendi /davet sayfamıza `token_hash` veririz; token yalnız kişi
 * sayfayı açıp JS çalışınca (verifyOtp) doğrulanır — bot JS çalıştırmaz, token sağ kalır.
 */
export function buildDavetLink(
  origin: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any,
  fallbackType: "invite" | "recovery"
): string | null {
  const tokenHash = properties?.hashed_token;
  if (!tokenHash) return null;
  const type = properties?.verification_type || fallbackType;
  return `${origin}/davet?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
}

export function getAppOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");

  const fwdHost = request.headers.get("x-forwarded-host");
  const host    = fwdHost || request.headers.get("host");
  if (host && !/^localhost|^127\.0\.0\.1/.test(host)) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return "https://policepilot.vercel.app";
  }
}
