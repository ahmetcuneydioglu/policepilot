import "server-only";

/**
 * Takip Motoru — günün takip özeti (sabah cron'una zincirlenir).
 *
 * Üç kaynaktan vadesi bugün/geçmiş açık takipleri toplar:
 *   • customer_interactions.next_action_date (görüşme "Sonraki Aksiyon", done=false)
 *   • requests.next_follow_up_date (açık fırsat takipleri)
 *   • tasks.due_date (açık görevler)
 *
 * Çıktı (acente başına, günde bir):
 *   • Zil bildirimi (notifications) — acente geneli özet, /gorevler-eşleniği dashboard'a link
 *   • Kişiye özel push (notifyUser) — kaydın sahibine kendi listesi
 *     (görüşme → staff_id, fırsat/görev → assigned_to; sahipsizler yalnız zil özetinde)
 *
 * Dedup: notifications'ta type='followup' + bugün kaydı varsa acente atlanır
 * (cron günde bir koşar; tekrar tetiklenirse ikinci gönderim olmaz).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyUser } from "@/lib/push/notify";
import { nextActionMeta } from "@/lib/interactionTypes";

const OPEN_STAGES = ["Yeni Lead", "İletişime Geçildi", "Teklif Hazırlanıyor", "Takip Ediliyor"];
const MAX_PUSH_SAMPLES = 3;

type Item = { agencyId: string; userId: string | null; label: string };

function trToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export type FollowupDigestResult = {
  agencies: number;   // özet üretilen acente
  bells: number;      // yazılan zil bildirimi
  pushes: number;     // gönderilen kişisel push
  skipped: number;    // bugün zaten üretilmiş (dedup)
};

export async function runFollowupDigest(): Promise<FollowupDigestResult> {
  const admin = getSupabaseAdmin();
  const today = trToday();
  const todayStartTs = `${today}T00:00:00+03:00`;

  const [intRes, reqRes, taskRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("customer_interactions") as any)
      .select("agency_id, staff_id, next_action, customers(name)")
      .not("next_action", "is", null)
      .eq("next_action_done", false)
      .not("next_action_date", "is", null)
      .lte("next_action_date", today)
      .limit(500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("requests") as any)
      .select("agency_id, assigned_to, request_type, customers(name)")
      .in("status", OPEN_STAGES)
      .not("next_follow_up_date", "is", null)
      .lte("next_follow_up_date", today)
      .limit(500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("tasks") as any)
      .select("agency_id, assigned_to, title")
      .eq("status", "open")
      .not("due_date", "is", null)
      .lte("due_date", today)
      .limit(500),
  ]);

  const items: Item[] = [];
  const counts = { actions: 0, followups: 0, tasks: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (intRes.data ?? []) as any[]) {
    if (!r.agency_id) continue;
    counts.actions++;
    const action = nextActionMeta(r.next_action)?.label ?? "Takip";
    items.push({ agencyId: r.agency_id, userId: r.staff_id ?? null, label: `${r.customers?.name ?? "Müşteri"} (${action})` });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (reqRes.data ?? []) as any[]) {
    if (!r.agency_id) continue;
    counts.followups++;
    items.push({ agencyId: r.agency_id, userId: r.assigned_to ?? null, label: `${r.customers?.name ?? "Müşteri"} (${r.request_type} takibi)` });
  }
  // tasks tablosu migration öncesi olmayabilir — hata görmezden gelinir
  if (!taskRes.error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (taskRes.data ?? []) as any[]) {
      if (!r.agency_id) continue;
      counts.tasks++;
      items.push({ agencyId: r.agency_id, userId: r.assigned_to ?? null, label: String(r.title ?? "Görev") });
    }
  }

  const result: FollowupDigestResult = { agencies: 0, bells: 0, pushes: 0, skipped: 0 };
  if (items.length === 0) return result;

  // Acente → kişi gruplaması
  const byAgency = new Map<string, Map<string | null, string[]>>();
  for (const it of items) {
    const users = byAgency.get(it.agencyId) ?? new Map<string | null, string[]>();
    const list = users.get(it.userId) ?? [];
    list.push(it.label);
    users.set(it.userId, list);
    byAgency.set(it.agencyId, users);
  }

  for (const [agencyId, users] of byAgency) {
    // Dedup: bugün bu acente için üretildiyse atla
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin.from("notifications") as any)
      .select("id").eq("agency_id", agencyId).eq("type", "followup")
      .gte("created_at", todayStartTs).limit(1);
    if ((existing ?? []).length > 0) { result.skipped++; continue; }

    const total = [...users.values()].reduce((n, l) => n + l.length, 0);
    result.agencies++;

    // ── Zil: acente geneli günlük özet ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: bellErr } = await (admin.from("notifications") as any).insert({
      agency_id: agencyId,
      type: "followup",
      title: `📞 Günün takipleri (${total})`,
      body: `Bugün vadesi gelen ${total} takip var. Görevler ekranından tek tek tamamlayabilirsiniz.`,
      link: "/dashboard",
    });
    if (!bellErr) result.bells++;

    // ── Kişiye özel push: herkes yalnız KENDİ listesini alır ───────────────
    for (const [userId, labels] of users) {
      if (!userId) continue; // sahipsiz kayıtlar zil özetinde
      const sample = labels.slice(0, MAX_PUSH_SAMPLES).join(" · ");
      const more = labels.length > MAX_PUSH_SAMPLES ? ` +${labels.length - MAX_PUSH_SAMPLES} daha` : "";
      await notifyUser(userId, {
        title: `📞 Bugün ${labels.length} takibin var`,
        body: sample + more,
        data: { screen: "gorevler" },
      });
      result.pushes++;
    }
  }

  return result;
}
