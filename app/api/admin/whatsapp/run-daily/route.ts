/**
 * POST /api/admin/whatsapp/run-daily — günlük özetleri ŞİMDİ üret + gönder (super_admin)
 *
 * Cron'u (06:00 UTC) beklemeden, super_admin panelinden manuel tetikler.
 * generateDailySummaries() + processQueue() zincirler — cron ile aynı akış.
 * Dedup sayesinde aynı gün ikinci kez çalıştırmak yeni özet üretmez.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateDailySummaries, trToday } from "@/services/whatsapp/dailySummaryService";
import { processQueue } from "@/services/whatsapp/queueService";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";
import { requireSuperAdmin } from "../../_lib/auth";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) return auth.error;

  try {
    const platform = await getPlatformWhatsAppConfig();
    const stats = await generateDailySummaries();
    const send  = await processQueue(100);
    return NextResponse.json({
      ok: true,
      date: trToday(),
      test_mode: platform.testMode, // true ise gerçek gönderim YOK (skipped)
      ...stats,
      send,
    });
  } catch (err) {
    console.error("[api/admin/whatsapp/run-daily]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
