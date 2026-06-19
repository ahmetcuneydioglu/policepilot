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
  customers: number;
  quotes_total: number;
  quotes_month: number;
  quotes_won: number;
  policies_total: number;
  policies_month: number;
  total_premium: number;
  total_commission: number;
  conversion: number;          // kazanılan/toplam teklif (%)
  last_activity: string | null;
  last_login: string | null;
};

export type AgencyPerformance = {
  users: UserPerf[];
  leaders: {
    most_active: UserPerf | null;
    top_quotes: UserPerf | null;
    top_policies: UserPerf | null;
    top_premium: UserPerf | null;
    top_conversion: UserPerf | null;
  };
  last7: { date: string; count: number }[];
  team: { avg_conversion: number; total_premium: number; total_policies: number; total_commission: number };
  unattributed: number;        // created_by NULL (Faz 1 öncesi) müşteri sayısı
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeAgencyPerformance(admin: any, agencyId: string): Promise<AgencyPerformance> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (table: string) => admin.from(table) as any;
  const monthStart = istMonthStartIso();

  const [profRes, custRes, runRes, polRes, actRes] = await Promise.all([
    t("profiles").select("id, full_name, agency_role, last_login_at").eq("agency_id", agencyId),
    t("customers").select("created_by").eq("agency_id", agencyId),
    t("quote_runs").select("created_by, status, created_at").eq("agency_id", agencyId),
    t("policies").select("created_by, premium, commission, status, created_at").eq("agency_id", agencyId),
    t("activity_log").select("actor_id, created_at").eq("agency_id", agencyId).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);

  const users = new Map<string, UserPerf>();
  for (const p of (profRes.data ?? []) as { id: string; full_name: string | null; agency_role: string | null; last_login_at: string | null }[]) {
    users.set(p.id, {
      id: p.id,
      name: p.full_name ?? "İsimsiz",
      role_label: agencyRoleLabel(p.agency_role),
      customers: 0, quotes_total: 0, quotes_month: 0, quotes_won: 0,
      policies_total: 0, policies_month: 0, total_premium: 0, total_commission: 0,
      conversion: 0, last_activity: null, last_login: p.last_login_at ?? null,
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
  for (const u of users.values()) {
    u.conversion = u.quotes_total > 0 ? Math.round((u.quotes_won / u.quotes_total) * 100) : 0;
  }

  const list = [...users.values()];
  const topBy = (key: keyof UserPerf) =>
    [...list].filter((u) => (u[key] as number) > 0).sort((a, b) => (b[key] as number) - (a[key] as number))[0] ?? null;

  const leaders = {
    most_active:    [...list].filter((u) => u.last_activity).sort((a, b) => (a.last_activity! < b.last_activity! ? 1 : -1))[0] ?? null,
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

  // Ekip ortalamaları (kıyas için)
  const withQuotes = list.filter((u) => u.quotes_total >= 2);
  const team = {
    avg_conversion: withQuotes.length ? Math.round(withQuotes.reduce((s, u) => s + u.conversion, 0) / withQuotes.length) : 0,
    total_premium: list.reduce((s, u) => s + u.total_premium, 0),
    total_policies: list.reduce((s, u) => s + u.policies_total, 0),
    total_commission: list.reduce((s, u) => s + u.total_commission, 0),
  };

  return { users: list, leaders, last7, team, unattributed };
}
