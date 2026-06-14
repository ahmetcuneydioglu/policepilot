/**
 * GET /api/admin/agencies/[id]/performance — kişi bazlı performans (yalnız super_admin)
 *
 * created_by izleri + activity_log üzerinden her personel için:
 *   müşteri, bu ay teklif, bu ay poliçe, toplam prim, dönüşüm, son aktivite.
 * Acente liderlik tabloları + son 7 gün aktivite serisi.
 *
 * Faz 1'de created_by yoktu → o tarihten önceki kayıtlar "atfedilemez"
 * (created_by NULL) olarak gruplanır ve UI'da gösterilmez.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { agencyRoleLabel } from "@/lib/permissions";
import { requireSuperAdmin } from "../../../_lib/auth";

// TR sabit +03:00 (DST yok) — ay/gün sınırları için
const TR = "+03:00";

function istMonthStartIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01T00:00:00${TR}`;
}

/** Son 7 günün (bugün dahil) Istanbul tarih anahtarları: ["2026-06-08", ...] */
function last7Days(): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    out.push(fmt.format(d));
  }
  return out;
}

function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const admin = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (table: string) => admin.from(table) as any;

    const monthStart = istMonthStartIso();

    const [profRes, custRes, runRes, polRes, actRes] = await Promise.all([
      t("profiles").select("id, full_name, agency_role").eq("agency_id", id),
      t("customers").select("created_by").eq("agency_id", id),
      t("quote_runs").select("created_by, status, created_at").eq("agency_id", id),
      t("policies").select("created_by, premium, status, created_at").eq("agency_id", id),
      t("activity_log").select("actor_id, created_at").eq("agency_id", id).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    ]);

    type UserAgg = {
      id: string;
      name: string;
      role_label: string;
      customers: number;
      quotes_total: number;
      quotes_month: number;
      quotes_won: number;
      policies_total: number;
      policies_month: number;
      total_premium: number;
      conversion: number;
      last_activity: string | null;
    };

    const users = new Map<string, UserAgg>();
    for (const p of (profRes.data ?? []) as { id: string; full_name: string | null; agency_role: string | null }[]) {
      users.set(p.id, {
        id: p.id,
        name: p.full_name ?? "İsimsiz",
        role_label: agencyRoleLabel(p.agency_role),
        customers: 0, quotes_total: 0, quotes_month: 0, quotes_won: 0,
        policies_total: 0, policies_month: 0, total_premium: 0,
        conversion: 0, last_activity: null,
      });
    }
    const ensure = (uid: string | null): UserAgg | null => (uid && users.has(uid) ? users.get(uid)! : null);

    let unattributed = 0;

    for (const c of (custRes.data ?? []) as { created_by: string | null }[]) {
      const u = ensure(c.created_by);
      if (u) u.customers++; else unattributed++;
    }

    for (const r of (runRes.data ?? []) as { created_by: string | null; status: string; created_at: string }[]) {
      const u = ensure(r.created_by);
      if (!u) continue;
      u.quotes_total++;
      if (r.created_at >= monthStart) u.quotes_month++;
      if (r.status === "Kazanıldı") u.quotes_won++;
    }

    for (const p of (polRes.data ?? []) as { created_by: string | null; premium: number | null; status: string; created_at: string }[]) {
      const u = ensure(p.created_by);
      if (!u) continue;
      u.policies_total++;
      if (p.created_at >= monthStart) u.policies_month++;
      u.total_premium += p.premium ?? 0;
    }

    // Son aktivite: activity_log'tan en güncel
    for (const a of (actRes.data ?? []) as { actor_id: string | null; created_at: string }[]) {
      const u = ensure(a.actor_id);
      if (!u) continue;
      if (!u.last_activity || a.created_at > u.last_activity) u.last_activity = a.created_at;
    }

    // Dönüşüm oranı
    for (const u of users.values()) {
      u.conversion = u.quotes_total > 0 ? Math.round((u.quotes_won / u.quotes_total) * 100) : 0;
    }

    const list = [...users.values()];

    // ── Liderlik tabloları (yalnız ilgili metriği > 0 olanlar) ────────────────
    const topBy = (key: keyof UserAgg) =>
      [...list].filter((u) => (u[key] as number) > 0).sort((a, b) => (b[key] as number) - (a[key] as number))[0] ?? null;

    const leaders = {
      most_active:    [...list].filter(u => u.last_activity).sort((a, b) => (a.last_activity! < b.last_activity! ? 1 : -1))[0] ?? null,
      top_quotes:     topBy("quotes_total"),
      top_policies:   topBy("policies_total"),
      top_premium:    topBy("total_premium"),
      top_conversion: [...list].filter(u => u.quotes_total >= 2).sort((a, b) => b.conversion - a.conversion)[0] ?? null,
    };

    // ── Son 7 gün aktivite serisi (acente geneli) ─────────────────────────────
    const days = last7Days();
    const dayCounts = new Map<string, number>(days.map((d) => [d, 0]));
    for (const a of (actRes.data ?? []) as { created_at: string }[]) {
      const k = istDateKey(a.created_at);
      if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
    }
    const last7 = days.map((d) => ({ date: d, count: dayCounts.get(d) ?? 0 }));

    return NextResponse.json({
      users: list,
      leaders,
      last7,
      unattributed, // created_by NULL (Faz 1 öncesi) müşteri sayısı — bilgi amaçlı
    });
  } catch (err) {
    console.error("[api/admin/agencies/[id]/performance]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
