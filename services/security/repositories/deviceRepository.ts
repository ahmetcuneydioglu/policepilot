/**
 * trusted_devices veri erişimi — ŞİMDİLİK YALNIZ ALTYAPI (login'e bağlı değil).
 * İleride yeni-cihaz doğrulama / şüpheli giriş için kullanılacak.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface DeviceUpsertInput {
  user_id: string;
  device_id: string;
  platform?: string | null;
  ip?: string | null;
  user_agent?: string | null;
}

/** Cihazı kaydet/güncelle (last_login_at ile). Henüz çağrılmıyor — altyapı hazır. */
export async function upsertDevice(input: DeviceUpsertInput): Promise<void> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("trusted_devices") as any).upsert(
    { ...input, last_login_at: new Date().toISOString() },
    { onConflict: "user_id,device_id" }
  );
}
