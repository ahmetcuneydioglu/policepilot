/**
 * lib/tenant.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-tenant isolation helpers used by every CRM data fetch.
 *
 * Design rules:
 *  • super_admin → no filter, sees all agencies' data
 *  • agency_user  → .eq("agency_id", agencyId) filter always applied
 *  • agency_user with null agencyId → zero rows returned (no-op query)
 */

/**
 * Apply an agency_id filter to any Supabase query builder.
 * Returns the query unchanged for super_admin.
 *
 * @example
 *   const q = withAgencyFilter(
 *     supabase.from("requests").select("*"),
 *     role, agencyId
 *   );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAgencyFilter(query: any, role: string | null, agencyId: string | null): any {
  if (role === "agency_user") {
    // If agencyId is known, filter to it; if null, filter to impossible value
    // so the user sees zero rows rather than all rows.
    return query.eq("agency_id", agencyId ?? "00000000-0000-0000-0000-000000000000");
  }
  return query; // super_admin: unfiltered global view
}

/** True when the user is a super-admin. */
export function isSuperAdmin(role: string | null): boolean {
  return role === "super_admin";
}

/** True when the user is an agency-level user. */
export function isAgencyUser(role: string | null): boolean {
  return role === "agency_user";
}

/**
 * True when an agency_user has no agency assigned yet.
 * Use this to show the onboarding / "bağlı acente yok" screen.
 */
export function needsOnboarding(
  role: string | null,
  agencyId: string | null,
  authLoading: boolean
): boolean {
  return !authLoading && role === "agency_user" && !agencyId;
}

/**
 * Build a Supabase Realtime filter string for agency-scoped subscriptions.
 *
 * Returns:
 *  • `"agency_id=eq.UUID"` for agency_user with a known agencyId
 *  • `undefined`           for super_admin (global subscription)
 *  • `null`                for agency_user with no agencyId (don't subscribe)
 */
export function realtimeAgencyFilter(
  role: string | null,
  agencyId: string | null
): string | undefined | null {
  if (role === "super_admin") return undefined;     // global
  if (role === "agency_user" && agencyId) return `agency_id=eq.${agencyId}`;
  return null;                                       // no subscription
}
