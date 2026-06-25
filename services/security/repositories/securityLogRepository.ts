/**
 * security_logs veri erişimi (append-only). Service-role ile yazılır.
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface SecurityLogInsert {
  user_id: string | null;
  agency_id?: string | null;
  event: string;
  channel?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function insertLog(row: SecurityLogInsert): Promise<void> {
  const admin = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("security_logs") as any).insert({
    user_id: row.user_id,
    agency_id: row.agency_id ?? null,
    event: row.event,
    channel: row.channel ?? null,
    ip: row.ip ?? null,
    user_agent: row.user_agent ?? null,
    metadata: row.metadata ?? {},
  });
}
