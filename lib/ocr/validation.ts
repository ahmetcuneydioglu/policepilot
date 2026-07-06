import {
  POLICY_OCR_FIELD_KEYS,
  type PolicyOcrField,
  type PolicyOcrFieldKey,
  type PolicyOcrFields,
} from "./types";

export const KNOWN_POLICY_TYPES = [
  "Trafik",
  "Kasko",
  "İMM",
  "Yeşil Kart",
  "Sağlık",
  "Tamamlayıcı",
  "Hayat",
  "DASK",
  "Konut",
  "Seyahat",
  "Ferdi Kaza",
  "Cep Telefonu",
  "Evcil Hayvan",
  "Diğer",
];

const LOW_CONFIDENCE = 0.78;

export function emptyPolicyOcrFields(): PolicyOcrFields {
  return Object.fromEntries(
    POLICY_OCR_FIELD_KEYS.map((key) => [
      key,
      { value: null, confidence: 0, needsReview: true, validationMessage: "Bulunamadı" },
    ])
  ) as PolicyOcrFields;
}

export function field(value: string | null, confidence = value ? 0.9 : 0): PolicyOcrField {
  return {
    value,
    confidence,
    needsReview: !value || confidence < LOW_CONFIDENCE,
    validationMessage: value ? null : "Bulunamadı",
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function validateSingle(key: PolicyOcrFieldKey, value: string | null): string | null {
  const v = value?.trim() ?? "";
  if (!v) return null;

  switch (key) {
    case "tc_identity_no":
      return /^\d{11}$/.test(v.replace(/\D/g, "")) ? null : "TC Kimlik 11 haneli olmalı";
    case "tax_no":
      return /^\d{10}$/.test(v.replace(/\D/g, "")) ? null : "VKN 10 haneli olmalı";
    case "identity_no": {
      const d = v.replace(/\D/g, "");
      return d.length === 10 || d.length === 11 ? null : "TC/VKN 10 veya 11 haneli olmalı";
    }
    case "plate":
      return /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}$/i.test(v)
        ? null
        : "Türkiye plaka formatı bekleniyor";
    case "start_date":
    case "end_date":
    case "birth_date":
    case "first_registration_date":
      return validDate(v) ? null : "Geçerli tarih olmalı";
    case "premium":
      return Number.isFinite(Number(v.replace(",", "."))) ? null : "Prim sayısal olmalı";
    case "vehicle_value":
      return Number.isFinite(Number(v.replace(/\./g, "").replace(",", "."))) ? null : "Araç bedeli sayısal olmalı";
    case "building_age":
    case "area_m2":
      return /^\d+$/.test(v) ? null : "Sayısal olmalı";
    case "policy_type":
      return KNOWN_POLICY_TYPES.includes(v) ? null : "Bilinen poliçe türlerinden biri olmalı";
    default:
      return null;
  }
}

export function validatePolicyOcrFields(fields: PolicyOcrFields): PolicyOcrFields {
  const next = { ...fields };

  for (const key of POLICY_OCR_FIELD_KEYS) {
    const current = next[key] ?? field(null, 0);
    const validationMessage = validateSingle(key, current.value);
    next[key] = {
      ...current,
      validationMessage,
      needsReview: current.needsReview || Boolean(validationMessage),
    };
  }

  const start = next.start_date.value;
  const end = next.end_date.value;
  if (start && end && validDate(start) && validDate(end) && new Date(end) <= new Date(start)) {
    next.end_date = {
      ...next.end_date,
      needsReview: true,
      validationMessage: "Bitiş tarihi başlangıçtan sonra olmalı",
    };
  }

  return next;
}

export function normalizePolicyType(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLocaleLowerCase("tr-TR");
  if (v.includes("trafik")) return "Trafik";
  if (v.includes("kasko")) return "Kasko";
  if (v.includes("dask") || v.includes("deprem")) return "DASK";
  if (v.includes("konut")) return "Konut";
  if (v.includes("seyahat")) return "Seyahat";
  if (v.includes("ferdi")) return "Ferdi Kaza";
  if (v.includes("yeşil") || v.includes("yesil")) return "Yeşil Kart";
  if (v.includes("imm") || v.includes("ihtiyari")) return "İMM";
  if (v.includes("tamamlay")) return "Tamamlayıcı";
  if (v.includes("sağlık") || v.includes("saglik")) return "Sağlık";
  return KNOWN_POLICY_TYPES.find((type) => type.toLocaleLowerCase("tr-TR") === v) ?? value.trim();
}
