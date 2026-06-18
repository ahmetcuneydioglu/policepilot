"use client";

import { useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct, categoryOf, type FieldDef } from "@/lib/insurance-products";
import { supabase } from "@/lib/supabase";

import { normalizePhone, isValidTrMobile } from "@/lib/phone";

// ─── TC / VKN ─────────────────────────────────────────────────────────────────
// Format only — real checksum validation requires SBM / Nüfus Müdürlüğü API.
function validateTcVkn(val: string): string | null {
  if (!val) return null;              // empty optional field
  const d = val.replace(/\D/g, "");
  if (d.length === 0)  return "TC/VKN yalnızca rakam içermelidir.";
  if (d.length === 11) return null;   // TC: 11 digits OK
  if (d.length === 10) return null;   // VKN: 10 digits OK
  return "TC Kimlik 11 hane, Vergi Kimlik No 10 hane olmalıdır (yalnızca rakam).";
}

// ─── Plaka ────────────────────────────────────────────────────────────────────
// Accepted: 34ABC123 | 34 AB 123 | 06ABC45 | 34 A 1234
// NOTE: Gerçek araç doğrulaması için SBM / TRAMER API entegrasyonu gerekir.
const PLAKA_RE = /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-Z]{1,3}\s?\d{2,4}$/i;

function normalizePlaka(val: string): string {
  return val.replace(/\s/g, "").toUpperCase();
}

function isValidPlaka(val: string): boolean {
  return PLAKA_RE.test(val.trim());
}

// ─── Age ──────────────────────────────────────────────────────────────────────
function calcAge(dob: string): number {
  if (!dob) return 99;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Note builder ─────────────────────────────────────────────────────────────
function buildNoteLines(fields: FieldDef[], values: Record<string, string>): string {
  const skip = new Set(["name", "phone", "kvkk"]);
  return fields
    .filter((f) => !skip.has(f.id) && values[f.id])
    .map((f) => `${f.label}: ${values[f.id]}`)
    .join("\n");
}

// ─── Supabase error description ───────────────────────────────────────────────
function describeSupabaseError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (e.message) parts.push(`message: ${e.message}`);
  if (e.details) parts.push(`details: ${e.details}`);
  if (e.hint)    parts.push(`hint: ${e.hint}`);
  if (e.code)    parts.push(`code: ${e.code}`);
  return parts.join(" | ") || JSON.stringify(err);
}

// ─── Field-level validation ───────────────────────────────────────────────────
function validateFields(
  fields: FieldDef[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const val = (values[f.id] ?? "").trim();

    // Required check (excluding optional and checkbox handled separately)
    if (f.required && !f.optional && f.type !== "checkbox" && !val) {
      errors[f.id] = "Bu alan zorunludur.";
      continue;
    }

    // KVKK checkbox
    if (f.id === "kvkk" && values[f.id] !== "true") {
      errors[f.id] = "Devam etmek için onay vermeniz gerekir.";
      continue;
    }

    if (!val) continue; // optional empty — skip further checks

    // Phone
    if (f.id === "phone") {
      if (!isValidTrMobile(val)) {
        errors[f.id] =
          "Geçerli bir Türkiye cep numarası girin. (05xxxxxxxxx / +905xxxxxxxxx)";
      }
      continue;
    }

    // TC / VKN
    if (f.id === "tc_vkn") {
      const err = validateTcVkn(val);
      if (err) errors[f.id] = err;
      continue;
    }

    // Plaka
    if (f.id === "plaka") {
      if (!isValidPlaka(val)) {
        errors[f.id] =
          "Geçerli bir Türk plakası girin. (Örn: 34ABC123 veya 34 AB 123)";
      }
      continue;
    }

    // Age — doğum_tarihi field
    if (f.id === "dogum_tarihi") {
      if (calcAge(val) < 18) {
        errors[f.id] =
          "Teklif talebi oluşturmak için 18 yaşından büyük olmanız gerekir.";
      }
      continue;
    }
  }

  return errors;
}

// ─── FieldInput component ─────────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 " +
    "focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 bg-white " +
    (error
      ? "border-red-300 focus:ring-red-400 focus:border-red-400"
      : "border-gray-200 focus:ring-blue-500 focus:border-blue-400");

  if (field.type === "select") {
    return (
      <select
        className={base}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seçiniz...</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return (
      <div className="flex gap-4 flex-wrap">
        {field.options?.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field.id}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-slate-700">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label
        className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${
          error
            ? "border-red-200 bg-red-50"
            : value === "true"
            ? "border-blue-200 bg-blue-50"
            : "border-gray-100 bg-gray-50"
        }`}
      >
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "")}
          className="w-4 h-4 mt-0.5 accent-blue-600 flex-shrink-0"
        />
        <span className="text-xs text-gray-600 leading-relaxed">{field.label}</span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${base} resize-none h-20`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <input
      type={field.type}
      className={base}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductFormPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product: slug } = use(params);
  const product = findProduct(slug);
  const category = categoryOf(slug);

  const [values, setValues]       = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]           = useState(false);

  if (!product) notFound();

  // TS can't narrow through a conditional call, assert after notFound()
  const p   = product!;
  const cat = category;

  function setField(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
    // Clear field error on change
    if (fieldErrors[id]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  // Normalize special fields before storage
  function getNormalizedValues(): Record<string, string> {
    const out = { ...values };
    if (out.phone)  out.phone  = normalizePhone(out.phone);
    if (out.plaka)  out.plaka  = normalizePlaka(out.plaka);
    if (out.tc_vkn) out.tc_vkn = out.tc_vkn.replace(/\D/g, "");
    return out;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    // ── Client-side validation ───────────────────────────────────────────
    const errors = validateFields(p.fields, values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstId = p.fields.find((f) => errors[f.id])?.id;
      if (firstId) document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const normalized = getNormalizedValues();
      const phone      = normalized.phone;
      // Extra form fields (plaka, TC, araç yılı vb.) put into note as plain text
      const noteLines  = buildNoteLines(p.fields, normalized);

      // ── Step 1: Insert customer directly — no lookup, no upsert ─────────
      const { data: customer, error: customerError } = await (supabase.from("customers") as any)
        .insert({
          name:           normalized.name ?? "",
          phone,
          insurance_type: p.label,
          note:           noteLines || null,
        })
        .select("id")
        .single();

      if (customerError) {
        const e = customerError as { message?: string; code?: string; details?: string };
        const parts = [
          e.message  && `message: ${e.message}`,
          e.code     && `code: ${e.code}`,
          e.details  && `details: ${e.details}`,
        ].filter(Boolean).join(" | ");
        setSubmitError(`Müşteri kayıt hatası: ${parts}`);
        return;
      }

      // ── Step 2: Insert request — only known requests table columns ───────
      const { error: requestError } = await (supabase.from("requests") as any)
        .insert({
          customer_id:  (customer as { id: string }).id,
          request_type: p.label,
          status:       "Yeni",
          price_offer:  null,
        });

      if (requestError) {
        const e = requestError as { message?: string; code?: string; details?: string };
        const parts = [
          e.message  && `message: ${e.message}`,
          e.code     && `code: ${e.code}`,
          e.details  && `details: ${e.details}`,
        ].filter(Boolean).join(" | ");
        setSubmitError(`Talep oluşturma hatası: ${parts}`);
        return;
      }

      setDone(true);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("TEKLIF_SUBMIT_UNEXPECTED", err);
      setSubmitError(`Beklenmeyen hata: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Thank-you screen ──────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-5">✅</div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Talebiniz Alındı!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Acente yetkilimiz kısa süre içinde{" "}
            <span className="font-semibold text-emerald-700">WhatsApp</span> üzerinden size dönüş yapacak.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/teklif-al"
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Başka Teklif Al
            </Link>
            <Link href="/" className="px-6 py-2.5 text-gray-500 text-sm hover:text-slate-800 transition-colors">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ──────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex items-start sm:items-center gap-2 text-xs text-amber-800">
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <span className="font-semibold">Demo formu:</span> Bu form genel tanıtım amaçlıdır. Gerçek acente teklif akışı{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">/a/[acente-linki]/teklif-al</code> üzerinden çalışır.
          </span>
        </div>
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg text-blue-700">
            <span>🛡️</span>SigortaOS
          </Link>
          <Link
            href="/teklif-al"
            className="text-sm text-gray-500 hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Geri
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Product header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl flex-shrink-0">
              {p.icon}
            </div>
            <div>
              {cat && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                  {cat.label}
                </p>
              )}
              <h1 className="text-xl font-extrabold text-slate-900">{p.label}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-5">Teklif Formu</h2>

          {/* Submit-level error banner */}
          {submitError && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-sm text-red-700 font-medium">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {p.fields.map((field) => {
              const fieldErr = fieldErrors[field.id];

              if (field.type === "checkbox") {
                return (
                  <div key={field.id}>
                    <FieldInput
                      field={field}
                      value={values[field.id] ?? ""}
                      error={fieldErr}
                      onChange={(v) => setField(field.id, v)}
                    />
                    {fieldErr && (
                      <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErr}</p>
                    )}
                  </div>
                );
              }

              return (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    {field.label}
                    {field.optional && (
                      <span className="ml-1 text-gray-400 font-normal">(isteğe bağlı)</span>
                    )}
                    {field.required && !field.optional && (
                      <span className="ml-0.5 text-red-400">*</span>
                    )}
                  </label>
                  <div id={field.id}>
                    <FieldInput
                      field={field}
                      value={values[field.id] ?? ""}
                      error={fieldErr}
                      onChange={(v) => setField(field.id, v)}
                    />
                  </div>
                  {fieldErr && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠</span> {fieldErr}
                    </p>
                  )}
                  {!fieldErr && field.hint && (
                    <p className="mt-1 text-xs text-gray-400">{field.hint}</p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
                  </svg>
                  Gönderiliyor...
                </>
              ) : (
                "Teklif Talep Et →"
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              Formunuz 256-bit SSL ile şifrelenerek iletilmektedir.
            </p>
          </form>
        </div>

        {/* Reassurance strip */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "⚡", label: "15 dk. dönüş" },
            { icon: "🔒", label: "KVKK güvenceli" },
            { icon: "💰", label: "Ücretsiz hizmet" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 py-3 px-2">
              <p className="text-xl">{item.icon}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
