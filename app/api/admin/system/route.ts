/**
 * GET /api/admin/system — Sistem Merkezi (yalnız super_admin)
 * Veritabanı, storage, aktivite, cron logları, hata logları, deploy bilgisi.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";

const TABLES = [
  "agencies", "profiles", "customers", "policies", "quote_runs",
  "quote_results", "whatsapp_queue", "documents", "requests", "notifications",
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (table: string) => admin.from(table) as any;

    // ── Tablo satır sayıları (head+count: veri çekmeden) ──────────────────
    const t0 = Date.now();
    const counts = await Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await t(table).select("*", { head: true, count: "exact" });
        return { table, count: error ? null : (count ?? 0), error: error?.message ?? null };
      })
    );
    const dbLatency = Date.now() - t0;

    // ── Storage kullanımı: documents.file_size toplamı + bucket listesi ───
    const [{ data: docs }, bucketsRes] = await Promise.all([
      t("documents").select("file_size"),
      admin.storage.listBuckets(),
    ]);
    const storageBytes = (docs ?? []).reduce((s: number, d: { file_size: number | null }) => s + (d.file_size ?? 0), 0);

    // ── Aktivite: son 24 saat ─────────────────────────────────────────────
    const dayAgo = new Date(Date.now() - 864e5).toISOString();
    const [custDay, runDay, waDay, profTotal] = await Promise.all([
      t("customers").select("*", { head: true, count: "exact" }).gte("created_at", dayAgo),
      t("quote_runs").select("*", { head: true, count: "exact" }).gte("created_at", dayAgo),
      t("whatsapp_queue").select("*", { head: true, count: "exact" }).gte("created_at", dayAgo),
      t("profiles").select("*", { head: true, count: "exact" }),
    ]);

    // ── Cron logları: son günlük özet üretimleri ──────────────────────────
    const { data: cronRows } = await t("whatsapp_queue")
      .select("created_at, status, phone, template_key")
      .eq("template_key", "daily_summary")
      .order("created_at", { ascending: false })
      .limit(15);

    // ── Hata logları: başarısız gönderimler ───────────────────────────────
    const { data: errorRows } = await t("whatsapp_queue")
      .select("created_at, phone, error_message, template_key")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      database: {
        status: counts.every(c => c.error == null) ? "ok" : "degraded",
        latency_ms: dbLatency,
        tables: counts,
        total_rows: counts.reduce((s, c) => s + (c.count ?? 0), 0),
      },
      storage: {
        buckets: (bucketsRes.data ?? []).map(b => b.name),
        used_bytes: storageBytes,
        used_label: storageBytes < 1024 * 1024
          ? `${Math.round(storageBytes / 1024)} KB`
          : `${(storageBytes / 1024 / 1024).toFixed(1)} MB`,
        document_count: (docs ?? []).length,
      },
      activity: {
        total_users: profTotal.count ?? 0,
        customers_24h: custDay.count ?? 0,
        quotes_24h: runDay.count ?? 0,
        whatsapp_24h: waDay.count ?? 0,
      },
      cron_logs: cronRows ?? [],
      error_logs: errorRows ?? [],
      deploy: {
        env:    process.env.VERCEL_ENV ?? "local",
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
        region: process.env.VERCEL_REGION ?? null,
      },
    });
  } catch (err) {
    console.error("[api/admin/system]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
