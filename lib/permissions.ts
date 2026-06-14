/**
 * PolicePilot — Yetki (permission) kataloğu ve rol şablonları.
 *
 * Saf TS — hiçbir import yok. Hem client (UI toggle/buton gizleme) hem server
 * (Faz 2 backend guard) kullanır. Tek doğruluk kaynağı: ROLE_TEMPLATES.
 *
 * Önemli ayrım:
 *  - SİSTEM rolü `role` ('super_admin' | 'agency_user') → erişim katmanı,
 *    DB'de profiles.role, backend guard'larında okunur. Buradaki AgencyRole DEĞİL.
 *  - ACENTE içi SaaS rolü `agency_role` ('owner'|'manager'|...) → bu dosya.
 */

// ─── Yetki anahtarları ─────────────────────────────────────────────────────────

export type PermissionKey =
  | "customer.view" | "customer.edit" | "customer.delete"
  | "quote.create"  | "quote.edit"    | "quote.delete"
  | "policy.create" | "policy.edit"
  | "whatsapp.send"
  | "document.upload"
  | "ai.use"
  | "reports.view"
  | "users.manage"
  | "settings.manage"
  | "billing.manage";

export type PermissionGroup =
  | "Müşteriler" | "Teklifler" | "Poliçeler"
  | "İletişim" | "Yapay Zeka" | "Raporlar" | "Yönetim";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  group: PermissionGroup;
}

/** UI'da gruplu gösterim için sıralı katalog. */
export const PERMISSIONS: PermissionDef[] = [
  { key: "customer.view",   label: "Müşteri Görüntüle", group: "Müşteriler" },
  { key: "customer.edit",   label: "Müşteri Düzenle",   group: "Müşteriler" },
  { key: "customer.delete", label: "Müşteri Sil",       group: "Müşteriler" },

  { key: "quote.create",    label: "Teklif Oluştur",    group: "Teklifler" },
  { key: "quote.edit",      label: "Teklif Düzenle",    group: "Teklifler" },
  { key: "quote.delete",    label: "Teklif Sil",        group: "Teklifler" },

  { key: "policy.create",   label: "Poliçe Oluştur",    group: "Poliçeler" },
  { key: "policy.edit",     label: "Poliçe Düzenle",    group: "Poliçeler" },

  { key: "whatsapp.send",   label: "WhatsApp Gönder",   group: "İletişim" },
  { key: "document.upload", label: "Evrak Yükle",       group: "İletişim" },

  { key: "ai.use",          label: "AI Araçlarını Kullan", group: "Yapay Zeka" },

  { key: "reports.view",    label: "Raporları Gör",     group: "Raporlar" },

  { key: "users.manage",    label: "Kullanıcı Yönet",       group: "Yönetim" },
  { key: "settings.manage", label: "Acente Ayarlarını Yönet", group: "Yönetim" },
  { key: "billing.manage",  label: "Abonelik Yönet",        group: "Yönetim" },
];

/** UI gruplama sırası. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  "Müşteriler", "Teklifler", "Poliçeler", "İletişim", "Yapay Zeka", "Raporlar", "Yönetim",
];

const ALL_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

// ─── Acente içi roller ─────────────────────────────────────────────────────────

export type AgencyRole = "owner" | "manager" | "sales" | "operations" | "viewer";

export interface AgencyRoleDef {
  value: AgencyRole;
  label: string;
  description: string;
}

export const AGENCY_ROLES: AgencyRoleDef[] = [
  { value: "owner",      label: "Acente Sahibi",     description: "Tüm yetkiler" },
  { value: "manager",    label: "Yönetici",          description: "Abonelik hariç tüm operasyon" },
  { value: "sales",      label: "Satış Temsilcisi",  description: "Müşteri, teklif, poliçe, mesaj" },
  { value: "operations", label: "Operasyon",         description: "Müşteri/poliçe işleme, evrak" },
  { value: "viewer",     label: "Görüntüleyici",     description: "Yalnız görüntüleme" },
];

// ─── Yardımcı: tam set üret ─────────────────────────────────────────────────────

/** Verilen anahtarları true, kalanını false yapan tam yetki haritası. */
function grant(keys: PermissionKey[]): Record<PermissionKey, boolean> {
  const out = {} as Record<PermissionKey, boolean>;
  for (const k of ALL_KEYS) out[k] = false;
  for (const k of keys) out[k] = true;
  return out;
}

// ─── Rol şablonları (varsayılan yetki setleri) ──────────────────────────────────

export const ROLE_TEMPLATES: Record<AgencyRole, Record<PermissionKey, boolean>> = {
  // Sahip: her şey
  owner: grant(ALL_KEYS),

  // Yönetici: abonelik hariç tüm operasyon + kullanıcı/ayar yönetimi
  manager: grant([
    "customer.view", "customer.edit", "customer.delete",
    "quote.create", "quote.edit", "quote.delete",
    "policy.create", "policy.edit",
    "whatsapp.send", "document.upload", "ai.use", "reports.view",
    "users.manage", "settings.manage",
  ]),

  // Satış: müşteri/teklif/poliçe üretimi + mesaj; silme ve yönetim yok
  sales: grant([
    "customer.view", "customer.edit",
    "quote.create", "quote.edit",
    "policy.create",
    "whatsapp.send", "document.upload", "ai.use", "reports.view",
  ]),

  // Operasyon: kayıt işleme + evrak; teklif/silme/yönetim sınırlı
  operations: grant([
    "customer.view", "customer.edit",
    "policy.create", "policy.edit",
    "whatsapp.send", "document.upload", "reports.view",
  ]),

  // Görüntüleyici: yalnız okuma
  viewer: grant([
    "customer.view", "reports.view",
  ]),
};

// ─── Çözümleme ──────────────────────────────────────────────────────────────────

/**
 * Etkin yetki seti: rol şablonu ⊕ (varsa) kullanıcı override'ı (shallow merge).
 * overrides yalnız şablondan FARKLI anahtarları içerir; null → saf şablon.
 */
export function resolvePermissions(
  agencyRole: AgencyRole | string | null | undefined,
  overrides: Partial<Record<PermissionKey, boolean>> | null | undefined
): Record<PermissionKey, boolean> {
  const base = ROLE_TEMPLATES[(agencyRole as AgencyRole)] ?? ROLE_TEMPLATES.viewer;
  if (!overrides) return { ...base };
  return { ...base, ...overrides };
}

/** Tek yetki sorgusu — Faz 1 UI buton gizleme + Faz 2 backend guard. */
export function hasPermission(
  agencyRole: AgencyRole | string | null | undefined,
  overrides: Partial<Record<PermissionKey, boolean>> | null | undefined,
  key: PermissionKey
): boolean {
  return resolvePermissions(agencyRole, overrides)[key] === true;
}

/** Etiketli rol bulucu (UI rozetleri). */
export function agencyRoleLabel(role: AgencyRole | string | null | undefined): string {
  return AGENCY_ROLES.find((r) => r.value === role)?.label ?? "—";
}
