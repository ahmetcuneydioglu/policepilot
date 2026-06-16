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

import { getEffectiveLimits } from "@/lib/billing/resolver";
import type { MetricKey } from "@/lib/billing/types";

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
    max_users:      data.max_users      ?? 20,
    max_customers:  data.max_customers  ?? 20,
    max_requests:   data.max_requests   ?? 20,
    max_policies:   data.max_policies   ?? 20,
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
// Etkin limit motoruna (lib/billing) bağlanır: plan tabanı + acente override +
// aktif eklentiler + süre kapısı. LimitResult şekli KORUNUR → çağrı yerleri dokunulmaz.
// Metrik eşleşmesi: customer→customers, request→requests (DEĞİŞMEZ), policy→policies, user→users.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkLimit(client: any, agencyId: string, metric: MetricKey, table: string): Promise<LimitResult> {
  const eff = await getEffectiveLimits(client, agencyId);
  if (!eff)          return { ok: false, current: 0, max: 0, isActive: false, reason: "agency_not_found" };
  const max = eff.limits[metric];
  if (!eff.isActive) return { ok: false, current: 0, max, isActive: false, reason: eff.status };
  const current = await countRows(client, table, agencyId);
  return { ok: current < max, current, max, isActive: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const canAddCustomer = (client: any, agencyId: string) => checkLimit(client, agencyId, "customers", "customers");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const canAddRequest  = (client: any, agencyId: string) => checkLimit(client, agencyId, "requests",  "requests");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const canAddPolicy   = (client: any, agencyId: string) => checkLimit(client, agencyId, "policies",  "policies");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const canAddUser     = (client: any, agencyId: string) => checkLimit(client, agencyId, "users",     "profiles");

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
