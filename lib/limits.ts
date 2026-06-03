/**
 * lib/limits.ts
 * SaaS limit-checking helpers.
 *
 * All functions accept any Supabase-compatible client so they can be used:
 *  - Server-side API routes → pass getSupabaseAdmin()
 *  - Client-side pre-checks  → pass the browser supabase client
 *
 * Shape returned by every check:
 *  { ok: boolean; current: number; max: number; isActive: boolean }
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type LimitResult = {
  ok: boolean;
  current: number;
  max: number;
  isActive: boolean;
  reason?: string;
};

export type AgencyLimits = {
  id: string;
  is_active: boolean;
  plan: string;
  max_users: number;
  max_customers: number;
  max_requests: number;
  max_policies: number;
};

// ─── Fetch agency limits ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAgencyLimits(client: any, agencyId: string): Promise<AgencyLimits | null> {
  const { data } = await client
    .from("agencies")
    .select("id, is_active, plan, max_users, max_customers, max_requests, max_policies")
    .eq("id", agencyId)
    .maybeSingle();

  if (!data) return null;

  return {
    id:             data.id,
    is_active:      data.is_active      ?? true,
    plan:           data.plan           ?? "starter",
    max_users:      data.max_users      ?? 10,
    max_customers:  data.max_customers  ?? 100,
    max_requests:   data.max_requests   ?? 100,
    max_policies:   data.max_policies   ?? 100,
  };
}

// ─── Generic count helper ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countRows(client: any, table: string, agencyId: string): Promise<number> {
  const { count } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId);
  return count ?? 0;
}

// ─── canAdd* ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canAddCustomer(client: any, agencyId: string): Promise<LimitResult> {
  const limits = await getAgencyLimits(client, agencyId);
  if (!limits) return { ok: false, current: 0, max: 0, isActive: false, reason: "agency_not_found" };
  if (!limits.is_active) return { ok: false, current: 0, max: limits.max_customers, isActive: false, reason: "inactive" };
  const current = await countRows(client, "customers", agencyId);
  return { ok: current < limits.max_customers, current, max: limits.max_customers, isActive: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canAddRequest(client: any, agencyId: string): Promise<LimitResult> {
  const limits = await getAgencyLimits(client, agencyId);
  if (!limits) return { ok: false, current: 0, max: 0, isActive: false, reason: "agency_not_found" };
  if (!limits.is_active) return { ok: false, current: 0, max: limits.max_requests, isActive: false, reason: "inactive" };
  const current = await countRows(client, "requests", agencyId);
  return { ok: current < limits.max_requests, current, max: limits.max_requests, isActive: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canAddPolicy(client: any, agencyId: string): Promise<LimitResult> {
  const limits = await getAgencyLimits(client, agencyId);
  if (!limits) return { ok: false, current: 0, max: 0, isActive: false, reason: "agency_not_found" };
  if (!limits.is_active) return { ok: false, current: 0, max: limits.max_policies, isActive: false, reason: "inactive" };
  const current = await countRows(client, "policies", agencyId);
  return { ok: current < limits.max_policies, current, max: limits.max_policies, isActive: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canAddUser(client: any, agencyId: string): Promise<LimitResult> {
  const limits = await getAgencyLimits(client, agencyId);
  if (!limits) return { ok: false, current: 0, max: 0, isActive: false, reason: "agency_not_found" };
  if (!limits.is_active) return { ok: false, current: 0, max: limits.max_users, isActive: false, reason: "inactive" };
  const current = await countRows(client, "profiles", agencyId);
  return { ok: current < limits.max_users, current, max: limits.max_users, isActive: true };
}

// ─── User-friendly error messages ────────────────────────────────────────────
export function limitMessage(entity: "customer" | "request" | "policy" | "user"): string {
  const map: Record<string, string> = {
    customer: "Bu acente müşteri limitine ulaşmıştır. Lütfen acente yetkilisiyle iletişime geçin.",
    request:  "Bu acente teklif limitine ulaşmıştır. Lütfen acente yetkilisiyle iletişime geçin.",
    policy:   "Bu acente poliçe limitine ulaşmıştır. Lütfen acente yetkilisiyle iletişime geçin.",
    user:     "Paket kullanıcı limitine ulaşıldı. Daha fazla üye eklemek için planınızı yükseltin.",
  };
  return map[entity] ?? "Bu işlem için limitinize ulaşıldı.";
}

export const INACTIVE_MESSAGE = "Bu acente şu anda teklif kabul etmiyor. Lütfen daha sonra tekrar deneyin.";
