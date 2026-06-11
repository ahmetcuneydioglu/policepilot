import type {
  OcrFile,
  OcrProvider,
  PolicyOcrField,
  PolicyOcrFieldKey,
  PolicyOcrFields,
  PolicyOcrResult,
} from "../types";
import { POLICY_OCR_FIELD_KEYS } from "../types";
import { emptyPolicyOcrFields, field, normalizePolicyType, validatePolicyOcrFields } from "../validation";

type OpenAiField = {
  value?: string | null;
  confidence?: number | null;
  sourceText?: string | null;
};

type OpenAiOcrPayload = {
  fields?: Partial<Record<PolicyOcrFieldKey, OpenAiField | string | null>>;
};

function toBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function responseText(payload: unknown): string {
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;

  const output = (payload as { output?: Array<{ content?: Array<{ text?: unknown }> }> }).output;
  if (Array.isArray(output)) {
    for (const item of output) {
      for (const content of item.content ?? []) {
        if (typeof content.text === "string") return content.text;
      }
    }
  }
  return "";
}

function coerceConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeFields(payload: OpenAiOcrPayload): PolicyOcrFields {
  const fields = emptyPolicyOcrFields();
  const source = payload.fields ?? {};

  for (const key of POLICY_OCR_FIELD_KEYS) {
    const raw = source[key];
    if (raw == null) continue;

    if (typeof raw === "string") {
      fields[key] = field(key === "policy_type" ? normalizePolicyType(raw) : raw, 0.75);
      continue;
    }

    const value = raw.value ?? null;
    const confidence = coerceConfidence(raw.confidence);
    const normalizedValue = key === "policy_type" ? normalizePolicyType(value) : value;
    fields[key] = {
      value: normalizedValue,
      confidence,
      sourceText: raw.sourceText ?? null,
      needsReview: !normalizedValue || confidence < 0.78,
      validationMessage: null,
    } satisfies PolicyOcrField;
  }

  return validatePolicyOcrFields(fields);
}

export class OpenAiVisionOcrProvider implements OcrProvider {
  readonly name = "openai_vision" as const;

  async extractPolicyData(file: OcrFile): Promise<PolicyOcrResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY eksik. Gerçek OCR için .env.local içine ekleyin veya DEMO_MODE=true kullanın.");
    }

    const model = process.env.OPENAI_OCR_MODEL ?? "gpt-5.5";
    const dataUrl = `data:${file.mimeType};base64,${toBase64(file.buffer)}`;
    const filePart = file.mimeType === "application/pdf"
      ? { type: "input_file", filename: file.name, file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

    const body = {
      model,
      input: [
        {
          role: "user",
          content: [
            filePart,
            {
              type: "input_text",
              text:
                "Bu belge bir Turkiye sigorta policesi olabilir. " +
                "Alanlari yalniz belgede gorunen bilgiye gore cikar. Tahmin etme. " +
                "Tarihleri YYYY-MM-DD formatinda ver. Prim sadece sayisal string olsun. " +
                "policy_type su degerlerden biri olmali: Trafik, Kasko, IMM, Yesil Kart, Saglik, Tamamlayici, DASK, Konut, Seyahat, Ferdi Kaza, Cep Telefonu, Evcil Hayvan, Diger. " +
                "Urune ozel alanlar: arac policelerinde plate/vehicle_*/engine_no/chassis_no; Kasko'da vehicle_value (arac bedeli); " +
                "DASK/Konut'ta city (il), district (ilce), address, building_age (bina yasi), area_m2 (metrekare), building_type (yapi tarzi), housing_type (konut tipi); " +
                "saglik policelerinde birth_date (dogum tarihi YYYY-MM-DD), gender (Erkek|Kadin), city; seyahatte destination_country (gidilecek ulke). " +
                "Belgede olmayan urune ozel alanlari null birak (ornegin DASK'ta plaka olmaz). " +
                "Her alan icin 0-1 arasi confidence ver; emin degilsen degeri null veya dusuk confidence ver.",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "policy_ocr_result",
          strict: false,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              fields: {
                type: "object",
                additionalProperties: false,
                properties: Object.fromEntries(
                  POLICY_OCR_FIELD_KEYS.map((key) => [
                    key,
                    {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        value: { type: ["string", "null"] },
                        confidence: { type: "number" },
                        sourceText: { type: ["string", "null"] },
                      },
                      required: ["value", "confidence", "sourceText"],
                    },
                  ])
                ),
              },
            },
            required: ["fields"],
          },
        },
      },
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await response.json();
    if (!response.ok) {
      const message = (raw as { error?: { message?: string } }).error?.message ?? "OpenAI OCR isteği başarısız.";
      throw new Error(message);
    }

    const text = responseText(raw);
    if (!text) throw new Error("OpenAI OCR yapılandırılmış çıktı döndürmedi.");

    let parsed: OpenAiOcrPayload;
    try {
      parsed = JSON.parse(text) as OpenAiOcrPayload;
    } catch {
      throw new Error("OpenAI OCR çıktısı JSON olarak okunamadı.");
    }

    return {
      mode: "real",
      provider: this.name,
      providerLabel: "Gerçek OCR",
      fields: normalizeFields(parsed),
      raw_response: raw,
    };
  }
}
