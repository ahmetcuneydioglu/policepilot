/**
 * Acente kişi-bazlı performans hesabı — TEK kaynak.
 * Hem super_admin (admin/agencies/[id]/performance) hem acente owner/manager
 * (/api/team/performance) bu fonksiyonu kullanır.
 *
 * created_by izleri (customers/quote_runs/policies) + activity_log (son aktivite)
 * + profiles.last_login_at üzerinden her personel için metrikleri toplar.
 * Faz 1 öncesi created_by NULL kayıtlar "unattributed" sayılır (UI'da gösterilmez).
 */

import { agencyRoleLabel } from "@/lib/permissions";

const TR = "+03:00"; // TR sabit (DST yok)

function istMonthStartIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01T00:00:00${TR}`;
}

function last7Days(): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 864e5)));
  return out;
}

function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export type UserPerf = {
  id: string;
  name: string;
  role_label: string;
  agency_role: string | null;  // ham rol — owner'ı sıralamadan ayırmak için
  customers: number;
  quotes_total: number;
  quotes_month: number;
  quotes_won: number;
  policies_total: number;
  policies_month: number;
  total_premium: number;
  total_commission: number;
  conversion: number;          // kazanılan/toplam teklif (%)
  interactions_total: number;  // IRM: manuel görüşme sayısı (staff_id)
  interactions_month: number;
  visits_total: number;        // yüz yüze görüşme (saha ziyareti)
  opportunities_total: number; // sorumlu olduğu satış fırsatı (requests.assigned_to)
  opportunities_won: number;   // Kazanıldı aşamasındaki fırsat
  opp_conversion: number;      // kazanılan/toplam fırsat (%)
  score: number;               // 0-100 performans skoru (çalışanlar arası normalize)
  last_activity: string | null;
  last_login: string | null;
};

export type AgencyPerformance = {
  users: UserPerf[];
  leaders: {
    most_active: UserPerf | null;
    top_interactions: UserPerf | null; // en çok görüşme yapan
    top_visits: UserPerf | null;       // en çok ziyaret yapan (yüz yüze)
    top_quotes: UserPerf | null;
    top_policies: UserPerf | null;
    top_premium: UserPerf | null;
    top_conversion: UserPerf | null;
  };
  last7: { date: string; count: number }[];
  team: {
    total_customers: number;
    total_interactions: number; // IRM: acente geneli manuel görüşme
    total_quotes: number;
    total_policies: number;
    total_premium: number;
    total_commission: number;
    conversion: number;        // acente geneli kazanılan/toplam teklif (%)
    avg_conversion: number;    // çalışan başına dönüşüm ortalaması (kıyas için)
  };
  unattributed: number;        // created_by NULL (Faz 1 öncesi) müşteri sayısı
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeAgencyPerformance(admin: any, agencyId: string): Promise<AgencyPerformance> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (table: string) => admin.from(table) as any;
  const monthStart = istMonthStartIso();

  const [profRes, custRes, runRes, polRes, actRes, reqRes, intRes] = await Promise.all([
    t("profiles").select("id, full_name, agency_role, last_login_at").eq("agency_id", agencyId),
    t("customers").select("created_by").eq("agency_id", agencyId),
    t("quote_runs").select("created_by, status, created_at").eq("agency_id", agencyId),
    t("policies").select("created_by, premium, commission, status, created_at").eq("agency_id", agencyId),
    t("activity_log").select("actor_id, created_at").eq("agency_id", agencyId).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    t("requests").select("assigned_to, status").eq("agency_id", agencyId),
    t("customer_interactions").select("staff_id, channel, occurred_at").eq("agency_id", agencyId).eq("kind", "manual"),
  ]);

  const users = new Map<string, UserPerf>();
  for (const p of (profRes.data ?? []) as { id: string; full_name: string | null; agency_role: string | null; last_login_at: string | null }[]) {
    users.set(p.id, {
      id: p.id,
      name: p.full_name ?? "İsimsiz",
      role_label: agencyRoleLabel(p.agency_role),
      agency_role: p.agency_role,
      customers: 0, quotes_total: 0, quotes_month: 0, quotes_won: 0,
      policies_total: 0, policies_month: 0, total_premium: 0, total_commission: 0,
      conversion: 0, opportunities_total: 0, opportunities_won: 0, opp_conversion: 0,
      interactions_total: 0, interactions_month: 0, visits_total: 0,
      score: 0, last_activity: null, last_login: p.last_login_at ?? null,
    });
  }
  const ensure = (uid: string | null): UserPerf | null => (uid && users.has(uid) ? users.get(uid)! : null);

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
  for (const p of (polRes.data ?? []) as { created_by: string | null; premium: number | null; commission: number | null; created_at: string }[]) {
    const u = ensure(p.created_by);
    if (!u) continue;
    u.policies_total++;
    if (p.created_at >= monthStart) u.policies_month++;
    u.total_premium += p.premium ?? 0;
    u.total_commission += p.commission ?? 0;
  }
  for (const a of (actRes.data ?? []) as { actor_id: string | null; created_at: string }[]) {
    const u = ensure(a.actor_id);
    if (!u) continue;
    if (!u.last_activity || a.created_at > u.last_activity) u.last_activity = a.created_at;
  }
  // Satış fırsatları — SORUMLU personele (assigned_to) atfedilir
  for (const r of (reqRes.data ?? []) as { assigned_to: string | null; status: string }[]) {
    const u = ensure(r.assigned_to);
    if (!u) continue;
    u.opportunities_total++;
    if (r.status === "Kazanıldı") u.opportunities_won++;
  }
  // IRM görüşmeleri — görüşen personele (staff_id) atfedilir
  for (const it of (intRes.data ?? []) as { staff_id: string | null; channel: string | null; occurred_at: string }[]) {
    const u = ensure(it.staff_id);
    if (!u) continue;
    u.interactions_total++;
    if (it.occurred_at >= monthStart) u.interactions_month++;
    if (it.channel === "face_to_face") u.visits_total++;
  }
  for (const u of users.values()) {
    u.conversion = u.quotes_total > 0 ? Math.round((u.quotes_won / u.quotes_total) * 100) : 0;
    u.opp_conversion = u.opportunities_total > 0 ? Math.round((u.opportunities_won / u.opportunities_total) * 100) : 0;
  }

  const list = [...users.values()];
  const topBy = (key: keyof UserPerf) =>
    [...list].filter((u) => (u[key] as number) > 0).sort((a, b) => (b[key] as number) - (a[key] as number))[0] ?? null;

  const leaders = {
    most_active:    [...list].filter((u) => u.last_activity).sort((a, b) => (a.last_activity! < b.last_activity! ? 1 : -1))[0] ?? null,
    top_interactions: topBy("interactions_total"),
    top_visits:       topBy("visits_total"),
    top_quotes:     topBy("quotes_total"),
    top_policies:   topBy("policies_total"),
    top_premium:    topBy("total_premium"),
    top_conversion: [...list].filter((u) => u.quotes_total >= 2).sort((a, b) => b.conversion - a.conversion)[0] ?? null,
  };

  // Son 7 gün aktivite serisi (acente geneli)
  const days = last7Days();
  const dayCounts = new Map<string, number>(days.map((d) => [d, 0]));
  for (const a of (actRes.data ?? []) as { created_at: string }[]) {
    const k = istDateKey(a.created_at);
    if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }
  const last7 = days.map((d) => ({ date: d, count: dayCounts.get(d) ?? 0 }));

  // Performans skoru (0-100) — yalnız ÇALIŞANLAR (owner hariç) arasında normalize.
  // Üretim (prim+poliçe), verimlilik (dönüşüm), pipeline (müşteri) ve güncellik karışımı.
  const rankable = list.filter((u) => u.agency_role !== "owner");
  const maxPrem = Math.max(1, ...rankable.map((u) => u.total_premium));
  const maxPol  = Math.max(1, ...rankable.map((u) => u.policies_total));
  const maxCust = Math.max(1, ...rankable.map((u) => u.customers));
  for (const u of list) {
    const premN = (u.total_premium / maxPrem) * 100;
    const polN  = (u.policies_total / maxPol) * 100;
    const custN = (u.customers / maxCust) * 100;
    const days  = u.last_activity ? Math.floor((Date.now() - new Date(u.last_activity).getTime()) / 864e5) : 999;
    const fresh = Math.max(0, 100 - days * 8);
    u.score = Math.max(0, Math.min(100, Math.round(0.30 * premN + 0.25 * polN + 0.20 * u.conversion + 0.15 * custN + 0.10 * fresh)));
  }

  // Ekip toplamları — GERÇEK acente geneli (atıf fark etmez; owner üretimi + eski kayıtlar dahil)
  const runs = (runRes.data ?? []) as { status: string }[];
  const pols = (polRes.data ?? []) as { premium: number | null; commission: number | null }[];
  const teamWon = runs.filter((r) => r.status === "Kazanıldı").length;
  const withQuotes = list.filter((u) => u.quotes_total >= 2);
  const team = {
    total_customers: (custRes.data ?? []).length,
    total_interactions: (intRes.data ?? []).length,
    total_quotes: runs.length,
    total_policies: pols.length,
    total_premium: pols.reduce((s, p) => s + (p.premium ?? 0), 0),
    total_commission: pols.reduce((s, p) => s + (p.commission ?? 0), 0),
    conversion: runs.length ? Math.round((teamWon / runs.length) * 100) : 0,
    avg_conversion: withQuotes.length ? Math.round(withQuotes.reduce((s, u) => s + u.conversion, 0) / withQuotes.length) : 0,
  };

  return { users: list, leaders, last7, team, unattributed };
}
