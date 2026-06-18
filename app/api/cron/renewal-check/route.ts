/**
 * GET /api/cron/renewal-check
 *
 * Günlük cron (vercel.json → her gece 00:00 TR).
 * Yarın bitecek poliçeleri bulur, renewal_jobs + notifications kaydı üretir.
 *
 * Dedup: renewal_jobs üzerindeki unique index (policy_id, notify_type, channel)
 * sayesinde aynı poliçe için ikinci bildirim üretilmez.
 *
 * Kanal mimarisi: şimdilik yalnız "browser" işlenir; whatsapp/email/push
 * için job satırı aynı pipeline'a eklenecek şekilde tasarlandı.
 *
 * Güvenlik: Vercel Cron çağrıları Authorization: Bearer ${CRON_SECRET} taşır.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RenewalPolicy = {
  id: string;
  agency_id: string | null;
  policy_type: string;
  end_date: string;
  policy_no: string | null;
  customers: { name: string; phone: string } | null;
};

// Şimdilik aktif kanal: browser. İleride buraya whatsapp/email/push eklenecek.
const ACTIVE_CHANNELS = ["browser"] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  // ── Auth: Vercel Cron secret ───────────────────────────────────────────────
  // Fail-closed: CRON_SECRET set DEĞİLSE de reddet (env unutulursa endpoint herkese açılmaz).
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    const tomorrow = new Date(Date.now() + 1 * 864e5);

    // ── Yarın bitecek aktif poliçeler ────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: policies, error: polErr } = await (admin.from("policies") as any)
      .select("id, agency_id, policy_type, end_date, policy_no, customers(name, phone)")
      .eq("status", "Aktif")
      .eq("end_date", isoDate(tomorrow));

    if (polErr) {
      console.error("[renewal-check] policy fetch error:", polErr.message);
      return NextResponse.json({ error: polErr.message }, { status: 500 });
    }

    const list = (policies ?? []) as RenewalPolicy[];
    let created = 0;
    let skipped = 0;

    for (const p of list) {
      for (const channel of ACTIVE_CHANNELS) {
        // ── Job oluştur — unique index dedup sağlar ──────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: jobErr } = await (admin.from("renewal_jobs") as any)
          .insert({
            policy_id:   p.id,
            agency_id:   p.agency_id,
            notify_type: "renewal_24h",
            channel,
            status:      "pending",
            payload: {
              customer_name: p.customers?.name  ?? null,
              customer_phone: p.customers?.phone ?? null,
              policy_type:   p.policy_type,
              policy_no:     p.policy_no,
              end_date:      p.end_date,
            },
          })
          .select("id")
          .single();

        if (jobErr) {
          // 23505 = unique violation → daha önce bildirilmiş, atla
          if (jobErr.code === "23505") { skipped++; continue; }
          console.error("[renewal-check] job insert error:", jobErr.message);
          continue;
        }

        // ── Browser kanalı: notifications kaydı → realtime ile client'a düşer ─
        if (channel === "browser") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: notifErr } = await (admin.from("notifications") as any)
            .insert({
              agency_id: p.agency_id,
              type:      "renewal",
              title:     "Poliçe yarın sona eriyor",
              body:      `${p.customers?.name ?? "Müşteri"} — ${p.policy_type}${p.policy_no ? ` (${p.policy_no})` : ""} poliçesi yarın bitiyor. Yenileme teklifini hazırlayın.`,
              link:      "/renewals",
              ref_id:    p.id,
            });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from("renewal_jobs") as any)
            .update(
              notifErr
                ? { status: "failed", error_message: notifErr.message }
                : { status: "sent", sent_at: new Date().toISOString() }
            )
            .eq("id", job.id);

          if (!notifErr) created++;
        }
        // İleride: channel === "whatsapp" → WA Business API çağrısı
        //          channel === "email"    → Resend/SES çağrısı
        //          channel === "push"     → FCM/OneSignal çağrısı
      }
    }

    return NextResponse.json({
      ok: true,
      checked: list.length,
      notified: created,
      deduplicated: skipped,
      date: isoDate(tomorrow),
    });
  } catch (err) {
    console.error("[renewal-check]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
