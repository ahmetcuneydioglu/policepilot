/**
 * Müşteri Kontrol Merkezi — paylaşılan tipler ve yardımcılar.
 * /api/customers/[id] yanıtıyla birebir; mobil uygulama da aynı sözleşmeyi kullanır.
 */

export type CustomerDetail = {
  id: string;
  agency_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  identity_no: string | null;
  insurance_type: string;
  note: string | null;
  created_at: string;
  extra_data: Record<string, string> | null;
};

export type CustomerPolicy = {
  id: string;
  policy_type: string;
  status: string;
  premium: number | null;
  commission: number | null;
  start_date: string;
  end_date: string;
  created_at: string;
  issued_at: string | null;
  renewed_at: string | null;
  renewal_status: string | null;
  insurance_company: string | null;
  policy_no: string | null;
  document_path?: string | null;
  document_name?: string | null;
};

export type CustomerQuoteRun = {
  id: string;
  created_at: string;
  status: string;
  product_type: string;
  provider_type: string | null;
  quote_results?: { id: string; company_name: string; price: number | null; status: string }[];
};

export type CustomerDocument = {
  id: string;
  policy_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  bucket: string | null;
  created_at: string;
};

export type CustomerWhatsApp = {
  id: string;
  status: string;
  message: string;
  sent_at: string | null;
  created_at: string;
  template_key: string | null;
};

export type CustomerStats = {
  total_premium: number;
  total_commission: number;
  active_policies: number;
  upcoming_renewals: number;
};

export type CustomerTimelineEvent = {
  type: string;
  title: string;
  description: string | null;
  date: string;
  ref_id: string | null;
};

export type CustomerBundle = {
  customer: CustomerDetail;
  policies: CustomerPolicy[];
  quote_runs: CustomerQuoteRun[];
  documents: CustomerDocument[];
  whatsapp: CustomerWhatsApp[];
  stats: CustomerStats;
  timeline: CustomerTimelineEvent[];
};

// ─── Format helpers ───────────────────────────────────────────────────────────

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " ₺";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function daysLeft(endDate: string): number {
  const end = new Date(endDate); end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function waPhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "90");
}
