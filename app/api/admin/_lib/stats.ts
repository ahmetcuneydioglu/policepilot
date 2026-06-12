/**
 * Platform geneli ham veri toplama + acente bazlı agregasyon.
 * /api/admin/* endpoint'lerinin ortak veri katmanı — tek yerden, paralel,
 * service role ile çekilir; agregasyon JS'te yapılır.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { planMonthlyRevenue } from "@/lib/planPricing";

export type AgencyRow = {
  id: string; name: string; slug: string; logo_url: string | null;
  phone: string | null; is_active: boolean; plan: string;
  expires_at: string | null; created_at: string;
  max_users: number; max_customers: number; max_requests: number; max_policies: number;
};

export type AgencyStats = {
  agency: AgencyRow;
  users: number;
  customers: number;
  quotes: number;
  policies: number;
  active_policies: number;
  whatsapp_total: number;
  whatsapp_today: number;
  total_premium: number;
  monthly_revenue: number;
  last_activity: string | null;
  /** Limit kullanım oranlarının en yükseği (0-1+) */
  max_limit_usage: number;
};

export type PlatformData = {
  agencies: AgencyRow[];
  perAgency: AgencyStats[];
  totals: {
    agencies: number; active_agencies: number; users: number; customers: number;
    quotes: number; policies: number; whatsapp_today: number; whatsapp_total: number;
    monthly_revenue: number; new_agencies_this_month: number;
    conversion_rate: number; // poliçeleşen teklif oranı (%)
  };
  raw: {
    quoteRuns: { agency_id: string | null; status: string; created_at: string }[];
    policies:  { agency_id: string | null; status: string; premium: number | null; created_at: string; issued_at: string | null }[];
    whatsapp:  { agency_id: string; status: string; created_at: string; sent_at: string | null }[];
    customers: { agency_id: string | null; created_at: string }[];
    profiles:  { agency_id: string | null; role: string; created_at: string }[];
  };
};

function trDay(d: Date | string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

export async function collectPlatformData(): Promise<PlatformData> {
  const admin = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (table: string, select: string) => (admin.from(table) as any).select(select);

  const [agRes, profRes, custRes, runRes, polRes, waRes] = await Promise.all([
    q("agencies", "id, name, slug, logo_url, phone, is_active, plan, expires_at, created_at, max_users, max_customers, max_requests, max_policies"),
    q("profiles", "agency_id, role, created_at"),
    q("customers", "agency_id, created_at"),
    q("quote_runs", "agency_id, status, created_at"),
    q("policies", "agency_id, status, premium, created_at, issued_at"),
    q("whatsapp_queue", "agency_id, status, created_at, sent_at"),
  ]);

  const agencies  = (agRes.data ?? []) as AgencyRow[];
  const profiles  = profRes.data ?? [];
  const customers = custRes.data ?? [];
  const quoteRuns = runRes.data ?? [];
  const policies  = polRes.data ?? [];
  const whatsapp  = waRes.data ?? [];

  const today = trDay(new Date())!;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const countBy = (rows: { agency_id?: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.agency_id) m.set(r.agency_id, (m.get(r.agency_id) ?? 0) + 1);
    return m;
  };

  const userC  = countBy(profiles);
  const custC  = countBy(customers);
  const quoteC = countBy(quoteRuns);
  const polC   = countBy(policies);

  const perAgency: AgencyStats[] = agencies.map((a) => {
    const agPolicies = policies.filter((p: { agency_id: string | null }) => p.agency_id === a.id);
    const agWa       = whatsapp.filter((w: { agency_id: string }) => w.agency_id === a.id);
    const activities = [
      ...customers.filter((c: { agency_id: string | null }) => c.agency_id === a.id),
      ...quoteRuns.filter((r: { agency_id: string | null }) => r.agency_id === a.id),
      ...agPolicies, ...agWa,
    ].map((x: { created_at: string }) => x.created_at);
    const lastActivity = activities.length ? activities.sort().at(-1)! : null;

    const usage = Math.max(
      a.max_users     ? (userC.get(a.id)  ?? 0) / a.max_users     : 0,
      a.max_customers ? (custC.get(a.id)  ?? 0) / a.max_customers : 0,
      a.max_requests  ? (quoteC.get(a.id) ?? 0) / a.max_requests  : 0,
      a.max_policies  ? (polC.get(a.id)   ?? 0) / a.max_policies  : 0,
    );

    return {
      agency: a,
      users:           userC.get(a.id)  ?? 0,
      customers:       custC.get(a.id)  ?? 0,
      quotes:          quoteC.get(a.id) ?? 0,
      policies:        polC.get(a.id)   ?? 0,
      active_policies: agPolicies.filter((p: { status: string }) => p.status === "Aktif").length,
      whatsapp_total:  agWa.length,
      whatsapp_today:  agWa.filter((w: { sent_at: string | null; created_at: string }) => trDay(w.sent_at ?? w.created_at) === today).length,
      total_premium:   agPolicies.reduce((s: number, p: { premium: number | null }) => s + (p.premium ?? 0), 0),
      monthly_revenue: a.is_active ? planMonthlyRevenue(a.plan) : 0,
      last_activity:   lastActivity,
      max_limit_usage: usage,
    };
  });

  const issuedQuotes = quoteRuns.filter((r: { status: string }) => r.status === "Kazanıldı").length;

  return {
    agencies,
    perAgency,
    totals: {
      agencies:        agencies.length,
      active_agencies: agencies.filter(a => a.is_active).length,
      users:           profiles.length,
      customers:       customers.length,
      quotes:          quoteRuns.length,
      policies:        policies.length,
      whatsapp_today:  whatsapp.filter((w: { sent_at: string | null; created_at: string }) => trDay(w.sent_at ?? w.created_at) === today).length,
      whatsapp_total:  whatsapp.length,
      monthly_revenue: perAgency.reduce((s, a) => s + a.monthly_revenue, 0),
      new_agencies_this_month: agencies.filter(a => new Date(a.created_at) >= monthStart).length,
      conversion_rate: quoteRuns.length > 0 ? Math.round((issuedQuotes / quoteRuns.length) * 1000) / 10 : 0,
    },
    raw: { quoteRuns, policies, whatsapp, customers, profiles },
  };
}
