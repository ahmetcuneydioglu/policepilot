/**
 * src/lib/policyOcr.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Poliçe OCR ortak katmanı (web ile birebir sadık):
 *  - /api/ocr/policy ile alan çıkarımı
 *  - /api/customers/from-policy ile müşteri+poliçe+evrak oluşturma
 *    (sunucu: müşteri TC/telefon eşleştirme + policy_no dedup → mükerrer engellenir)
 * Tekli OCR ve toplu içe aktarma bu katmanı paylaşır.
 */

import { apiPostForm, ApiError } from './api';

// Web KNOWN_POLICY_TYPES ile aynı (lib/ocr/validation.ts)
export const POLICY_TYPES = [
  'Trafik', 'Kasko', 'İMM', 'Yeşil Kart', 'Sağlık', 'Tamamlayıcı',
  'DASK', 'Konut', 'Seyahat', 'Ferdi Kaza', 'Cep Telefonu', 'Evcil Hayvan', 'Diğer',
];

export type OcrField = { value: string | null; confidence?: number; needsReview?: boolean };
export type OcrFields = Record<string, OcrField>;
export type Asset = { uri: string; fileName: string; mimeType: string };

export type PolicyRow = {
  name: string; phone: string; tc_identity_no: string; tax_no: string; address: string;
  plate: string; license_serial: string; brand_model: string; vehicle_year: string;
  engine_no: string; chassis_no: string; first_registration_date: string; vehicle_usage: string;
  vehicle_value: string; city: string; district: string;
  building_age: string; area_m2: string; building_type: string; housing_type: string;
  birth_date: string; gender: string; destination_country: string;
  policy_type: string; policy_no: string; insurance_company: string; premium: string;
  start_date: string; end_date: string;
};

export function emptyRow(): PolicyRow {
  return {
    name: '', phone: '', tc_identity_no: '', tax_no: '', address: '', plate: '',
    license_serial: '', brand_model: '', vehicle_year: '', engine_no: '', chassis_no: '',
    first_registration_date: '', vehicle_usage: '',
    vehicle_value: '', city: '', district: '', building_age: '', area_m2: '',
    building_type: '', housing_type: '', birth_date: '', gender: '', destination_country: '',
    policy_type: '', policy_no: '', insurance_company: '', premium: '', start_date: '', end_date: '',
  };
}

/** OCR alanları → düzenlenebilir satır (web ocrToRow ile aynı). */
export function ocrToRow(fields: OcrFields): PolicyRow {
  const v = (k: string) => (fields[k]?.value ?? '').toString().trim();
  const brand = v('vehicle_brand'), model = v('vehicle_model');
  return {
    ...emptyRow(),
    name: v('customer_name'), phone: v('phone'), tc_identity_no: v('tc_identity_no'), tax_no: v('tax_no'),
    address: v('address'), plate: v('plate').toUpperCase(), license_serial: v('license_serial'),
    brand_model: [brand, model].filter(Boolean).join(' '), vehicle_year: v('vehicle_year'),
    engine_no: v('engine_no'), chassis_no: v('chassis_no'),
    first_registration_date: v('first_registration_date'), vehicle_usage: v('vehicle_usage'),
    vehicle_value: v('vehicle_value'),
    city: v('city'), district: v('district'), building_age: v('building_age'), area_m2: v('area_m2'),
    building_type: v('building_type'), housing_type: v('housing_type'), birth_date: v('birth_date'),
    gender: v('gender'), destination_country: v('destination_country'),
    policy_type: v('policy_type'), policy_no: v('policy_no'), insurance_company: v('insurance_company'),
    premium: v('premium'), start_date: v('start_date'), end_date: v('end_date'),
  };
}

export function isValidRow(d: PolicyRow): boolean {
  return !!d.name.trim() && !!d.policy_type;
}

export type OcrResult = { fields: OcrFields; provider: string; mode: string; raw: string };

/** Dosyayı OCR'a gönder, alanları + sağlayıcı/mod/ham yanıt döndür. */
export async function ocrExtract(asset: Asset): Promise<OcrResult> {
  const form = new FormData();
  form.append('file', { uri: asset.uri, name: asset.fileName, type: asset.mimeType } as any);
  const res = await apiPostForm<any>('/api/ocr/policy', form);
  return {
    fields: res.fields ?? {},
    provider: res.providerLabel ?? res.provider ?? '',
    mode: res.mode ?? 'real',
    raw: JSON.stringify(res.raw_response ?? res.fields ?? {}),
  };
}

export type SaveResult = { status: 'saved' | 'duplicate' | 'error'; matched?: boolean; error?: string };

/** Müşteri+poliçe+evrak oluştur (web from-policy ile aynı alanlar). 409 → mükerrer. */
export async function submitFromPolicy(
  asset: Asset, d: PolicyRow, meta: { provider: string; mode: string; raw: string }, agencyId: string | null
): Promise<SaveResult> {
  const fd = new FormData();
  fd.append('file', { uri: asset.uri, name: asset.fileName, type: asset.mimeType } as any);
  fd.append('name', d.name);
  fd.append('phone', d.phone);
  fd.append('insurance_type', d.policy_type);
  fd.append('tc_identity_no', d.tc_identity_no);
  fd.append('tax_no', d.tax_no);
  fd.append('identity_no', d.tc_identity_no || d.tax_no);
  fd.append('address', d.address);
  fd.append('vehicle_plate', d.plate.toUpperCase());
  fd.append('license_serial', d.license_serial);
  fd.append('brand_model', d.brand_model);
  fd.append('vehicle_year', d.vehicle_year);
  fd.append('engine_no', d.engine_no);
  fd.append('chassis_no', d.chassis_no);
  fd.append('first_registration_date', d.first_registration_date);
  fd.append('vehicle_usage', d.vehicle_usage);
  fd.append('vehicle_value', d.vehicle_value.replace(',', '.'));
  fd.append('city', d.city);
  fd.append('district', d.district);
  fd.append('building_age', d.building_age);
  fd.append('area_m2', d.area_m2);
  fd.append('building_type', d.building_type);
  fd.append('housing_type', d.housing_type);
  fd.append('birth_date', d.birth_date);
  fd.append('gender', d.gender);
  fd.append('destination_country', d.destination_country);
  fd.append('policy_no', d.policy_no);
  fd.append('insurance_company', d.insurance_company);
  fd.append('premium', d.premium.replace(',', '.'));
  fd.append('policy_start_date', d.start_date);
  fd.append('policy_end_date', d.end_date);
  fd.append('ocr_provider', meta.provider);
  fd.append('ocr_mode', meta.mode);
  fd.append('ocr_raw_response', meta.raw);
  if (agencyId) fd.append('agency_id', agencyId);

  try {
    const json = await apiPostForm<any>('/api/customers/from-policy', fd);
    return { status: 'saved', matched: !!json.customerMatched };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { status: 'duplicate', error: e.message };
    return { status: 'error', error: e instanceof Error ? e.message : 'Kayıt başarısız' };
  }
}
