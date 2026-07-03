/**
 * POST /api/push/test — kendi acentenin cihazlarına deneme push'u.
 * Uçtan uca doğrulama için: uygulamayı arka plana al → bu ucu çağır → bildirim düşmeli.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCaller } from "../../whatsapp/_lib/auth";
import { notifyAgency } from "@/lib/push/notify";

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request);
  if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
  if (!caller.agencyId) return NextResponse.json({ error: "Acente bulunamadı." }, { status: 400 });

  await notifyAgency(caller.agencyId, {
    title: "SigortaOS Test",
    body: "Push bildirimleri çalışıyor 🎉",
  });
  return NextResponse.json({ ok: true });
}
