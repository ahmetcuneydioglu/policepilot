/**
 * Meta access token ömür/geçerlilik kontrolü.
 *
 * Geçici token akışı desteklenir (System User token'a geçilmedi):
 *  - debug_token ile expires_at okunur
 *  - 72 saatten az kaldıysa UI'da kırmızı uyarı gösterilir
 *  - Cron, gönderimden önce token'ı doğrular; geçersizse mesajlar
 *    pending bekletilir (deneme hakkı yakılmaz), token yenilenince gider
 */

export interface MetaTokenStatus {
  valid: boolean;
  /** Unix saniye — 0/null ise süresiz (System User) */
  expires_at: number | null;
  hours_left: number | null;
  /** hours_left < 72 — UI kırmızı uyarı eşiği */
  expiring_soon: boolean;
  error: string | null;
}

const WARN_HOURS = 72;

/** Etkin Meta token'ını çözer: acente ayarı → env */
export function resolveMetaToken(agencyToken?: string | null): string | null {
  return agencyToken || process.env.META_ACCESS_TOKEN || null;
}

/**
 * Kısa süreli (~24 saat) token'ı 60 günlük long-lived token'a çevirir.
 * Meta'nın resmi fb_exchange_token akışı — Business Verification GEREKTİRMEZ.
 * META_APP_ID + META_APP_SECRET env değişkenleri şarttır (yalnız server-side).
 */
export async function exchangeForLongLivedToken(shortToken: string): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "META_APP_ID ve META_APP_SECRET tanımlı değil — Vercel'e ekleyin (Meta App Dashboard → Settings → Basic) ve redeploy edin.",
    };
  }

  try {
    const url =
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(shortToken)}`;

    const res  = await fetch(url);
    const text = await res.text();
    let json: { access_token?: string; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: `Meta beklenmeyen cevap (HTTP ${res.status}): ${text.slice(0, 120)}` };
    }

    if (!res.ok || !json.access_token) {
      const e = json.error;
      return {
        ok: false,
        error: `${e?.message ?? "Token uzatılamadı"}${e?.code != null ? ` (code ${e.code})` : ""}`,
      };
    }

    return { ok: true, token: json.access_token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function inspectMetaToken(token: string): Promise<MetaTokenStatus> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
    );
    const text = await res.text();
    let json: { data?: { is_valid?: boolean; expires_at?: number; error?: { message?: string } }; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(text);
    } catch {
      return { valid: false, expires_at: null, hours_left: null, expiring_soon: false, error: `Meta beklenmeyen cevap (HTTP ${res.status})` };
    }

    // debug_token'ın kendisi token hatası verdiyse token ölü demektir
    if (json.error) {
      return {
        valid: false, expires_at: null, hours_left: null, expiring_soon: false,
        error: `${json.error.message ?? "Token doğrulanamadı"}${json.error.code != null ? ` (code ${json.error.code})` : ""}`,
      };
    }

    const d = json.data ?? {};
    const expiresAt = typeof d.expires_at === "number" && d.expires_at > 0 ? d.expires_at : null;
    const hoursLeft = expiresAt != null ? Math.max(0, (expiresAt * 1000 - Date.now()) / 36e5) : null;

    return {
      valid:         Boolean(d.is_valid),
      expires_at:    expiresAt,
      hours_left:    hoursLeft != null ? Math.round(hoursLeft * 10) / 10 : null,
      expiring_soon: hoursLeft != null && hoursLeft < WARN_HOURS,
      error:         d.is_valid ? null : (d.error?.message ?? "Token geçersiz veya süresi dolmuş."),
    };
  } catch (err) {
    return {
      valid: false, expires_at: null, hours_left: null, expiring_soon: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
