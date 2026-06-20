export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  insurance_type: string;
  note: string | null;
  identity_no: string | null;
  vehicle_plate: string | null;
  policy_end_date: string | null;
  extra_data: Record<string, string> | null;
  agency_id: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: 'super_admin' | 'agency_user';
  agency_id: string | null;
  created_at: string;
};

// Web ile birebir 6 aşamalı satış hattı (sales_opportunities_migration CHECK ile uyumlu)
export type RequestStatus =
  | 'Yeni Lead'
  | 'İletişime Geçildi'
  | 'Teklif Hazırlanıyor'
  | 'Takip Ediliyor'
  | 'Kazanıldı'
  | 'Kaybedildi';

export type PolicyStatus = 'Aktif' | 'Pasif';

export type Request = {
  id: string;
  customer_id: string;
  request_type: string;
  status: RequestStatus;
  price_offer: number | null;
  agency_id: string | null;
  created_at: string;
  customers?: { name: string; phone: string | null; insurance_type: string | null } | null;
};

export type DocumentRecord = {
  id: string;
  agency_id: string | null;
  customer_id: string | null;
  request_id: string | null;
  policy_id: string | null;
  file_name: string;
  file_path: string;       // Storage path içinde, örn. "agency_xxx/customers/cust_yyy/photo.pdf"
  file_type: string;       // MIME type
  file_size: number | null;
  bucket: string;          // "documents"
  uploaded_by: string | null;
  doc_type?: string | null; // Kimlik/Ruhsat/Poliçe/Hasar/Diğer (Evrak Merkezi kategorisi)
  created_at: string;
};

export type Agency = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_color: string;
  created_at: string;
  max_users: number | null;
  max_customers: number | null;
  max_requests: number | null;
  max_policies: number | null;
  is_active: boolean | null;
  plan: string | null;
  expires_at: string | null;
};

export type AgencyCounts = {
  users: number;
  customers: number;
  requests: number;
  policies: number;
};

export type Policy = {
  id: string;
  customer_id: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium?: number | null;
  status: PolicyStatus;
  agency_id?: string | null;
  insurance_company?: string | null;
  policy_no?: string | null;
  commission?: number | null;
  note?: string | null;
  customers?: { name: string; phone: string } | null;
};
