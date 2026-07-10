/**
 * GET /api/today — "Bugün ne yapmalıyım?" verisi (dashboard Bugün şeridi).
 *
 * Üç aksiyon kovası + kural-tabanlı Sabah Brifingi cümlesi:
 *   • renewals : 7 gün içinde biten / geciken aktif poliçeler (yenileme bekleyen)
 *   • followups: takip tarihi bugün/geçmiş olan AÇIK satış fırsatları
 *   • leads    : son 48 saatin "Yeni Lead" fırsatları
 * Scope: yönetici acente geneli; diğerleri kendi kayıtları.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

const OPEN_STAGES = ["Yeni Lead", "İletişime Geçildi", "Teklif Hazırlanıyor", "Takip Ediliyor"];

function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });
    const agencyId = caller.agencyId;
    if (!agencyId) return NextResponse.json({ renewals: [], followups: [], leads: [], briefing: "" });

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    const today = istToday();
    const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const ago48 = new Date(Date.now() - 48 * 3600e3).toISOString();

    // ── Yenilemeler: aktif + 7 gün içinde bitiyor veya gecikti (60 güne kadar) ─
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renQ = (admin.from("policies") as any)
      .select("id, policy_type, end_date, customer_id, customers(name, phone)")
      .eq("agency_id", agencyId).eq("status", "Aktif")
      .neq("renewal_status", "completed")
      .lte("end_date", in7)
      .gte("end_date", new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10))
      .order("end_date").limit(6);
    if (!managerial) renQ = renQ.eq("created_by", caller.userId);

    // ── Takipler: açık fırsat + takip tarihi bugün/geçmiş ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let folQ = (admin.from("requests") as any)
      .select("id, request_type, status, next_follow_up_date, customers(name)")
      .eq("agency_id", agencyId).in("status", OPEN_STAGES)
      .not("next_follow_up_date", "is", null)
      .lte("next_follow_up_date", today)
      .order("next_follow_up_date").limit(6);
    if (!managerial) folQ = folQ.eq("assigned_to", caller.userId);

    // ── Yeni lead'ler: son 48 saat ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let leadQ = (admin.from("requests") as any)
      .select("id, request_type, created_at, customers(name)")
      .eq("agency_id", agencyId).eq("status", "Yeni Lead")
      .gte("created_at", ago48)
      .order("created_at", { ascending: false }).limit(6);
    if (!managerial) leadQ = leadQ.eq("assigned_to", caller.userId);

    // ── Görüşme aksiyonları: vadesi bugün/geçmiş, tamamlanmamış (IRM) ─────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let actQ = (admin.from("customer_interactions") as any)
      .select("id, next_action, next_action_date, customer_id, customers(name)")
      .eq("agency_id", agencyId)
      .not("next_action", "is", null)
      .eq("next_action_done", false)
      .not("next_action_date", "is", null)
      .lte("next_action_date", today)
      .order("next_action_date").limit(6);
    if (!managerial) actQ = actQ.eq("staff_id", caller.userId);

    // ── Görevler: vadesi bugün/geçmiş açık görevler ───────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let taskQ = (admin.from("tasks") as any)
      .select("id, title, due_date, customer_id, customers(name)")
      .eq("agency_id", agencyId).eq("status", "open")
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date").limit(6);
    if (!managerial) taskQ = taskQ.eq("assigned_to", caller.userId);

    const [ren, fol, led, act, tsk] = await Promise.all([renQ, folQ, leadQ, actQ, taskQ]);
    const renewals = ren.data ?? [], followups = fol.data ?? [], leads = led.data ?? [];
    const actions = act.error ? [] : (act.data ?? []); // migration öncesi kırılma yok
    const tasks = tsk.error ? [] : (tsk.data ?? []);

    // ── Sabah Brifingi (kural-tabanlı, gerçek sayılar) ───────────────────────
    const parts: string[] = [];
    if (renewals.length) parts.push(`${renewals.length} poliçe yenileme bekliyor`);
    if (followups.length) parts.push(`${followups.length} fırsatın takip zamanı geldi`);
    if (actions.length) parts.push(`${actions.length} görüşme aksiyonu seni bekliyor`);
    if (tasks.length) parts.push(`${tasks.length} görevin vadesi geldi`);
    if (leads.length) parts.push(`${leads.length} yeni lead yanıt bekliyor`);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }).format(new Date()));
    const selam = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
    const briefing = parts.length
      ? `${selam}! Bugün ${parts.join(", ")}.`
      : `${selam}! Bugün için bekleyen acil işiniz yok — pipeline'a yeni fırsat eklemek için iyi bir gün. ✨`;

    return NextResponse.json({ renewals, followups, leads, actions, tasks, briefing, today });
  } catch (err) {
    console.error("[api/today]", err);
    return NextResponse.json({ renewals: [], followups: [], leads: [], actions: [], tasks: [], briefing: "" });
  }
}
