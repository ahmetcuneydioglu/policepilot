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

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await generateDailySummaries();
    // Hobby planı: ayrı 5dk'lık gönderim cron'u yok → kuyruğu hemen işle
    const sendResult = await processQueue(100);
    return NextResponse.json({ ok: true, date: trToday(), ...stats, send: sendResult });
  } catch (err) {
    console.error("[cron/daily-summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
