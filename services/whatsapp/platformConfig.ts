/**
 * SigortaOS — Platform WhatsApp Yapılandırması
 *
 * WhatsApp hattının sahibi PLATFORMDUR; Meta kimlik bilgileri acente
 * seviyesinde değil burada yaşar. Kaynak önceliği:
 *   platform_settings tablosu → env (META_ACCESS_TOKEN / META_PHONE_NUMBER_ID)
 *
 * Tablo yoksa/okunamazsa env yedeğiyle çalışır — migration gecikse bile
 * gönderim altyapısı ayakta kalır.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { WhatsAppProviderName } from "./types";

export interface PlatformWhatsAppConfig {
  provider:  WhatsAppProviderName;
  token:     string | null;
  senderId:  string | null;   // Meta Phone Number ID
  wabaId:    string | null;
  testMode:  boolean;
  /** Token/sender platform tablosundan mı env'den mi geldi? (tanı için) */
  source:    "platform_settings" | "env" | "mixed" | "none";
}

type Row = {
  whatsapp_provider:    string | null;
  meta_access_token:    string | null;
  meta_phone_number_id: string | null;
  meta_waba_id:         string | null;
  test_mode:            boolean | null;
};

export async function getPlatformWhatsAppConfig(): Promise<PlatformWhatsAppConfig> {
  let row: Row | null = null;
  try {
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("platform_settings") as any)
      .select("whatsapp_provider, meta_access_token, meta_phone_number_id, meta_waba_id, test_mode")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.warn("[platformConfig] platform_settings okunamadı, env yedeğine düşülüyor:", error.message);
    } else {
      row = data as Row | null;
    }
  } catch (err) {
    console.warn("[platformConfig] beklenmeyen hata, env yedeğine düşülüyor:", err);
  }

  const envToken  = process.env.META_ACCESS_TOKEN    || null;
  const envSender = process.env.META_PHONE_NUMBER_ID || null;

  const token    = row?.meta_access_token    || envToken;
  const senderId = row?.meta_phone_number_id || envSender;

  const fromDb  = Boolean(row?.meta_access_token || row?.meta_phone_number_id);
  const fromEnv = (!row?.meta_access_token && Boolean(envToken)) || (!row?.meta_phone_number_id && Boolean(envSender));

  return {
    provider: ((row?.whatsapp_provider as WhatsAppProviderName) ?? "meta_cloud"),
    token,
    senderId,
    wabaId:   row?.meta_waba_id ?? process.env.META_WABA_ID ?? null,
    testMode: row?.test_mode ?? true,
    source:   token == null && senderId == null ? "none" : fromDb && fromEnv ? "mixed" : fromDb ? "platform_settings" : "env",
  };
}
