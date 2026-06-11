"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { canAddCustomer, limitMessage } from "@/lib/limits";
import { INACTIVE_MESSAGE } from "@/lib/limits";
import { KNOWN_POLICY_TYPES } from "@/lib/ocr/validation";

// ─── Insurance types & their extra field groups ────────────────────────────────
const INSURANCE_TYPES = [
  { value: "Trafik",      label: "🚗 Trafik Sigortası",   group: "vehicle"   },
  { value: "Kasko",       label: "🛡️ Kasko",              group: "vehicle"   },
  { value: "İMM",         label: "📋 İMM",                group: "vehicle"   },
  { value: "Yeşil Kart",  label: "🌍 Yeşil Kart",         group: "vehicle"   },
  { value: "Sağlık",      label: "❤️ Sağlık Sigortası",   group: "health"    },
  { value: "Tamamlayıcı", label: "🏥 Tamamlayıcı Sağlık", group: "health"    },
  { value: "DASK",        label: "🏠 DASK",               group: "property"  },
  { value: "Konut",       label: "🏡 Konut Sigortası",    group: "property"  },
  { value: "Seyahat",     label: "✈️ Seyahat Sağlık",    group: "other"     },
  { value: "Ferdi Kaza",  label: "⚡ Ferdi Kaza",         group: "other"     },
  { value: "Cep Telefonu",label: "📱 Cep Telefonu",       group: "other"     },
  { value: "Evcil Hayvan",label: "🐾 Evcil Hayvan",       group: "other"     },
  { value: "Diğer",       label: "📁 Diğer",              group: "other"     },
];

type Props = { onClose: () => void; agencyId?: string | null; role?: string | null };

const INPUT = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition placeholder:text-gray-300";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1.5";

type FieldStatus = "ocr" | "edited";
type OcrMode = "demo" | "real";
type OcrApiField = {
  value: string | null;
  confidence: number;
  needsReview: boolean;
  validationMessage?: string | null;
  sourceText?: string | null;
};
type OcrReviewItem = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  needsReview: boolean;
  validationMessage?: string | null;
  userEdited: boolean;
};

const OCR_REVIEW_FIELDS = [
  { key: "customer_name", label: "Ad Soyad" },
  { key: "phone", label: "Telefon" },
  { key: "tc_identity_no", label: "TC Kimlik" },
  { key: "tax_no", label: "VKN" },
  { key: "address", label: "Adres" },
  { key: "plate", label: "Plaka" },
  { key: "license_serial", label: "Ruhsat Seri No" },
  { key: "vehicle_brand", label: "Marka" },
  { key: "vehicle_model", label: "Model" },
  { key: "vehicle_year", label: "Model Yılı" },
  { key: "engine_no", label: "Motor No" },
  { key: "chassis_no", label: "Şasi No" },
  { key: "vehicle_value", label: "Araç Bedeli (₺)" },
  { key: "city", label: "İl" },
  { key: "district", label: "İlçe" },
  { key: "building_age", label: "Bina Yaşı" },
  { key: "area_m2", label: "Metrekare" },
  { key: "building_type", label: "Yapı Tarzı" },
  { key: "housing_type", label: "Konut Tipi" },
  { key: "birth_date", label: "Doğum Tarihi" },
  { key: "gender", label: "Cinsiyet" },
  { key: "destination_country", label: "Gidilecek Ülke" },
  { key: "policy_type", label: "Poliçe Türü" },
  { key: "policy_no", label: "Poliçe No" },
  { key: "insurance_company", label: "Sigorta Şirketi" },
  { key: "start_date", label: "Başlangıç Tarihi" },
  { key: "end_date", label: "Bitiş Tarihi" },
  { key: "premium", label: "Prim" },
];

// ─── Poliçe türüne göre gösterilecek inceleme alanları ─────────────────────────
// Her ürünün alanları farklıdır: DASK'ta plaka olmaz, sağlıkta motor no olmaz.
// policy_type bu listelerde yer almaz — tür, ayrı seçim adımında yönetilir.
const ID_FIELDS     = ["customer_name", "phone", "tc_identity_no", "tax_no"];
const ID_TC_ONLY    = ["customer_name", "phone", "tc_identity_no"];
const POLICY_COMMON = ["insurance_company", "policy_no", "start_date", "end_date", "premium"];

const TRAFIK_FIELDS = [...ID_FIELDS, "plate", "license_serial", "vehicle_brand", "vehicle_model", "vehicle_year", "engine_no", "chassis_no", ...POLICY_COMMON];

const TYPE_REVIEW_FIELDS: Record<string, string[]> = {
  "Trafik":       TRAFIK_FIELDS,
  "İMM":          TRAFIK_FIELDS,
  "Yeşil Kart":   TRAFIK_FIELDS,
  "Kasko":        [...ID_FIELDS, "plate", "vehicle_brand", "vehicle_model", "vehicle_year", "engine_no", "chassis_no", "vehicle_value", ...POLICY_COMMON],
  "DASK":         [...ID_FIELDS, "city", "district", "address", "building_age", "area_m2", "building_type", ...POLICY_COMMON],
  "Konut":        [...ID_FIELDS, "city", "district", "address", "building_age", "area_m2", "housing_type", ...POLICY_COMMON],
  "Sağlık":       [...ID_TC_ONLY, "birth_date", "gender", "city", ...POLICY_COMMON],
  "Tamamlayıcı":  [...ID_TC_ONLY, "birth_date", "gender", "city", ...POLICY_COMMON],
  "Seyahat":      [...ID_TC_ONLY, "birth_date", "destination_country", ...POLICY_COMMON],
  "Ferdi Kaza":   [...ID_TC_ONLY, "birth_date", "gender", ...POLICY_COMMON],
  "Cep Telefonu": [...ID_FIELDS, ...POLICY_COMMON],
  "Evcil Hayvan": [...ID_FIELDS, ...POLICY_COMMON],
  "Diğer":        [...ID_FIELDS, "address", ...POLICY_COMMON],
};

function visibleReviewKeys(policyType: string): string[] | null {
  return TYPE_REVIEW_FIELDS[policyType] ?? null;
}

function reviewValue(items: OcrReviewItem[], key: string): string {
  return items.find((item) => item.key === key)?.value.trim() ?? "";
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function validateReviewItem(key: string, value: string): string | null {
  const v = value.trim();
  if (!v && ["customer_name", "policy_type"].includes(key)) return "Kritik alan eksik";
  if (!v) return null;
  if (key === "tc_identity_no" && !/^\d{11}$/.test(v.replace(/\D/g, ""))) return "11 hane olmalı";
  if (key === "tax_no" && !/^\d{10}$/.test(v.replace(/\D/g, ""))) return "10 hane olmalı";
  if (key === "plate" && !/^(0[1-9]|[1-7][0-9]|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}$/i.test(v)) return "Plaka formatı hatalı";
  if ((key === "start_date" || key === "end_date") && !validIsoDate(v)) return "Tarih geçersiz";
  if (key === "premium" && !Number.isFinite(Number(v.replace(",", ".")))) return "Prim sayısal olmalı";
  if (key === "policy_type" && !KNOWN_POLICY_TYPES.includes(v)) return "Bilinmeyen poliçe türü";
  return null;
}

function isBlockingReviewIssue(item: OcrReviewItem, allItems: OcrReviewItem[]): boolean {
  if (item.key === "customer_name" || item.key === "policy_type") {
    return Boolean(item.validationMessage);
  }
  if (item.key === "phone" || item.key === "tc_identity_no") {
    const hasPhone = Boolean(reviewValue(allItems, "phone"));
    const tc = reviewValue(allItems, "tc_identity_no").replace(/\D/g, "");
    const hasValidTc = /^\d{11}$/.test(tc);
    return !hasPhone && !hasValidTc;
  }
  return false;
}

function hasBlockingReviewIssues(items: OcrReviewItem[]): boolean {
  return items.some((item) => isBlockingReviewIssue(item, items));
}

function StatusBadge({ status }: { status?: FieldStatus }) {
  if (!status) return null;
  return status === "ocr" ? (
    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold ring-1 ring-emerald-200 align-middle">
      ✓ OCR ile bulundu
    </span>
  ) : (
    <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold ring-1 ring-amber-200 align-middle">
      ✏️ Manuel Düzenlendi
    </span>
  );
}

function Field({ label, children, optional, status }: { label: string; children: React.ReactNode; optional?: boolean; status?: FieldStatus }) {
  return (
    <div>
      <label className={LABEL}>
        {label}
        {optional && <span className="ml-1 text-gray-400 font-normal">(isteğe bağlı)</span>}
        <StatusBadge status={status} />
      </label>
      {children}
    </div>
  );
}

export default function AddCustomerModal({ onClose, agencyId, role }: Props) {
  // Limit state
  const [limitChecked, setLimitChecked] = useState(false);
  const [limitOk, setLimitOk]           = useState(true);
  const [limitMsg, setLimitMsg]         = useState("");

  // Super admin: acenteye bağlı değildir, müşterinin ekleneceği acenteyi seçer
  const isSuperAdmin = role === "super_admin";
  const [agencies,       setAgencies]       = useState<{ id: string; name: string }[]>([]);
  const [selectedAgency, setSelectedAgency] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }: { data: { id: string; name: string }[] | null }) => {
        setAgencies(data ?? []);
        if (data?.length === 1) setSelectedAgency(data[0].id);
      });
  }, [isSuperAdmin]);

  const effectiveAgencyId = isSuperAdmin ? (selectedAgency || null) : (agencyId ?? null);

  // Base fields
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [email,        setEmail]        = useState("");
  const [tcIdentityNo, setTcIdentityNo] = useState("");
  const [taxNo,        setTaxNo]        = useState("");
  const [note,         setNote]         = useState("");
  const [insuranceType,setInsuranceType]= useState("");

  // Vehicle fields
  const [plate,        setPlate]        = useState("");
  const [licenseSerial,setLicenseSerial]= useState("");
  const [brandModel,   setBrandModel]   = useState("");
  const [vehicleYear,  setVehicleYear]  = useState("");
  const [engineNo,     setEngineNo]     = useState("");
  const [chassisNo,    setChassisNo]    = useState("");

  // Health fields
  const [birthDate,    setBirthDate]    = useState("");
  const [gender,       setGender]       = useState("");
  const [city,         setCity]         = useState("");
  const [healthNote,   setHealthNote]   = useState("");

  // Property fields
  const [propCity,     setPropCity]     = useState("");
  const [propDistrict, setPropDistrict] = useState("");
  const [address,      setAddress]      = useState("");
  const [buildingAge,  setBuildingAge]  = useState("");
  const [areaM2,       setAreaM2]       = useState("");

  // Other
  const [description,  setDescription]  = useState("");

  // Poliçe bilgileri (gerçek poliçeden — hepsi isteğe bağlı)
  const [policyNo,        setPolicyNo]        = useState("");
  const [insuranceCompany,setInsuranceCompany]= useState("");
  const [premium,         setPremium]         = useState("");
  const [policyStartDate, setPolicyStartDate] = useState("");
  const [policyEndDate,   setPolicyEndDate]   = useState("");

  // Poliçe dosyası (PDF/JPG/PNG)
  const [docFile,    setDocFile]    = useState<File | null>(null);
  const [docWarning, setDocWarning] = useState("");

  // Giriş modu: poliçeden otomatik (varsayılan) veya manuel
  const [entryMode,  setEntryMode]  = useState<"policy" | "manual">("policy");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone,    setOcrDone]    = useState(false);
  const [ocrError,   setOcrError]   = useState("");
  const [ocrMode,    setOcrMode]    = useState<OcrMode | null>(null);
  const [ocrProviderLabel, setOcrProviderLabel] = useState("");
  const [ocrRawResponse, setOcrRawResponse] = useState("");
  const [ocrReviewItems, setOcrReviewItems] = useState<OcrReviewItem[]>([]);
  // Tür tespit edildiyse tüm chip'ler gizlenir; "Değiştir" ile açılır
  const [typeChipsOpen, setTypeChipsOpen] = useState(false);

  // Alan kaynağı rozetleri: OCR ile bulundu / sonradan düzenlendi
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({});
  function touch(key: string) {
    setFieldStatus(s => (s[key] === "ocr" ? { ...s, [key]: "edited" } : s));
  }

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);
  const [docUploaded, setDocUploaded] = useState(false);

  // Başlangıç seçilince bitişi otomatik +365 gün öner (gerçek poliçe süresi)
  function handleStartDate(v: string) {
    setPolicyStartDate(v);
    if (v && !policyEndDate) {
      const d = new Date(`${v}T00:00:00`);
      d.setDate(d.getDate() + 365);
      setPolicyEndDate(d.toISOString().slice(0, 10));
    }
  }

  function handleFilePick(f: File | null) {
    setDocWarning("");
    if (!f) { setDocFile(null); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) {
      setDocWarning("Yalnız PDF, JPG veya PNG yüklenebilir."); return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setDocWarning("Dosya 8MB'dan büyük olamaz."); return;
    }
    setDocFile(f);
  }

  // ── Poliçeden otomatik doldurma: OCR çalıştır, alanları doldur ────────────
  async function runOcr(f: File | null) {
    if (!f) return;
    setOcrError("");
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) {
      setOcrError("Yalnız PDF, JPG veya PNG yüklenebilir."); return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setOcrError("Dosya 8MB'dan büyük olamaz."); return;
    }

    setDocFile(f);          // Aynı dosya kayıtta evrak olarak da yüklenecek
    setOcrLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", f);
      const res  = await fetch("/api/ocr/policy", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Poliçe okunamadı.");

      const x = json.fields as Record<string, OcrApiField>;
      const items = OCR_REVIEW_FIELDS.map((meta) => {
        const field = x[meta.key];
        const value = field?.value ?? "";
        const validationMessage = validateReviewItem(meta.key, value) ?? field?.validationMessage ?? null;
        return {
          key: meta.key,
          label: meta.label,
          value,
          confidence: typeof field?.confidence === "number" ? field.confidence : 0,
          needsReview: Boolean(field?.needsReview || validationMessage),
          validationMessage,
          userEdited: false,
        };
      });

      const startDate = reviewValue(items, "start_date");
      const endDate = reviewValue(items, "end_date");
      if (startDate && endDate && validIsoDate(startDate) && validIsoDate(endDate) && new Date(endDate) <= new Date(startDate)) {
        const idx = items.findIndex((item) => item.key === "end_date");
        if (idx >= 0) {
          items[idx] = { ...items[idx], needsReview: true, validationMessage: "Bitiş tarihi başlangıçtan sonra olmalı" };
        }
      }

      setOcrMode(json.mode ?? null);
      setOcrProviderLabel(json.providerLabel ?? (json.mode === "real" ? "Gerçek OCR" : "Demo OCR"));
      setOcrRawResponse(JSON.stringify(json.raw_response ?? json.fields ?? {}, null, 2));
      setOcrReviewItems(items);
      setFieldStatus({});
      setOcrDone(true);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Poliçe okunamadı.");
      setDocFile(null);
    } finally {
      setOcrLoading(false);
    }
  }

  // ── Check customer limit on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!agencyId) {
      queueMicrotask(() => setLimitChecked(true));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canAddCustomer(supabase as any, agencyId).then((res) => {
      setLimitOk(res.ok && res.isActive);
      if (!res.isActive) setLimitMsg(INACTIVE_MESSAGE);
      else if (!res.ok)  setLimitMsg(`${limitMessage("customer")} (${res.current}/${res.max})`);
      setLimitChecked(true);
    });
  }, [agencyId]);

  const group = INSURANCE_TYPES.find((t) => t.value === insuranceType)?.group ?? "";

  // OCR inceleme ekranı: tespit edilen poliçe türü ve o türe ait görünür alanlar
  const reviewType = reviewValue(ocrReviewItems, "policy_type");
  const reviewKeys = visibleReviewKeys(reviewType);
  const visibleReviewItems = reviewKeys
    ? (reviewKeys
        .map((k) => ocrReviewItems.find((item) => item.key === k))
        .filter(Boolean) as OcrReviewItem[])
    : [];
  const typeDetectedByOcr = Boolean(reviewKeys) && !ocrReviewItems.find((i) => i.key === "policy_type")?.userEdited;

  function updateReviewValue(key: string, value: string) {
    setOcrReviewItems((prev) => {
      const next = prev.map((item) => {
        if (item.key !== key) return item;
        const validationMessage = validateReviewItem(key, value);
        return {
          ...item,
          value,
          userEdited: true,
          needsReview: Boolean(validationMessage) || item.confidence < 0.78,
          validationMessage,
        };
      });

      const startDate = reviewValue(next, "start_date");
      const endDate = reviewValue(next, "end_date");
      const endIdx = next.findIndex((item) => item.key === "end_date");
      if (endIdx >= 0 && startDate && endDate && validIsoDate(startDate) && validIsoDate(endDate) && new Date(endDate) <= new Date(startDate)) {
        next[endIdx] = { ...next[endIdx], needsReview: true, validationMessage: "Bitiş tarihi başlangıçtan sonra olmalı" };
      }
      return next;
    });
  }

  async function saveOcrReview() {
    if (!limitOk || !docFile) return;
    if (isSuperAdmin && !selectedAgency) {
      setOcrError("Süper admin olarak müşteri eklerken acente seçmelisiniz.");
      return;
    }

    const nextItems = ocrReviewItems.map((item) => ({
      ...item,
      validationMessage: validateReviewItem(item.key, item.value) ?? item.validationMessage ?? null,
    }));

    const hasIdentity = Boolean(reviewValue(nextItems, "phone")) || /^\d{11}$/.test(reviewValue(nextItems, "tc_identity_no").replace(/\D/g, ""));
    const finalItems = nextItems.map((item) => {
      if (!hasIdentity && (item.key === "phone" || item.key === "tc_identity_no")) {
        return { ...item, needsReview: true, validationMessage: "TC veya telefon gerekli" };
      }
      return item;
    });

    if (hasBlockingReviewIssues(finalItems)) {
      setOcrError("Kayıt için Ad Soyad, Sigorta Türü ve TC veya Telefon alanlarından biri gerekli.");
      setOcrReviewItems(finalItems);
      return;
    }

    setLoading(true);
    setOcrError("");

    const policyType = reviewValue(ocrReviewItems, "policy_type");

    // Yalnız seçili ürünün alanları gönderilir — DASK'ta yanlışlıkla okunan
    // plaka gibi görünmeyen alanlar kayda sızmaz.
    const keys = visibleReviewKeys(policyType);
    if (!keys) {
      setOcrError("Lütfen önce poliçe türünü seçin.");
      setLoading(false);
      return;
    }
    const vis  = new Set(keys);
    const vval = (key: string) => (vis.has(key) ? reviewValue(ocrReviewItems, key) : "");

    const brandModelValue = [vval("vehicle_brand"), vval("vehicle_model")].filter(Boolean).join(" ");

    const fd = new FormData();
    fd.append("file", docFile);
    fd.append("name", vval("customer_name"));
    fd.append("phone", vval("phone"));
    fd.append("email", email.trim());
    fd.append("insurance_type", policyType);
    fd.append("note", note.trim());
    fd.append("tc_identity_no", vval("tc_identity_no"));
    fd.append("tax_no", vval("tax_no"));
    fd.append("identity_no", vval("tc_identity_no") || vval("tax_no"));
    fd.append("address", vval("address"));
    fd.append("vehicle_plate", vval("plate").toUpperCase());
    fd.append("license_serial", vval("license_serial"));
    fd.append("brand_model", brandModelValue);
    fd.append("vehicle_year", vval("vehicle_year"));
    fd.append("engine_no", vval("engine_no"));
    fd.append("chassis_no", vval("chassis_no"));
    fd.append("vehicle_value", vval("vehicle_value").replace(",", "."));
    fd.append("city", vval("city"));
    fd.append("district", vval("district"));
    fd.append("building_age", vval("building_age"));
    fd.append("area_m2", vval("area_m2"));
    fd.append("building_type", vval("building_type"));
    fd.append("housing_type", vval("housing_type"));
    fd.append("birth_date", vval("birth_date"));
    fd.append("gender", vval("gender"));
    fd.append("destination_country", vval("destination_country"));
    fd.append("policy_no", vval("policy_no"));
    fd.append("insurance_company", vval("insurance_company"));
    fd.append("premium", vval("premium").replace(",", "."));
    fd.append("policy_start_date", vval("start_date"));
    fd.append("policy_end_date", vval("end_date"));
    fd.append("ocr_provider", ocrProviderLabel);
    fd.append("ocr_mode", ocrMode ?? "");
    fd.append("ocr_raw_response", ocrRawResponse);
    if (effectiveAgencyId) fd.append("agency_id", effectiveAgencyId);

    const res = await fetch("/api/customers/from-policy", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (json.code === "limit_exceeded" || json.code === "policy_limit_exceeded" || json.code === "inactive") {
        setLimitOk(false);
        setLimitMsg(json.error);
      } else {
        setOcrError(json.error ?? "Kayıt sırasında bir hata oluştu.");
      }
      return;
    }

    setName(reviewValue(ocrReviewItems, "customer_name"));
    setPolicyEndDate(reviewValue(ocrReviewItems, "end_date"));
    setDocUploaded(Boolean(json.documentPath));
    setDone(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!limitOk) return;
    if (!name.trim() || !phone.trim() || !insuranceType) {
      setError("Ad, telefon ve sigorta türü zorunludur.");
      return;
    }
    if (isSuperAdmin && !selectedAgency) {
      setError("Süper admin olarak müşteri eklerken acente seçmelisiniz.");
      return;
    }
    setLoading(true);
    setError("");

    // Poliçe dosyası seçildiyse poliçe kaydı şart — bitiş tarihi olmadan
    // poliçe oluşmaz, dosyanın bağlanacağı kayıt kalmaz.
    if (docFile && !policyEndDate) {
      setError("Poliçe dosyası yüklemek için Poliçe Bitiş Tarihi girin (poliçe kaydı oluşturulması gerekir).");
      setLoading(false);
      return;
    }

    // Build extra_data from dynamic fields
    const extra: Record<string, string> = {};
    if (group === "vehicle") {
      if (plate)         extra.vehicle_plate   = plate.toUpperCase();
      if (licenseSerial) extra.license_serial  = licenseSerial;
      if (brandModel)    extra.brand_model     = brandModel;
      if (vehicleYear)   extra.vehicle_year    = vehicleYear;
      if (engineNo)      extra.engine_no       = engineNo;
      if (chassisNo)     extra.chassis_no      = chassisNo;
      if (address)       extra.address         = address;
    } else if (group === "health") {
      if (birthDate)  extra.birth_date    = birthDate;
      if (gender)     extra.gender        = gender;
      if (city)       extra.city          = city;
      if (healthNote) extra.health_note   = healthNote;
    } else if (group === "property") {
      if (propCity)     extra.city         = propCity;
      if (propDistrict) extra.district     = propDistrict;
      if (address)      extra.address      = address;
      if (buildingAge)  extra.building_age = buildingAge;
      if (areaM2)       extra.area_m2      = areaM2;
    } else {
      if (description) extra.description = description;
    }

    const identityNo = tcIdentityNo.trim() || taxNo.trim();

    if (entryMode === "policy" && docFile) {
      const fd = new FormData();
      fd.append("file", docFile);
      fd.append("name", name.trim());
      fd.append("phone", phone.trim());
      fd.append("email", email.trim());
      fd.append("insurance_type", insuranceType);
      fd.append("note", note.trim());
      fd.append("tc_identity_no", tcIdentityNo.trim());
      fd.append("tax_no", taxNo.trim());
      fd.append("identity_no", identityNo);
      fd.append("address", address.trim());
      fd.append("vehicle_plate", group === "vehicle" ? plate.trim().toUpperCase() : "");
      fd.append("license_serial", licenseSerial.trim());
      fd.append("brand_model", brandModel.trim());
      fd.append("vehicle_year", vehicleYear.trim());
      fd.append("engine_no", engineNo.trim());
      fd.append("chassis_no", chassisNo.trim());
      fd.append("policy_no", policyNo.trim());
      fd.append("insurance_company", insuranceCompany.trim());
      fd.append("premium", premium);
      fd.append("policy_start_date", policyStartDate);
      fd.append("policy_end_date", policyEndDate);
      if (effectiveAgencyId) fd.append("agency_id", effectiveAgencyId);

      const res = await fetch("/api/customers/from-policy", { method: "POST", body: fd });
      const json = await res.json();

      setLoading(false);

      if (!res.ok) {
        if (json.code === "limit_exceeded" || json.code === "policy_limit_exceeded" || json.code === "inactive") {
          setLimitOk(false);
          setLimitMsg(json.error);
        } else {
          setError(json.error ?? "Kayıt sırasında bir hata oluştu.");
        }
        return;
      }

      setDocUploaded(Boolean(json.documentPath));
      setDone(true);
      return;
    }

    const res = await fetch("/api/customers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:           name.trim(),
        phone:          phone.trim(),
        email:          email.trim() || null,
        insurance_type: insuranceType,
        note:           note.trim() || null,
        identity_no:    identityNo || null,
        vehicle_plate:  (group === "vehicle" ? plate.trim().toUpperCase() : null) || null,
        policy_end_date:policyEndDate || null,
        extra_data:     extra,
        agency_id:      effectiveAgencyId,
        // Poliçe bilgileri
        policy_no:         policyNo.trim() || null,
        insurance_company: insuranceCompany.trim() || null,
        premium:           premium || null,
        policy_start_date: policyStartDate || null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setLoading(false);
      if (json.code === "limit_exceeded" || json.code === "inactive") {
        setLimitOk(false);
        setLimitMsg(json.error);
      } else {
        setError(json.error ?? "Kayıt sırasında bir hata oluştu.");
      }
      return;
    }

    // ── Poliçe dosyasını yükle (müşteri + poliçe oluştuktan sonra) ──────────
    let uploaded = false;
    if (docFile && json.policyId) {
      try {
        const fd = new FormData();
        fd.append("policy_id", json.policyId);
        fd.append("file", docFile);
        const upRes = await fetch("/api/policy-documents", { method: "POST", body: fd });
        uploaded = upRes.ok;
        if (!upRes.ok) {
          const upJson = await upRes.json();
          setDocWarning(`Müşteri kaydedildi ancak dosya yüklenemedi: ${upJson.error ?? "bilinmeyen hata"}`);
        }
      } catch {
        setDocWarning("Müşteri kaydedildi ancak dosya yüklenemedi (bağlantı hatası).");
      }
    }

    setLoading(false);
    setDocUploaded(uploaded);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">Yeni Müşteri Ekle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Müşteri Eklendi</h3>
            <p className="text-sm text-gray-500 mb-4">
              {name} başarıyla sisteme kaydedildi.
              {policyEndDate && " Poliçe kaydı da oluşturuldu."}
              {docUploaded && " Poliçe dosyası yüklendi. 📄"}
            </p>
            {docWarning && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">⚠️ {docWarning}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                Kapat
              </button>
              <button onClick={() => { setDone(false); setName(""); setPhone(""); setEmail(""); setTcIdentityNo(""); setTaxNo(""); setNote(""); setInsuranceType(""); setPlate(""); setLicenseSerial(""); setBrandModel(""); setVehicleYear(""); setEngineNo(""); setChassisNo(""); setBirthDate(""); setGender(""); setCity(""); setHealthNote(""); setPropCity(""); setPropDistrict(""); setAddress(""); setBuildingAge(""); setAreaM2(""); setDescription(""); setPolicyNo(""); setInsuranceCompany(""); setPremium(""); setPolicyStartDate(""); setPolicyEndDate(""); setDocFile(null); setDocWarning(""); setDocUploaded(false); setOcrDone(false); setOcrError(""); setFieldStatus({}); setEntryMode("policy"); }}
                className="px-5 py-2 rounded-xl border border-gray-200 text-slate-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Yeni Müşteri
              </button>
            </div>
          </div>
        ) : !limitChecked ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : !limitOk ? (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">{limitMsg}</p>
            </div>
            <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Kapat
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">

            {/* ── Giriş yöntemi seçimi ───────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryMode("manual")}
                className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                  entryMode === "manual"
                    ? "border-blue-500 bg-blue-50/70 shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-200"
                }`}
              >
                <span className="text-lg block mb-1">👤</span>
                <span className="block text-sm font-bold text-slate-800">Manuel Giriş</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">Tüm bilgileri elle gir</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("policy")}
                className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                  entryMode === "policy"
                    ? "border-blue-500 bg-blue-50/70 shadow-sm"
                    : "border-gray-200 bg-white hover:border-blue-200"
                }`}
              >
                <span className="text-lg block mb-1">📄</span>
                <span className="block text-sm font-bold text-slate-800">Poliçe Yükle</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">PDF veya fotoğraftan bilgileri otomatik al</span>
              </button>
            </div>

            {/* ── OCR dropzone / loading (Poliçe Yükle modu) ────────────── */}
            {entryMode === "policy" && !ocrDone && (
              <div>
                {ocrLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40">
                    <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-blue-700">Poliçe okunuyor…</p>
                    <p className="text-[11px] text-blue-400">Sonuçlar önce inceleme ekranında gösterilecek</p>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => { e.preventDefault(); runOcr(e.dataTransfer.files?.[0] ?? null); }}
                    className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                  >
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => runOcr(e.target.files?.[0] ?? null)}
                    />
                    <span className="text-3xl">📄</span>
                    <span className="text-sm font-bold text-blue-600">Poliçeyi sürükleyip bırakın</span>
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-blue-100 text-xs font-bold text-blue-600 shadow-sm">
                      Dosya Seç
                    </span>
                    <span className="text-[11px] text-gray-400">PDF, JPG veya PNG — max 8MB</span>
                  </label>
                )}
                {ocrError && (
                  <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {ocrError}</p>
                )}
              </div>
            )}

            {/* ── OCR tamamlandı bildirimi ───────────────────────────────── */}
            {entryMode === "policy" && ocrDone && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-base">✅</span>
                  <p className="text-xs text-emerald-700 font-medium flex-1">
                    Poliçe okundu. Kaydetmeden önce kritik alanları kontrol edin.
                  </p>
                  <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full ${
                    ocrMode === "real" ? "bg-blue-600 text-white" : "bg-amber-100 text-amber-700"
                  }`}>
                    {ocrProviderLabel || (ocrMode === "real" ? "Gerçek OCR" : "Demo OCR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setOcrDone(false); setDocFile(null); setFieldStatus({}); setOcrReviewItems([]); setOcrRawResponse(""); setOcrMode(null); setTypeChipsOpen(false); }}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                  >
                    Yeni dosya
                  </button>
                </div>

                {/* ── Poliçe Türü: tespit edildiyse yalnız o tür, edilemediyse seçim ── */}
                <div className={`rounded-2xl border p-4 ${reviewKeys ? "border-gray-200 bg-white" : "border-amber-300 bg-amber-50/60"}`}>
                  {reviewKeys && !typeChipsOpen ? (
                    /* Tespit edilen tür — tek satır, diğer türler gösterilmez */
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-sm">
                        {INSURANCE_TYPES.find((t) => t.value === reviewType)?.label ?? reviewType}
                      </span>
                      {typeDetectedByOcr && (
                        <span className="px-1.5 py-px rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 text-[9px] font-bold">✓ OCR ile bulundu</span>
                      )}
                      <span className="flex-1 text-[11px] text-gray-400">
                        Yalnız <b className="text-slate-600">{reviewType}</b> alanları gösteriliyor.
                      </span>
                      <button
                        type="button"
                        onClick={() => setTypeChipsOpen(true)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        title="OCR türü yanlış okuduysa düzeltin"
                      >
                        Değiştir
                      </button>
                    </div>
                  ) : (
                    /* Tür seçimi — tespit edilemedi veya kullanıcı değiştirmek istedi */
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5">
                        {reviewKeys ? (
                          <span className="text-gray-400">Poliçe Türünü Seçiniz</span>
                        ) : (
                          <span className="text-amber-700 text-xs normal-case font-bold">⚠️ Poliçe türü tespit edilemedi — lütfen seçiniz</span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {INSURANCE_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => { updateReviewValue("policy_type", t.value); setTypeChipsOpen(false); }}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                              reviewType === t.value
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-600 border-gray-200 hover:border-blue-200 hover:text-blue-600"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {reviewKeys && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                  <div className="grid grid-cols-[1fr_1fr_90px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Bulunan Alan</span>
                    <span>OCR Değeri / Düzenle</span>
                    <span>Güven</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                    {visibleReviewItems.map((item) => {
                      const blocking = isBlockingReviewIssue(item, ocrReviewItems);
                      const optionalMissing = item.needsReview && !blocking;
                      return (
                        <div key={item.key} className="grid grid-cols-[1fr_1fr_90px] gap-2 px-3 py-2.5 items-start">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                            {blocking && (
                              <span className="inline-flex mt-1 px-1.5 py-px rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 text-[9px] font-bold">
                                Kritik eksik
                              </span>
                            )}
                            {optionalMissing && (
                              <span className="inline-flex mt-1 px-1.5 py-px rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[9px] font-bold">
                                Eksik bilgi (opsiyonel)
                              </span>
                            )}
                            {item.validationMessage && (
                              <p className={`mt-1 text-[10px] ${blocking ? "text-red-600" : "text-amber-600"}`}>{item.validationMessage}</p>
                            )}
                          </div>
                          <input
                            value={item.value}
                            onChange={(e) => updateReviewValue(item.key, e.target.value)}
                            placeholder="Bulunamadı"
                            className={`w-full px-2.5 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              blocking ? "border-red-200 bg-red-50/40" : optionalMissing ? "border-amber-200 bg-amber-50/30" : "border-gray-200"
                            }`}
                          />
                          <div className="text-right">
                            <p className={`text-xs font-extrabold ${
                              item.confidence >= 0.85 ? "text-emerald-600" : item.confidence >= 0.65 ? "text-amber-600" : "text-red-500"
                            }`}>
                              %{Math.round(item.confidence * 100)}
                            </p>
                            {item.userEdited && <p className="text-[9px] text-amber-600 font-bold mt-1">Düzenlendi</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {ocrError && (
                  <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {ocrError}</p>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={saveOcrReview}
                    disabled={loading || !reviewKeys}
                    title={!reviewKeys ? "Önce poliçe türünü seçin" : undefined}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? "Kaydediliyor..." : "Onayla ve Kaydet"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Form alanları: manuel modda hemen, poliçe modunda OCR sonrası ── */}
            <div className={entryMode === "policy" ? "hidden" : "space-y-5"}>

            {/* ── Acente seçimi (yalnız super_admin) ─────────────────────── */}
            {isSuperAdmin && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Acente</p>
                <Field label="Müşterinin ekleneceği acente *">
                  <select
                    value={selectedAgency}
                    onChange={(e) => setSelectedAgency(e.target.value)}
                    required
                    className={`${INPUT} bg-white`}
                  >
                    <option value="">Acente seçin…</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </Field>
                {agencies.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Aktif acente bulunamadı. Önce Acenteler ekranından bir acente oluşturun.
                  </p>
                )}
              </div>
            )}

            {/* ── Temel Bilgiler ─────────────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Temel Bilgiler</p>
              <div className="space-y-3">
                <Field label="Ad Soyad *" status={fieldStatus.name}>
                  <input value={name} onChange={(e) => { setName(e.target.value); touch("name"); }} required placeholder="Ahmet Yılmaz" className={INPUT} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefon *" status={fieldStatus.phone}>
                    <input value={phone} onChange={(e) => { setPhone(e.target.value); touch("phone"); }} required placeholder="0532 123 45 67" className={INPUT} />
                  </Field>
                  <Field label="TC Kimlik" optional status={fieldStatus.tc_identity_no}>
                    <input value={tcIdentityNo} onChange={(e) => { setTcIdentityNo(e.target.value); touch("tc_identity_no"); }} placeholder="12345678901" className={INPUT} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="VKN" optional status={fieldStatus.tax_no}>
                    <input value={taxNo} onChange={(e) => { setTaxNo(e.target.value); touch("tax_no"); }} placeholder="1234567890" className={INPUT} />
                  </Field>
                  <Field label="Adres" optional status={fieldStatus.address}>
                    <input value={address} onChange={(e) => { setAddress(e.target.value); touch("address"); }} placeholder="Poliçedeki adres" className={INPUT} />
                  </Field>
                </div>
                <Field label="E-posta" optional>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@email.com" className={INPUT} />
                </Field>
                <Field label="Not" optional>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Müşteri hakkında kısa not..." rows={2} className={`${INPUT} resize-none`} />
                </Field>
              </div>
            </div>

            {/* ── Sigorta Türü ───────────────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Sigorta Türü
                <StatusBadge status={fieldStatus.insurance_type} />
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INSURANCE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setInsuranceType(t.value); touch("insurance_type"); }}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                      insuranceType === t.value
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-600 border-gray-200 hover:border-blue-200 hover:text-blue-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Dynamic fields ─────────────────────────────────────────── */}
            {insuranceType && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {group === "vehicle" ? "Araç Bilgileri" : group === "health" ? "Sağlık Bilgileri" : group === "property" ? "Konut Bilgileri" : "Ek Bilgiler"}
                </p>
                <div className="space-y-3">

                  {group === "vehicle" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Plaka" optional status={fieldStatus.plate}>
                          <input value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); touch("plate"); }} placeholder="34ABC123" className={INPUT} />
                        </Field>
                        <Field label="Ruhsat Seri No" optional status={fieldStatus.license_serial}>
                          <input value={licenseSerial} onChange={(e) => { setLicenseSerial(e.target.value); touch("license_serial"); }} placeholder="AA 00000" className={INPUT} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Araç Marka / Model" optional status={fieldStatus.brand_model}>
                          <input value={brandModel} onChange={(e) => { setBrandModel(e.target.value); touch("brand_model"); }} placeholder="Hyundai Getz 1.4" className={INPUT} />
                        </Field>
                        <Field label="Araç Yılı" optional status={fieldStatus.vehicle_year}>
                          <input type="number" value={vehicleYear} onChange={(e) => { setVehicleYear(e.target.value); touch("vehicle_year"); }} placeholder="2020" min="1990" max="2030" className={INPUT} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Motor No" optional status={fieldStatus.engine_no}>
                          <input value={engineNo} onChange={(e) => { setEngineNo(e.target.value); touch("engine_no"); }} placeholder="G4EE6359743" className={INPUT} />
                        </Field>
                        <Field label="Şasi No" optional status={fieldStatus.chassis_no}>
                          <input value={chassisNo} onChange={(e) => { setChassisNo(e.target.value); touch("chassis_no"); }} placeholder="KMHBU51DP6U513670" className={INPUT} />
                        </Field>
                      </div>
                    </>
                  )}

                  {group === "health" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Doğum Tarihi" optional>
                          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={INPUT} />
                        </Field>
                        <Field label="Cinsiyet" optional>
                          <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${INPUT} bg-white`}>
                            <option value="">Seçin</option>
                            <option value="Erkek">Erkek</option>
                            <option value="Kadın">Kadın</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="İl" optional>
                        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" className={INPUT} />
                      </Field>
                      <Field label="Mevcut hastalık / not" optional>
                        <textarea value={healthNote} onChange={(e) => setHealthNote(e.target.value)} placeholder="Diyabet, tansiyon..." rows={2} className={`${INPUT} resize-none`} />
                      </Field>
                    </>
                  )}

                  {group === "property" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="İl" optional>
                          <input value={propCity} onChange={(e) => setPropCity(e.target.value)} placeholder="İstanbul" className={INPUT} />
                        </Field>
                        <Field label="İlçe" optional>
                          <input value={propDistrict} onChange={(e) => setPropDistrict(e.target.value)} placeholder="Kadıköy" className={INPUT} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Bina Yaşı" optional>
                          <input type="number" value={buildingAge} onChange={(e) => setBuildingAge(e.target.value)} placeholder="15" min="0" className={INPUT} />
                        </Field>
                        <Field label="Alan (m²)" optional>
                          <input type="number" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder="120" min="0" className={INPUT} />
                        </Field>
                      </div>
                    </>
                  )}

                  {group === "other" && (
                    <Field label="Açıklama" optional>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Sigorta detayları..." rows={3} className={`${INPUT} resize-none`} />
                    </Field>
                  )}

                </div>
              </div>
            )}

            {/* ── Poliçe Bilgileri (gerçek poliçeden) ───────────────────── */}
            {insuranceType && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Poliçe Bilgileri</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Poliçe No" optional status={fieldStatus.policy_no}>
                      <input value={policyNo} onChange={(e) => { setPolicyNo(e.target.value); touch("policy_no"); }} placeholder="74798326" className={INPUT} />
                    </Field>
                    <Field label="Sigorta Şirketi" optional status={fieldStatus.insurance_company}>
                      <input value={insuranceCompany} onChange={(e) => { setInsuranceCompany(e.target.value); touch("insurance_company"); }} placeholder="Ethica Sigorta" className={INPUT} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Başlangıç Tarihi" optional status={fieldStatus.start_date}>
                      <input type="date" value={policyStartDate} onChange={(e) => { handleStartDate(e.target.value); touch("start_date"); }} className={INPUT} />
                    </Field>
                    <Field label="Poliçe Bitiş Tarihi" optional status={fieldStatus.end_date}>
                      <input type="date" value={policyEndDate} onChange={(e) => { setPolicyEndDate(e.target.value); touch("end_date"); }} className={INPUT} />
                    </Field>
                  </div>
                  <Field label="Ödenecek Prim (₺)" optional status={fieldStatus.premium}>
                    <input type="number" step="0.01" min="0" value={premium} onChange={(e) => { setPremium(e.target.value); touch("premium"); }} placeholder="10153.10" className={INPUT} />
                  </Field>
                  {policyEndDate && (
                    <p className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      ✓ Poliçe kaydı da otomatik oluşturulacak.
                    </p>
                  )}

                  {/* ── Poliçe Dosyası Yükleme ─────────────────────────── */}
                  <Field label="Poliçe Dosyası" optional>
                    <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      docFile ? "border-emerald-300 bg-emerald-50/60" : "border-gray-200 hover:border-blue-300 bg-gray-50/60"
                    }`}>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                      />
                      {docFile ? (
                        <>
                          <span className="text-lg">📄</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-emerald-700 truncate">{docFile.name}</span>
                            <span className="block text-[10px] text-emerald-600">{(docFile.size / 1024 / 1024).toFixed(2)} MB — değiştirmek için tıklayın</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setDocFile(null); }}
                            className="text-gray-400 hover:text-red-500 text-sm px-1"
                            title="Dosyayı kaldır"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-lg">📎</span>
                          <span className="text-xs text-gray-500">
                            <span className="font-semibold text-blue-600">PDF poliçeyi yükleyin</span> — PDF, JPG veya PNG (max 8MB)
                          </span>
                        </>
                      )}
                    </label>
                  </Field>
                  {docWarning && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ {docWarning}</p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl leading-relaxed">
                <span className="font-semibold block mb-0.5">Hata</span>
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button type="submit" disabled={loading || !insuranceType}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                {loading ? "Kaydediliyor..." : "Müşteri Ekle"}
              </button>
            </div>

            </div>{/* /form alanları wrapper */}
          </form>
        )}
      </div>
    </div>
  );
}
