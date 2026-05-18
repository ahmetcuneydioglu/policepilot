export type Customer = {
  id: string;
  name: string;
  phone: string;
  insurance_type: string;
  note: string | null;
  created_at: string;
};

export type RequestStatus = "Yeni" | "İşlemde" | "Tamamlandı" | "İptal";

export type PolicyStatus = "Aktif" | "Pasif";

export type Request = {
  id: string;
  customer_id: string;
  request_type: string;
  status: RequestStatus;
  price_offer: number | null;
  created_at: string;
  customers?: { name: string } | null;
};

export type Policy = {
  id: string;
  customer_id: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  status: PolicyStatus;
  customers?: { name: string; phone: string } | null;
};
