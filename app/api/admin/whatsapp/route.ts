/**
 * GET /api/admin/whatsapp — WhatsApp Operasyon Merkezi (yalnız super_admin)
 * Platform geneli mesaj istatistikleri + son 100 mesaj + canlı kuyruk.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSuperAdmin } from "../_lib/auth";

// Meta utility mesajı tahmini birim maliyeti (₺) — fiyatlandırma netleşince güncellenir
const COST_PER_MESSAGE_TRY = 0.45;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (table: string) => admin.from(table) as any;

    const [allRes, lastRes, agRes] = await Promise.all([
      t("whatsapp_queue").select("agency_id, status, created_at, sent_at"),
      t("whatsapp_queue").select("id, agency_id, phone, status, template_key, message, created_at, sent_at, error_message, provider")
        .order("created_at", { ascending: false }).limit(100),
      t("agencies").select("id, name"),
    ]);

    const all = allRes.data ?? [];
    const agencyNames = new Map<string, string>((agRes.data ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const trDay = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : null;

    type Row = { agency_id: string; status: string; created_at: string; sent_at: string | null };
    const sent    = all.filter((w: Row) => w.status === "sent").length;
    const skipped = all.filter((w: Row) => w.status === "skipped").length;
    const failed  = all.filter((w: Row) => w.status === "failed").length;
    const pending = all.filter((w: Row) => w.status === "pending").length;

    // En aktif acente
    const byAgency = new Map<string, number>();
    for (const w of all as Row[]) byAgency.set(w.agency_id, (byAgency.get(w.agency_id) ?? 0) + 1);
    const top = [...byAgency.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return NextResponse.json({
      totals: {
        total: all.length,
        today: all.filter((w: Row) => trDay(w.sent_at ?? w.created_at) === today).length,
        sent, skipped, failed, pending,
        cost_estimate: Math.round(sent * COST_PER_MESSAGE_TRY * 100) / 100,
        cost_note: `Tahmini — ${COST_PER_MESSAGE_TRY} ₺/mesaj varsayımıyla, yalnız gerçek gönderimler`,
      },
      top_agency: top ? { id: top[0], name: agencyNames.get(top[0]) ?? "—", count: top[1] } : null,
      messages: (lastRes.data ?? []).map((m: { agency_id: string } & Record<string, unknown>) => ({
        ...m,
        agency_name: agencyNames.get(m.agency_id) ?? "—",
      })),
    });
  } catch (err) {
    console.error("[api/admin/whatsapp]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
