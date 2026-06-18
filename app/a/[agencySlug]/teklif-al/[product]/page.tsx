"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { findProduct, categoryOf, type FieldDef } from "@/lib/insurance-products";

type Agency = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  primary_color: string;
  is_active: boolean | null;
};

import { normalizePhone, isValidTrMobile } from "@/lib/phone";
function validateTcVkn(val: string): string | null {
  if (!val) return null;
  const d = val.replace(/\D/g, "");
  if (d.length === 0)  return "TC/VKN yalnızca rakam içermelidir.";
  if (d.length === 11 || d.length === 10) return null;
  return "TC Kimlik 11 hane, VKN 10 hane olmalıdır.";
}
const PLAKA_RE = /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-Z]{1,3}\s?\d{2,4}$/i;
function normalizePlaka(v: string) { return v.replace(/\s/g, "").toUpperCase(); }
function isValidPlaka(v: string) { return PLAKA_RE.test(v.trim()); }
function calcAge(dob: string): number {
  const birth = new Date(dob), today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
function buildNoteLines(fields: FieldDef[], values: Record<string, string>): string {
  const skip = new Set(["name", "phone", "kvkk"]);
  return fields.filter((f) => !skip.has(f.id) && values[f.id]).map((f) => `${f.label}: ${values[f.id]}`).join("\n");
}
function validateFields(fields: FieldDef[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const val = (values[f.id] ?? "").trim();
    if (f.required && !f.optional && f.type !== "checkbox" && !val) { errors[f.id] = "Bu alan zorunludur."; continue; }
    if (f.id === "kvkk" && values[f.id] !== "true") { errors[f.id] = "Devam etmek için onay vermeniz gerekir."; continue; }
    if (!val) continue;
    if (f.id === "phone"        && !isValidTrMobile(val))   { errors[f.id] = "Geçerli bir Türkiye cep numarası girin."; continue; }
    if (f.id === "tc_vkn")      { const e = validateTcVkn(val); if (e) errors[f.id] = e; continue; }
    if (f.id === "plaka"        && !isValidPlaka(val))   { errors[f.id] = "Geçerli bir Türk plakası girin."; continue; }
    if (f.id === "dogum_tarihi" && calcAge(val) < 18)    { errors[f.id] = "18 yaşından büyük olmanız gerekir."; continue; }
  }
  return errors;
}

// ─── FieldInput ───────────────────────────────────────────────────────────────
function FieldInput({ field, value, error, onChange }: { field: FieldDef; value: string; error?: string; onChange: (v: string) => void }) {
  const base = "w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 bg-white " +
    (error ? "border-red-300 focus:ring-red-400" : "border-gray-200 focus:ring-blue-500 focus:border-blue-400");

  if (field.type === "select") return (
    <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seçiniz...</option>
      {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if (field.type === "radio") return (
    <div className="flex gap-4 flex-wrap">
      {field.options?.map((o) => (
        <label key={o.value} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={field.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="w-4 h-4 accent-blue-600" />
          <span className="text-sm text-slate-700">{o.label}</span>
        </label>
      ))}
    </div>
  );
  if (field.type === "checkbox") return (
    <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${error ? "border-red-200 bg-red-50" : value === "true" ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"}`}>
      <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} className="w-4 h-4 mt-0.5 accent-blue-600 flex-shrink-0" />
      <span className="text-xs text-gray-600 leading-relaxed">{field.label}</span>
    </label>
  );
  if (field.type === "textarea") return <textarea className={`${base} resize-none h-20`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  return <input type={field.type} className={base} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgencyProductFormPage({
  params,
}: {
  params: Promise<{ agencySlug: string; product: string }>;
}) {
  const { agencySlug, product: slug } = use(params);
  const product  = findProduct(slug);
  const category = categoryOf(slug);

  const [agency, setAgency]         = useState<Agency | null>(null);
  const [fetching, setFetching]     = useState(true);
  const [values, setValues]         = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  // Fetch agency
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("id, name, slug, logo_url, phone, primary_color, is_active")
      .eq("slug", agencySlug)
      .maybeSingle()
      .then(({ data }: { data: Agency | null }) => {
        setAgency(data);
        setFetching(false);
      });
  }, [agencySlug]);

  if (!product) notFound();
  const p = product!;
  const color = agency?.primary_color ?? "#2563eb";

  function setField(id: string, val: string) {
    setValues((prev) => ({ ...prev, [id]: val }));
    if (fieldErrors[id]) setFieldErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function getNormalized(): Record<string, string> {
    const out = { ...values };
    if (out.phone)  out.phone  = normalizePhone(out.phone);
    if (out.plaka)  out.plaka  = normalizePlaka(out.plaka);
    if (out.tc_vkn) out.tc_vkn = out.tc_vkn.replace(/\D/g, "");
    return out;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
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
      const normalized = getNormalized();
      const noteLines  = buildNoteLines(p.fields, normalized);

      // Build extra_data from normalized form values
      const extraData: Record<string, string> = {};
      p.fields.forEach((f) => {
        if (!["name","phone","kvkk"].includes(f.id) && normalized[f.id]) {
          extraData[f.id] = normalized[f.id];
        }
      });

      // ── Route through server-side API (enforces limits + is_active) ──────
      const res = await fetch("/api/public/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencySlug,
          name:           normalized.name ?? "",
          phone:          normalized.phone,
          insurance_type: p.label,
          note:           noteLines || null,
          vehicle_plate:  normalized.plaka || null,
          extra_data:     extraData,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        // is_active=false, limit exceeded, or not found
        setSubmitError(json.error ?? "Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
        return;
      }

      setDone(true);
    } catch (err: unknown) {
      setSubmitError(`Beklenmeyen hata: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  if (!agency) notFound();

  // Inactive agency: show closed message
  if (agency.is_active === false) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-3xl mx-auto mb-5">🔒</div>
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">Teklif Kabul Edilmiyor</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          <span className="font-semibold text-slate-700">{agency.name}</span> şu anda teklif kabul etmiyor.
          Lütfen acenteyi doğrudan arayın.
        </p>
        {agency.phone && (
          <a href={`tel:${agency.phone}`}
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: color }}>
            📞 {agency.phone}
          </a>
        )}
      </div>
    </div>
  );

  // Thank-you screen
  if (done) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-5">✅</div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Talebiniz Alındı!</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-3">
          Talebiniz{" "}
          <span className="font-semibold text-slate-800">{agency!.name}</span>
          {" "}acentesine iletildi.
        </p>
        <p className="text-gray-400 text-xs mb-8">
          Yetkili sigorta danışmanımız kısa süre içinde{" "}
          <span className="font-semibold text-emerald-600">WhatsApp</span> üzerinden size dönüş yapacaktır.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/a/${agencySlug}/teklif-al`} className="px-6 py-2.5 text-white font-semibold rounded-xl text-sm transition-colors" style={{ backgroundColor: color }}>
            Başka Teklif Al
          </Link>
        </div>
      </div>
    </div>
  );

  // Form
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agency!.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency!.logo_url} alt={agency!.name} className="h-7 w-auto" />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
                {agency!.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-extrabold text-lg text-slate-900">{agency!.name}</span>
          </div>
          <Link href={`/a/${agencySlug}/teklif-al`} className="text-sm text-gray-500 hover:text-blue-700 transition-colors flex items-center gap-1">
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
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
              {p.icon}
            </div>
            <div>
              {category && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{category.label}</p>}
              <h1 className="text-xl font-extrabold text-slate-900">{p.label}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 mb-5">Teklif Formu</h2>
          {submitError && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-sm text-red-700 font-medium">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {p.fields.map((field) => {
              const fieldErr = fieldErrors[field.id];
              if (field.type === "checkbox") return (
                <div key={field.id}>
                  <FieldInput field={field} value={values[field.id] ?? ""} error={fieldErr} onChange={(v) => setField(field.id, v)} />
                  {fieldErr && <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErr}</p>}
                </div>
              );
              return (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {field.label}
                    {field.optional && <span className="ml-1 text-gray-400 font-normal">(isteğe bağlı)</span>}
                    {field.required && !field.optional && <span className="ml-0.5 text-red-400">*</span>}
                  </label>
                  <div id={field.id}>
                    <FieldInput field={field} value={values[field.id] ?? ""} error={fieldErr} onChange={(v) => setField(field.id, v)} />
                  </div>
                  {fieldErr && <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1"><span>⚠</span> {fieldErr}</p>}
                  {!fieldErr && field.hint && <p className="mt-1 text-xs text-gray-400">{field.hint}</p>}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: color }}
            >
              {submitting ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" /></svg>Gönderiliyor...</>
              ) : "Teklif Talep Et →"}
            </button>
            <p className="text-center text-xs text-gray-400">Formunuz 256-bit SSL ile şifrelenerek iletilmektedir.</p>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[{ icon: "⚡", label: "15 dk. dönüş" }, { icon: "🔒", label: "KVKK güvenceli" }, { icon: "💰", label: "Ücretsiz hizmet" }].map((item) => (
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
