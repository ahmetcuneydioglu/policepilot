/**
 * Mock OCR provider.
 *
 * Returns realistic but deterministic demo data. This keeps the product flow
 * usable until OpenAI Vision, Google Document AI, Azure Form Recognizer, or
 * AWS Textract is connected.
 */

import type { OcrFile, OcrProvider, PolicyOcrResult } from "../types";

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock" as const;

  async extractPolicyData(file: OcrFile): Promise<PolicyOcrResult> {
    console.log(`[ocr/mock] reading demo policy: ${file.name} (${file.mimeType})`);
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const thisYear = new Date().getFullYear();
    const tc = "11111111110";

    return {
      customer_name: "HASAN SULAR",
      phone: "0530 111 22 33",
      tc_identity_no: tc,
      tax_no: null,
      identity_no: tc,
      address: "Ataturk Mah. Sigorta Sok. No: 12/4 Kadikoy / Istanbul",

      plate: "31ADU02",
      license_serial: "AR691046",
      vehicle_brand: "Hyundai",
      vehicle_model: "Getz 1.4",
      vehicle_year: "2006",
      engine_no: "G4EE6359743",
      chassis_no: "KMHBU51DP6U513670",

      policy_type: "Trafik",
      policy_no: "74798326",
      insurance_company: "Ethica Sigorta",
      start_date: `${thisYear}-06-15`,
      end_date: `${thisYear + 1}-06-15`,
      premium: "10153.10",
    };
  }
}
