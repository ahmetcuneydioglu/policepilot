/**
 * GET /api/cron/renewal-check
 *
 * Günlük cron (vercel.json → her gece 00:00 TR).
 * YENİLEME DİZİSİ (Sprint 4): 30 / 7 / 1 gün eşiklerinde biten aktif poliçeler için
 *   • browser  → notifications kaydı (bell'e realtime düşer)
 *   • whatsapp → whatsapp_queue kaydı (mevcut kuyruk/gönderim akışı işler;
 *                test_mode ve provider ayarlarına kuyruk katmanı karar verir)
 *
 * Dedup (çift katman):
 *   1) renewal_jobs unique index (policy_id, notify_type, channel)
 *   2) whatsapp_queue.dedup_key unique — "renewal:<policy>:<tip>"
 *
 * Güvenlik: fail-closed CRON_SECRET.
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

const THRESHOLDS = [
  { days: 30, type: "renewal_30d" },
  { days: 7,  type: "renewal_7d"  },
  { days: 1,  type: "renewal_24h" },
] as const;

const ACTIVE_CHANNELS = ["browser", "whatsapp"] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function notifTitle(days: number): string {
  return days === 1 ? "Poliçe yarın sona eriyor" : `Poliçe ${days} gün içinde sona eriyor`;
}

function waMessage(p: RenewalPolicy, days: number): string {
  const name = p.customers?.name ?? "Değerli müşterimiz";
  const when = days === 1 ? "yarın sona eriyor" : `${days} gün içinde sona eriyor`;
  return `Merhaba ${name}, ${p.policy_type} poliçeniz ${when}. Kesintisiz güvence için yenileme teklifinizi hazırlıyoruz — acenteniz kısa süre içinde sizinle iletişime geçecek. Dilerseniz bu mesaja yanıt verebilirsiniz.`;
}

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Fail-closed: CRON_SECRET yoksa da reddet
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    let created = 0, queuedWa = 0, skipped = 0;

    for (const th of THRESHOLDS) {
      const target = isoDate(new Date(Date.now() + th.days * 864e5));

      // ── Bu eşikte biten aktif poliçeler (yenilenmemiş) ─────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: policies, error: polErr } = await (admin.from("policies") as any)
        .select("id, agency_id, policy_type, end_date, policy_no, customers(name, phone)")
        .eq("status", "Aktif")
        .neq("renewal_status", "completed")
        .eq("end_date", target);

      if (polErr) {
        console.error(`[renewal-check] policy fetch (${th.type}):`, polErr.message);
        continue;
      }

      for (const p of (policies ?? []) as RenewalPolicy[]) {
        for (const channel of ACTIVE_CHANNELS) {
          // WhatsApp: telefon yoksa üretme
          if (channel === "whatsapp" && !p.customers?.phone) continue;

          // ── Job — unique index dedup sağlar ─────────────────────────────────
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: job, error: jobErr } = await (admin.from("renewal_jobs") as any)
            .insert({
              policy_id: p.id, agency_id: p.agency_id,
              notify_type: th.type, channel, status: "pending",
              payload: {
                customer_name: p.customers?.name ?? null,
                customer_phone: p.customers?.phone ?? null,
                policy_type: p.policy_type, policy_no: p.policy_no, end_date: p.end_date,
                days_left: th.days,
              },
            })
            .select("id").single();

          if (jobErr) {
            if (jobErr.code === "23505") { skipped++; continue; } // zaten üretilmiş
            console.error("[renewal-check] job insert:", jobErr.message);
            continue;
          }

          let sendErr: string | null = null;

          if (channel === "browser") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (admin.from("notifications") as any).insert({
              agency_id: p.agency_id,
              type: "renewal",
              title: notifTitle(th.days),
              body: `${p.customers?.name ?? "Müşteri"} — ${p.policy_type}${p.policy_no ? ` (${p.policy_no})` : ""} · ${th.days === 1 ? "yarın bitiyor" : `${th.days} gün kaldı`}. Yenileme teklifini hazırlayın.`,
              link: "/renewals",
              ref_id: p.id,
            });
            sendErr = error?.message ?? null;
            if (!sendErr) created++;
          }

          if (channel === "whatsapp") {
            // Kuyruğa devret — gönderimi mevcut WA akışı (test_mode/provider) yönetir
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (admin.from("whatsapp_queue") as any).insert({
              agency_id: p.agency_id,
              phone: p.customers!.phone,
              message: waMessage(p, th.days),
              status: "pending",
              template_key: "renewal_reminder",
              dedup_key: `renewal:${p.id}:${th.type}`,
            });
            // dedup_key çakışması = zaten kuyrukta → hata değil
            sendErr = error && error.code !== "23505" ? error.message : null;
            if (!error) queuedWa++;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from("renewal_jobs") as any)
            .update(sendErr
              ? { status: "failed", error_message: sendErr }
              : { status: "sent", sent_at: new Date().toISOString() })
            .eq("id", job.id);
        }
      }
    }

    return NextResponse.json({ ok: true, notified: created, whatsapp_queued: queuedWa, deduplicated: skipped });
  } catch (err) {
    console.error("[renewal-check]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
