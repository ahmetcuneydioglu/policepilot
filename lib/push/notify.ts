import "server-only";

/**
 * Acente kullanıcılarına push bildirimi — push_tokens tablosundaki iOS native
 * token'lara APNs üzerinden gönderir. Ölü token'ları (Unregistered) temizler.
 * Expo token'ları ('ExponentPushToken[...]') atlanır — doğrudan APNs hex token
 * bekliyoruz (mobil registerPushToken native token kaydeder).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendApnsPush, type PushMessage } from "./apns";

const NATIVE_TOKEN_RE = /^[0-9a-fA-F]{64,}$/;

export async function notifyAgency(agencyId: string, msg: PushMessage): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("push_tokens")
      .select("token, platform")
      .eq("agency_id", agencyId)
      .eq("platform", "ios");

    const tokens = (data ?? [])
      .map((r) => String((r as { token: string }).token))
      .filter((t) => NATIVE_TOKEN_RE.test(t));
    if (tokens.length === 0) return;

    const results = await Promise.allSettled(tokens.map((t) => sendApnsPush(t, msg)));

    // Ölü token temizliği (410/Unregistered)
    const dead = tokens.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.gone;
    });
    if (dead.length > 0) {
      await admin.from("push_tokens").delete().in("token", dead);
    }
  } catch (err) {
    // Push asla ana akışı düşürmez
    console.error("[push/notifyAgency]", err);
  }
}
