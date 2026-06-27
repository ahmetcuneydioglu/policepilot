/**
 * otp_requests veri erişimi (Repository pattern). Saf CRUD — iş kuralı yok.
 * Yazma yalnız service-role (getSupabaseAdmin → RLS bypass).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { VerificationChannel, VerificationPurpose } from "../types";

export interface OtpRow {
  id: string;
  user_id: string;
  phone: string;
  channel: string;
  purpose: string;
  code_hash: string;
  code_salt: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
  created_at: string;
}

export interface CreateOtpInput {
  user_id: string;
  phone: string;
  channel?: VerificationChannel;
  purpose?: VerificationPurpose;
  code_hash: string;
  code_salt: string;
  expires_at: string;
  max_attempts?: number;
}

export async function createOtp(input: CreateOtpInput): Promise<OtpRow> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from("otp_requests") as any)
    .insert({ channel: "sms", purpose: "phone_verify", max_attempts: 5, ...input })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OtpRow;
}

/** En son AKTİF (consumed olmamış) OTP. */
export async function getActiveOtp(
  userId: string,
  purpose: VerificationPurpose = "phone_verify"
): Promise<OtpRow | null> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("otp_requests") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OtpRow) ?? null;
}

/** En son OTP (cooldown hesabı için — consumed olsa da). */
export async function getLatestOtp(
  userId: string,
  purpose: VerificationPurpose = "phone_verify"
): Promise<OtpRow | null> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("otp_requests") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OtpRow) ?? null;
}

/** sinceIso'dan beri (created_at >=) kullanıcının OTP istek sayısı — günlük cap için. */
export async function countSince(
  userId: string,
  sinceIso: string,
  purpose: VerificationPurpose = "phone_verify"
): Promise<number> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin.from("otp_requests") as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .gte("created_at", sinceIso);
  return (count as number) ?? 0;
}

export async function incrementAttempts(id: string): Promise<number> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("otp_requests") as any)
    .select("attempts")
    .eq("id", id)
    .single();
  const attempts = ((data?.attempts ?? 0) as number) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("otp_requests") as any).update({ attempts }).eq("id", id);
  return attempts;
}

export async function consumeOtp(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("otp_requests") as any)
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id);
}

/** Kullanıcının bekleyen tüm aktif kodlarını iptal et (yeni kod göndermeden önce). */
export async function consumeActive(
  userId: string,
  purpose: VerificationPurpose = "phone_verify"
): Promise<void> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("otp_requests") as any)
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("consumed_at", null);
}
