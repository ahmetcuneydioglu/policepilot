/**
 * Mock OCR provider.
 *
 * Returns realistic but deterministic demo data. This keeps the product flow
 * usable until OpenAI Vision, Google Document AI, Azure Form Recognizer, or
 * AWS Textract is connected.
 */

import type { OcrFile, OcrProvider, PolicyOcrResult } from "../types";
import { field, validatePolicyOcrFields } from "../validation";

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock" as const;

  async extractPolicyData(file: OcrFile): Promise<PolicyOcrResult> {
    console.log(`[ocr/mock] reading demo policy: ${file.name} (${file.mimeType})`);
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const thisYear = new Date().getFullYear();
    const tc = "11111111110";

    const fields = validatePolicyOcrFields({
      customer_name: field("HASAN SULAR", 0.98),
      phone: field("0530 111 22 33", 0.9),
      tc_identity_no: field(tc, 0.97),
      tax_no: field(null, 0),
      identity_no: field(tc, 0.97),
      address: field("Ataturk Mah. Sigorta Sok. No: 12/4 Kadikoy / Istanbul", 0.72),
      plate: field("31ADU02", 0.95),
      license_serial: field("AR691046", 0.88),
      vehicle_brand: field("Hyundai", 0.91),
      vehicle_model: field("Getz 1.4", 0.9),
      vehicle_year: field("2006", 0.89),
      engine_no: field("G4EE6359743", 0.85),
      chassis_no: field("KMHBU51DP6U513670", 0.86),
      first_registration_date: field("2006-06-15", 0.84),
      vehicle_usage: field("Hususi", 0.9),
      policy_type: field("Trafik", 0.96),
      policy_no: field("74798326", 0.93),
      insurance_company: field("Ethica Sigorta", 0.94),
      start_date: field(`${thisYear}-06-15`, 0.92),
      end_date: field(`${thisYear + 1}-06-15`, 0.92),
      premium: field("10153.10", 0.91),
      // Ürüne özel alanlar — demo poliçe Trafik olduğu için boş
      vehicle_value: field(null, 0),
      city: field(null, 0),
      district: field(null, 0),
      building_age: field(null, 0),
      area_m2: field(null, 0),
      building_type: field(null, 0),
      housing_type: field(null, 0),
      birth_date: field(null, 0),
      gender: field(null, 0),
      destination_country: field(null, 0),
    });

    return {
      mode: "demo",
      provider: this.name,
      providerLabel: "Demo OCR",
      fields,
      raw_response: { provider: "mock", fileName: file.name, fields },
    };
  }
}
