/**
 * GET /api/cron/send-whatsapp
 *
 * Gönderim cron'u (vercel.json → her 5 dakikada bir).
 * whatsapp_queue'daki pending kayıtları acente ayarına göre işler:
 *
 *   test_mode = true  → gerçek gönderim YOK, kayıt "skipped"
 *   test_mode = false → provider'a gönder → "sent" / "failed"
 *
 * Başarısız gönderim MAX_ATTEMPTS'a kadar pending kalır, sonraki
 * çalışmada yeniden denenir.
 *
 * Güvenlik: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { processQueue } from "@/services/whatsapp/queueService";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processQueue(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/send-whatsapp]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
