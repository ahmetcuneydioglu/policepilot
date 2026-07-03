/**
 * POST /api/security/account/delete
 * Kendi hesabını kalıcı siler (App Store Guideline 5.1.1(v) gereksinimi).
 * Kullanıcının auth kaydı + profili + push token'ları silinir.
 * Acentenin iş verileri (müşteri/poliçe) acenteye aittir, silinmez.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCaller } from "../../../whatsapp/_lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logSecurityEvent } from "@/services/security/securityLog";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;

    // Audit — silmeden önce yaz (user_id FK'sı varsa silme sonrası yazılamaz)
    await logSecurityEvent({
      userId: caller.userId,
      agencyId: caller.agencyId ?? undefined,
      event: "ACCOUNT_DELETED",
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    }).catch(() => {});

    // Kullanıcıya bağlı satırlar (FK cascade garantisi olmayanlar) — hata fatal değil
    await admin.from("push_tokens").delete().eq("user_id", caller.userId).then(() => {}, () => {});
    await admin.from("profiles").delete().eq("id", caller.userId).then(() => {}, () => {});

    // Auth kaydını sil — asıl işlem
    const { error } = await admin.auth.admin.deleteUser(caller.userId);
    if (error) {
      return NextResponse.json({ error: "Hesap silinemedi: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
