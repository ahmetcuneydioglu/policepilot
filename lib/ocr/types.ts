/**
 * PolicePilot — Policy OCR types
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

export interface PolicyOcrResult {
  customer_name: string | null;
  phone: string | null;
  tc_identity_no: string | null;
  tax_no: string | null;
  /** Backward-compatible combined TC/VKN value. Prefer tc_identity_no/tax_no. */
  identity_no: string | null;
  address: string | null;

  plate: string | null;
  license_serial: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  engine_no: string | null;
  chassis_no: string | null;

  policy_type: string | null;
  policy_no: string | null;
  insurance_company: string | null;
  start_date: string | null;
  end_date: string | null;
  premium: string | null;
}

export interface OcrProvider {
  readonly name: OcrProviderName;
  extractPolicyData(file: OcrFile): Promise<PolicyOcrResult>;
}
