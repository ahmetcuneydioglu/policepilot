/**
 * GET /api/admin/security — Süper Admin Güvenlik Merkezi verisi.
 * KPI'lar + kullanıcı doğrulama durumu + security_logs olay akışı + cihazlar.
 * Yalnız super_admin (requireSuperAdmin). Okuma service-role (getSupabaseAdmin).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSuperAdmin } from "../_lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { maskPhone } from "@/services/security/otp/otpService";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin(request);
  if (gate.error) return gate.error;

  try {
    const admin = getSupabaseAdmin();
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [profilesRes, logsRes, devicesRes, sentRes, failedRes, sent24Res] = await Promise.all([
      (admin.from("profiles") as any).select("id, full_name, email, phone, verified_phone, phone_verified_at, last_login_at, role").limit(1000),
      (admin.from("security_logs") as any).select("id, user_id, event, channel, ip, metadata, created_at").order("created_at", { ascending: false }).limit(120),
      (admin.from("trusted_devices") as any).select("id, user_id, platform, ip, last_login_at, created_at").order("created_at", { ascending: false }).limit(100),
      (admin.from("security_logs") as any).select("id", { count: "exact", head: true }).eq("event", "OTP_SENT"),
      (admin.from("security_logs") as any).select("id", { count: "exact", head: true }).eq("event", "OTP_FAILED"),
      (admin.from("security_logs") as any).select("id", { count: "exact", head: true }).eq("event", "OTP_SENT").gte("created_at", since24h),
    ]);

    const profiles: any[] = profilesRes.data ?? [];
    const nameById = new Map<string, string>(
      profiles.map((p) => [p.id as string, (p.full_name || p.email || String(p.id).slice(0, 8)) as string])
    );

    const verifiedUsers = profiles.filter((p) => p.verified_phone).length;

    const users = [...profiles]
      .sort((a, b) => String(b.last_login_at ?? "").localeCompare(String(a.last_login_at ?? "")))
      .slice(0, 200)
      .map((p) => ({
        id: p.id,
        name: p.full_name || "—",
        email: p.email || "—",
        phone: p.phone ? maskPhone(p.phone) : "—",
        verified: !!p.verified_phone,
        verifiedAt: p.phone_verified_at ?? null,
        lastLoginAt: p.last_login_at ?? null,
        role: p.role ?? "agency_user",
      }));

    const logs = (logsRes.data ?? []).map((l: any) => ({
      id: l.id,
      event: l.event,
      channel: l.channel ?? null,
      userName: nameById.get(l.user_id) ?? "—",
      ip: l.ip ?? null,
      createdAt: l.created_at,
      metadata: l.metadata ?? {},
    }));

    const devices = (devicesRes.data ?? []).map((d: any) => ({
      id: d.id,
      userName: nameById.get(d.user_id) ?? "—",
      platform: d.platform ?? "—",
      ip: d.ip ?? null,
      lastLoginAt: d.last_login_at ?? null,
    }));

    return NextResponse.json({
      kpis: {
        totalUsers: profiles.length,
        verifiedUsers,
        unverifiedUsers: profiles.length - verifiedUsers,
        otpSentTotal: sentRes.count ?? 0,
        otpFailedTotal: failedRes.count ?? 0,
        otpSent24h: sent24Res.count ?? 0,
      },
      users,
      logs,
      devices,
    });
  } catch (e) {
    console.error("[admin/security]", e);
    return NextResponse.json({ error: "Güvenlik verisi yüklenemedi." }, { status: 500 });
  }
}
