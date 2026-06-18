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

// ─── Kişi-bazlı veri kapsamı ────────────────────────────────────────────────
// Owner + Yönetici tüm acente verisini görür; Satış/Operasyon/Görüntüleyici
// yalnız kendi oluşturduğunu (created_by). agency_role null → fail-closed (viewer):
// rolü belirsiz kullanıcı tüm acente verisini GÖREMEZ (DB'de agency_role NOT NULL).

const MANAGERIAL_ROLES = new Set(["owner", "manager"]);

/** Rol acente verisinin tümünü görebilir mi? (null/belirsiz → HAYIR, fail-closed) */
export function isManagerial(agencyRole: string | null | undefined): boolean {
  return agencyRole != null && MANAGERIAL_ROLES.has(agencyRole);
}

/**
 * Acente filtresi + (gerekiyorsa) kişi-bazlı (created_by) filtresi uygular.
 *  • super_admin            → filtre yok (global)
 *  • agency_user managerial → yalnız agency_id
 *  • agency_user diğer      → agency_id + created_by = userId
 * created_by'sı olan tablolar (customers/policies/quote_runs) için kullanılır.
 */
export function withScopeFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  role: string | null,
  agencyId: string | null,
  userId: string | null | undefined,
  agencyRole: string | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (role !== "agency_user") return query; // super_admin: global
  const IMPOSSIBLE = "00000000-0000-0000-0000-000000000000";
  let q = query.eq("agency_id", agencyId ?? IMPOSSIBLE);
  if (!isManagerial(agencyRole)) {
    q = q.eq("created_by", userId ?? IMPOSSIBLE);
  }
  return q;
}

/** Server tarafı: çağıran kendi verisiyle mi sınırlı? (agency_user + non-managerial) */
export function scopeByUser(caller: { role: string; agencyRole?: string | null }): boolean {
  return caller.role === "agency_user" && !isManagerial(caller.agencyRole);
}

/**
 * requests (Teklif Talepleri) kapsamı — requests'te created_by YOK; bağlı
 * müşterinin (customers!inner) created_by'si üzerinden scope'lanır.
 * Çağıran sorgu select'inde `customers!inner(...)` embed etmelidir.
 *  • super_admin            → filtre yok
 *  • agency_user managerial → yalnız agency_id
 *  • agency_user diğer      → agency_id + müşterinin created_by = userId
 *    (gelen public lead'lerin müşterisi created_by'sız → non-managerial'a görünmez)
 */
export function withRequestScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  role: string | null,
  agencyId: string | null,
  userId: string | null | undefined,
  agencyRole: string | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (role !== "agency_user") return query;
  const IMPOSSIBLE = "00000000-0000-0000-0000-000000000000";
  let q = query.eq("agency_id", agencyId ?? IMPOSSIBLE);
  if (!isManagerial(agencyRole)) q = q.eq("customers.created_by", userId ?? IMPOSSIBLE);
  return q;
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
