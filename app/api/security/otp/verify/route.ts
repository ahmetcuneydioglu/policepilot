/**
 * POST /api/security/otp/verify   body: { code: string, method?: string }
 * Kodu doğrular; başarıda profiles.verified_phone=true. Future-ready (yöntem registry).
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

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const code = String((body as Record<string, unknown>)?.code ?? "");
    const methodType = (body as Record<string, unknown>)?.method ? String((body as Record<string, unknown>).method) : "phone_otp";

    const method = getVerificationMethod(methodType);
    const result = await method.verify({ userId: caller.userId, agencyId: caller.agencyId, ip, userAgent }, { code });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SecurityError) {
      return NextResponse.json({ error: err.message, code: err.code, ...(err.meta ?? {}) }, { status: err.status });
    }
    console.error("[security/otp/verify]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
