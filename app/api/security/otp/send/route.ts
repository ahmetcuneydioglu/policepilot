/**
 * POST /api/security/otp/send
 * Giriş yapmış (ama telefonu doğrulanmamış) kullanıcıya OTP gönderir.
 * Yöntem registry üzerinden (varsayılan phone_otp) — future-ready.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCaller } from "../../../whatsapp/_lib/auth";
import { getVerificationMethod } from "@/services/security/methods";
import { SecurityError } from "@/services/security/errors";

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;

    let methodType = "phone_otp";
    try {
      const body = await request.json();
      if (body?.method) methodType = String(body.method);
    } catch { /* boş gövde — varsayılan yöntem */ }

    const method = getVerificationMethod(methodType);
    const result = await method.challenge({ userId: caller.userId, agencyId: caller.agencyId, ip, userAgent });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SecurityError) {
      return NextResponse.json({ error: err.message, code: err.code, ...(err.meta ?? {}) }, { status: err.status });
    }
    console.error("[security/otp/send]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
