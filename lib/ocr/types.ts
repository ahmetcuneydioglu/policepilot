/**
 * SigortaOS — Policy OCR types
 *
 * Provider-agnostic contract for extracting structured data from policy
 * PDFs/photos. Real OCR integrations should implement this shape so UI and
 * API routes stay stable.
 */

export type OcrProviderName =
  | "mock"
  | "openai_vision"
  | "google_document_ai"
  | "azure_form_recognizer"
  | "aws_textract";

export interface OcrFile {
  buffer: ArrayBuffer;
  mimeType: string;
  name: string;
}

export const POLICY_OCR_FIELD_KEYS = [
  "customer_name",
  "phone",
  "tc_identity_no",
  "tax_no",
  "identity_no",
  "address",
  "plate",
  "license_serial",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_year",
  "engine_no",
  "chassis_no",
  "policy_type",
  "policy_no",
  "insurance_company",
  "start_date",
  "end_date",
  "premium",
  // Ürüne özel alanlar — poliçe türüne göre formda gösterilir
  "vehicle_value",        // Kasko: araç bedeli
  "city",                 // DASK/Konut/Sağlık: il
  "district",             // DASK/Konut: ilçe
  "building_age",         // DASK/Konut: bina yaşı
  "area_m2",              // DASK/Konut: metrekare
  "building_type",        // DASK: yapı tarzı (betonarme/çelik/yığma…)
  "housing_type",         // Konut: konut tipi (daire/müstakil…)
  "birth_date",           // Sağlık/Seyahat/Ferdi Kaza: doğum tarihi
  "gender",               // Sağlık: cinsiyet
  "destination_country",  // Seyahat: gidilecek ülke
] as const;

export type PolicyOcrFieldKey = typeof POLICY_OCR_FIELD_KEYS[number];

export interface PolicyOcrField {
  value: string | null;
  confidence: number;
  needsReview: boolean;
  validationMessage?: string | null;
  sourceText?: string | null;
}

export type PolicyOcrFields = Record<PolicyOcrFieldKey, PolicyOcrField>;

export type OcrMode = "demo" | "real";

export interface PolicyOcrResult {
  mode: OcrMode;
  provider: OcrProviderName;
  providerLabel: string;
  fields: PolicyOcrFields;
  raw_response: unknown;
}

export interface OcrProvider {
  readonly name: OcrProviderName;
  extractPolicyData(file: OcrFile): Promise<PolicyOcrResult>;
}
