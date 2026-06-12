/**
 * Admin API ortak guard'ı — tüm /api/admin/* endpoint'leri yalnız super_admin.
 * resolveCaller (profiles tabanlı role çözümü) yeniden kullanılır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCaller, type ApiCaller } from "../../whatsapp/_lib/auth";

export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ caller: ApiCaller; error?: never } | { caller?: never; error: NextResponse }> {
  const caller = await resolveCaller(request);
  if (!caller) {
    return { error: NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 }) };
  }
  if (caller.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Bu alan yalnız platform yöneticisi için." }, { status: 403 }) };
  }
  return { caller };
}
