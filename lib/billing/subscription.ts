/**
 * lib/billing/subscription.ts — abonelik durum makinesi + eklenti/plan mutasyonları.
 *
 * Tek otorite: subscriptions.status. transition() her değişimde agencies.is_active'i
 * senkronlar → getEffectiveLimits (agencies.is_active okur) ve stats/revenue kırılmaz.
 * Tüm yazımlar service-role client ile (admin API'den) yapılır.
 */

export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";
const ACTIVE_STATUSES = new Set<SubStatus>(["trialing", "active"]);

export interface BillingEventInput {
  agencyId: string | null;
  type:     string;
  actorId?: string | null;
  amount?:  number | null;
  status?:  string | null;
  source?:  string;
  external_ref?: string | null;
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logBillingEvent(client: any, e: BillingEventInput): Promise<void> {
  try {
    await client.from("billing_events").insert({
      agency_id: e.agencyId, type: e.type, actor_id: e.actorId ?? null,
      amount: e.amount ?? null, status: e.status ?? "logged",
      source: e.source ?? "manual", external_ref: e.external_ref ?? null,
      metadata: e.metadata ?? {},
    });
  } catch (err) {
    console.warn("[billing] logBillingEvent yutuldu:", err instanceof Error ? err.message : err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSubscription(client: any, agencyId: string) {
  const { data } = await client.from("subscriptions").select("*").eq("agency_id", agencyId).maybeSingle();
  return data ?? null;
}

/** Plan değiştir (agencies.plan) + denetim kaydı. Değişiklik yoksa false döner (olay yazılmaz). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function changePlan(client: any, agencyId: string, plan: string, actorId?: string | null): Promise<boolean> {
  const { data: ag } = await client.from("agencies").select("plan").eq("id", agencyId).maybeSingle();
  if (ag?.plan === plan) return false; // değişiklik yok → hayalet olay yazma
  await client.from("agencies").update({ plan }).eq("id", agencyId);
  await logBillingEvent(client, { agencyId, type: "plan_change", actorId, status: "logged", source: "manual", metadata: { plan, previous: ag?.plan ?? null } });
  return true;
}

/** Durum geçişi: subscriptions.status + agencies.is_active senkron + denetim. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function transition(client: any, agencyId: string, status: SubStatus, actorId?: string | null): Promise<void> {
  const isActive = ACTIVE_STATUSES.has(status);
  await client.from("subscriptions").upsert(
    { agency_id: agencyId, status, updated_at: new Date().toISOString() }, { onConflict: "agency_id" }
  );
  await client.from("agencies").update({ is_active: isActive }).eq("id", agencyId);
  await logBillingEvent(client, { agencyId, type: "status_change", actorId, status: "logged", source: "manual", metadata: { status } });
}

/**
 * Eklenti adedini ayarla (0 → iptal). Değişiklik yoksa hiçbir şey yazmaz ve false döner
 * (dokunulmayan eklentiler için "hayalet" billing_event üretilmez).
 * Olay denetim izi olarak 'logged' yazılır — fatura DEĞİL; fatura = checkout olayıdır.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setAddon(client: any, agencyId: string, addonKey: string, quantity: number, actorId?: string | null): Promise<boolean> {
  const { data: cat } = await client.from("addon_catalog").select("unit_price, label, is_active").eq("key", addonKey).maybeSingle();
  if (!cat || cat.is_active === false) throw new Error(`Geçersiz eklenti: ${addonKey}`);
  const unitPrice = cat.unit_price ?? 0;
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));

  const { data: existing } = await client.from("agency_addons")
    .select("id, quantity").eq("agency_id", agencyId).eq("addon_key", addonKey).eq("status", "active").maybeSingle();
  const currentQty = existing ? (existing.quantity ?? 0) : 0;
  if (qty === currentQty) return false; // değişiklik yok → yazma yok, hayalet olay yok

  if (qty <= 0) {
    if (existing) {
      await client.from("agency_addons")
        .update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", existing.id);
    }
  } else if (existing) {
    await client.from("agency_addons").update({ quantity: qty, unit_price_snapshot: unitPrice }).eq("id", existing.id);
  } else {
    await client.from("agency_addons").insert({
      agency_id: agencyId, addon_key: addonKey, quantity: qty, unit_price_snapshot: unitPrice, status: "active",
    });
  }

  await logBillingEvent(client, {
    agencyId, type: "addon_change", actorId,
    amount: unitPrice * qty, status: "logged",
    source: "manual", metadata: { addon: addonKey, quantity: qty, previous: currentQty },
  });
  return true;
}

/** Acentenin aktif eklentileri (fiyat/limit hesabı için). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveAddons(client: any, agencyId: string) {
  const { data } = await client.from("agency_addons")
    .select("addon_key, quantity, unit_price_snapshot, addon_catalog(label, unit_price, grants_metric, grant_per_unit)")
    .eq("agency_id", agencyId).eq("status", "active");
  return data ?? [];
}
