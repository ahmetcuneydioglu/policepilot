export type Customer = {
  id: string;
  name: string;
  phone: string;
  insurance_type: string;
  note: string | null;
  created_at: string;
  created_by?: string | null;   // ekleyen kullanıcı (profiles.id) — managerial liste için
};

// Satış Fırsatı aşamaları (DB tablosu geriye-uyum için "requests")
export type RequestStatus =
  | "Yeni Lead"
  | "İletişime Geçildi"
  | "Teklif Hazırlanıyor"
  | "Takip Ediliyor"
  | "Kazanıldı"
  | "Kaybedildi";

// Poliçe Yönetimi: kayıtlı durumlar + legacy (Pasif/Yenilendi).
// "Süresi Doldu" DB'de yok — lib/policyStatus.effectivePolicyStatus türetir.
export type PolicyStatus =
  | "Taslak" | "Teklif Hazırlanıyor" | "Şirkette Kesildi" | "Aktif" | "İptal"
  | "Pasif" | "Yenilendi";

export type Request = {
  id: string;
  customer_id: string;
  request_type: string;
  status: RequestStatus;
  price_offer: number | null;
  created_at: string;
  updated_at?: string | null;
  agency_id?: string | null;
  created_by?: string | null;
  assigned_to?: string | null;
  next_follow_up_date?: string | null;
  notes?: string | null;
  policy_id?: string | null;
  customers?: { name: string } | null;
};

export type Policy = {
  id: string;
  customer_id: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium: number | null;
  status: PolicyStatus;
  agency_id: string | null;
  insurance_company: string | null;
  policy_no: string | null;
  commission: number | null;
  note: string | null;
  created_at: string;
  // Teklif & ödeme referansları (migration ile eklendi)
  quote_result_id?: string | null;
  quote_run_id?: string | null;
  transaction_id?: string | null;
  payment_method?: string | null;
  issued_at?: string | null;
  source?: string | null;         // "demo" | "manual" | "api" | "robot" | "gateway"
  // Yenileme takibi
  renewal_status?: string | null;          // pending | quoted | completed
  renewed_from_policy_id?: string | null;  // bu poliçe hangi eski poliçenin yenilemesi
  renewed_at?: string | null;              // eski poliçenin yenilenme tarihi
  // Poliçe dokümanı (Supabase Storage: policy-documents bucket)
  document_path?: string | null;
  document_name?: string | null;
  customers?: { name: string; phone: string } | null;
};
