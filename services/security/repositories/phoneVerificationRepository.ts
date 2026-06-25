/**
 * phone_verifications veri erişimi — doğrulama olaylarının audit kaydı.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function recordVerification(
  userId: string,
  phone: string,
  method: string = "phone_otp"
): Promise<void> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("phone_verifications") as any).insert({
    user_id: userId,
    phone,
    method,
  });
}
