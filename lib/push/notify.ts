import "server-only";

/**
 * Push bildirimi — push_tokens tablosundaki iOS native token'lara APNs üzerinden.
 * İki hedefleme: notifyAgency (acentedeki herkes) · notifyUser (tek kişi —
 * takip hatırlatmaları gibi kişisel bildirimler). Ölü token'lar (Unregistered)
 * temizlenir. Expo token'ları ('ExponentPushToken[...]') atlanır — doğrudan
 * APNs hex token bekliyoruz (mobil registerPushToken native token kaydeder).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendApnsPush, type PushMessage } from "./apns";

const NATIVE_TOKEN_RE = /^[0-9a-fA-F]{64,}$/;

async function sendToTokens(rows: { token: string }[], msg: PushMessage): Promise<void> {
  const admin = getSupabaseAdmin();
  const tokens = rows.map((r) => String(r.token)).filter((t) => NATIVE_TOKEN_RE.test(t));
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
}

export async function notifyAgency(agencyId: string, msg: PushMessage): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("push_tokens")
      .select("token")
      .eq("agency_id", agencyId)
      .eq("platform", "ios");
    await sendToTokens((data ?? []) as { token: string }[], msg);
  } catch (err) {
    // Push asla ana akışı düşürmez
    console.error("[push/notifyAgency]", err);
  }
}

/** Tek kullanıcıya push — "takibi oluşturan kişi" hedeflemesi. */
export async function notifyUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("platform", "ios");
    await sendToTokens((data ?? []) as { token: string }[], msg);
  } catch (err) {
    console.error("[push/notifyUser]", err);
  }
}
