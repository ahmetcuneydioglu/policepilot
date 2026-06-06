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

export type RequestStatus = 'Yeni' | 'İşlemde' | 'Tamamlandı' | 'İptal';

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
  created_at: string;
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
