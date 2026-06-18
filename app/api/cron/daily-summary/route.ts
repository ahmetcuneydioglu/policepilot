/**
 * GET /api/cron/daily-summary
 *
 * Günlük cron (vercel.json → 09:00 TR = 06:00 UTC).
 * daily_summary_enabled = true olan tüm acenteler için günlük operasyon
 * özetini hesaplar, whatsapp_queue'ya yazar ve ARDINDAN kuyruğu işler.
 *
 * Not (Vercel Hobby planı): Hobby'de cron'lar günde bir kez çalışabilir,
 * bu yüzden kuyruk işleme burada zincirlenir. Pro'ya geçildiğinde
 * /api/cron/send-whatsapp için "*\/5 * * * *" cron'u eklenip buradaki
 * processQueue çağrısı kaldırılabilir — queue mimarisi değişmez.
 *
 * Dedup: "daily:{agency_id}:{date}" anahtarı sayesinde cron iki kez
 * tetiklense bile aynı gün ikinci özet oluşmaz.
 *
 * Güvenlik: Vercel Cron çağrıları Authorization: Bearer ${CRON_SECRET} taşır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateDailySummaries, trToday } from "@/services/whatsapp/dailySummaryService";
import { processQueue } from "@/services/whatsapp/queueService";
import { inspectMetaToken } from "@/services/whatsapp/metaToken";
import { getPlatformWhatsAppConfig } from "@/services/whatsapp/platformConfig";

export async function GET(request: NextRequest) {
  // Fail-closed: CRON_SECRET set DEĞİLSE de reddet (env unutulursa endpoint herkese açılmaz).
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Token ön-doğrulaması (geçici token akışı) ────────────────────────
    // Platform token'ı geçersizse özetler yine ÜRETİLİR (kuyruğa yazılır),
    // ama Meta gönderimi processQueue içinde pending bekletilir; mock
    // acenteler etkilenmez. Sonuç cron yanıtında raporlanır.
    let metaToken: { valid: boolean; hours_left: number | null; error: string | null } | null = null;
    const platform = await getPlatformWhatsAppConfig();
    if (platform.provider === "meta_cloud" && !platform.testMode && platform.token) {
      const st = await inspectMetaToken(platform.token);
      metaToken = { valid: st.valid, hours_left: st.hours_left, error: st.error };
      if (!st.valid) {
        console.error("[cron/daily-summary] META TOKEN GEÇERSİZ:", st.error);
      } else if (st.expiring_soon) {
        console.warn(`[cron/daily-summary] Meta token ~${st.hours_left} saat içinde dolacak.`);
      }
    }

    const stats = await generateDailySummaries();
    // Hobby planı: ayrı 5dk'lık gönderim cron'u yok → kuyruğu hemen işle
    const sendResult = await processQueue(100);
    return NextResponse.json({ ok: true, date: trToday(), meta_token: metaToken, ...stats, send: sendResult });
  } catch (err) {
    console.error("[cron/daily-summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
