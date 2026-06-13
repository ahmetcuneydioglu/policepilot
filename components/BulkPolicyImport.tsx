"use client";

/**
 * PolicePilot — Toplu Poliçe İçe Aktarma
 *
 * Acente onboarding'i için: çoklu PDF/JPG/PNG seç → her dosya sırayla
 * /api/ocr/policy ile okunur (ilerleme çubuğu) → düzenlenebilir tablo →
 * "Hepsini Kaydet" her satırı /api/customers/from-policy'ye gönderir.
 *
 * Mimari notlar:
 * - OCR tek tek (client orchestration) → Vercel süre limiti aşılmaz.
 * - Müşteri eşleştirme (TC/telefon) sunucuda yapılır; mükerrer müşteri olmaz.
 * - Mevcut tekli akışla aynı endpoint'leri kullanır — yeni OCR motoru yok.
 */

import { useState, useCallback } from "react";
import { KNOWN_POLICY_TYPES } from "@/lib/ocr/validation";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 8 * 1024 * 1024;

type RowStatus = "queued" | "reading" | "ready" | "ocr_error" | "saving" | "saved" | "save_error";

// Satır verisi — OCR alanları düz string olarak tutulur, tabloda düzenlenir
type RowData = {
  name: string; phone: string; tc_identity_no: string; tax_no: string;
  address: string; plate: string; license_serial: string;
  brand_model: string; vehicle_year: string; engine_no: string; chassis_no: string;
  vehicle_value: string; city: string; district: string; building_age: string;
  area_m2: string; building_type: string; housing_type: string;
  birth_date: string; gender: string; destination_country: string;
  policy_type: string; policy_no: string; insurance_company: string;
  premium: string; start_date: string; end_date: string;
};

type Row = {
  id: string;
  file: File;
  status: RowStatus;
  data: RowData;
  error?: string;
  matched?: boolean;
  ocrMode?: string;
  ocrProvider?: string;
  rawResponse?: string;
};

const EMPTY_DATA: RowData = {
  name: "", phone: "", tc_identity_no: "", tax_no: "", address: "", plate: "",
  license_serial: "", brand_model: "", vehicle_year: "", engine_no: "", chassis_no: "",
  vehicle_value: "", city: "", district: "", building_age: "", area_m2: "",
  building_type: "", housing_type: "", birth_date: "", gender: "", destination_country: "",
  policy_type: "", policy_no: "", insurance_company: "", premium: "", start_date: "", end_date: "",
};

// OCR alan adı → satır alan adı eşlemesi (value alınarak)
function ocrToRow(fields: Record<string, { value: string | null }>): RowData {
  const v = (k: string) => (fields[k]?.value ?? "").toString().trim();
  const brand = v("vehicle_brand"), model = v("vehicle_model");
  return {
    ...EMPTY_DATA,
    name:              v("customer_name"),
    phone:             v("phone"),
    tc_identity_no:    v("tc_identity_no"),
    tax_no:            v("tax_no"),
    address:           v("address"),
    plate:             v("plate").toUpperCase(),
    license_serial:    v("license_serial"),
    brand_model:       [brand, model].filter(Boolean).join(" "),
    vehicle_year:      v("vehicle_year"),
    engine_no:         v("engine_no"),
    chassis_no:        v("chassis_no"),
    vehicle_value:     v("vehicle_value"),
    city:              v("city"),
    district:          v("district"),
    building_age:      v("building_age"),
    area_m2:           v("area_m2"),
    building_type:     v("building_type"),
    housing_type:      v("housing_type"),
    birth_date:        v("birth_date"),
    gender:            v("gender"),
    destination_country: v("destination_country"),
    policy_type:       v("policy_type"),
    policy_no:         v("policy_no"),
    insurance_company: v("insurance_company"),
    premium:           v("premium"),
    start_date:        v("start_date"),
    end_date:          v("end_date"),
  };
}

function isValidRow(r: Row): boolean {
  // Kritik: ad + poliçe türü; ayrıca telefon VEYA geçerli TC
  if (!r.data.name.trim() || !r.data.policy_type) return false;
  const hasPhone = Boolean(r.data.phone.trim());
  const hasTc = /^\d{11}$/.test(r.data.tc_identity_no.replace(/\D/g, ""));
  return hasPhone || hasTc;
}

export default function BulkPolicyImport({
  agencyId, role, onClose, onDone,
}: {
  agencyId: string | null;
  role: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgency, setSelectedAgency] = useState("");
  const isSuperAdmin = role === "super_admin";

  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"select" | "review" | "done">("select");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{ saved: number; matched: number; failed: number } | null>(null);

  // Super admin için acente listesi (lazy)
  const loadAgencies = useCallback(async () => {
    if (!isSuperAdmin || agencies.length) return;
    const { supabase } = await import("@/lib/supabase");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("agencies") as any).select("id, name").eq("is_active", true).order("name");
    setAgencies(data ?? []);
  }, [isSuperAdmin, agencies.length]);

  const effectiveAgencyId = isSuperAdmin ? (selectedAgency || null) : (agencyId ?? null);

  // ── Dosya seçimi ───────────────────────────────────────────────────────────
  function pickFiles(files: FileList | null) {
    setError("");
    if (!files || files.length === 0) return;
    const accepted: Row[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED.includes(f.type)) { rejected.push(`${f.name} (tür)`); continue; }
      if (f.size > MAX_BYTES) { rejected.push(`${f.name} (8MB+)`); continue; }
      accepted.push({ id: `${f.name}-${f.size}-${Math.round(f.lastModified)}`, file: f, status: "queued", data: { ...EMPTY_DATA } });
    }
    if (rejected.length) setError(`Atlanan: ${rejected.join(", ")}`);
    if (accepted.length === 0) return;
    // Aynı dosyayı iki kez ekleme
    setRows(prev => {
      const seen = new Set(prev.map(r => r.id));
      return [...prev, ...accepted.filter(a => !seen.has(a.id))];
    });
  }

  // ── OCR: dosyaları SIRAYLA oku (timeout güvenli) ──────────────────────────
  async function runOcr() {
    if (isSuperAdmin && !selectedAgency) { setError("Önce acente seçin."); return; }
    setReading(true);
    setError("");
    setPhase("review");

    for (const row of rows) {
      if (row.status !== "queued") continue;
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "reading" } : r));
      try {
        const fd = new FormData();
        fd.append("file", row.file);
        const res = await fetch("/api/ocr/policy", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "OCR başarısız");
        const data = ocrToRow(json.fields ?? {});
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r, status: "ready", data,
          ocrMode: json.mode, ocrProvider: json.providerLabel,
          rawResponse: JSON.stringify(json.raw_response ?? json.fields ?? {}),
        } : r));
      } catch (e) {
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r, status: "ocr_error", error: e instanceof Error ? e.message : "OCR hatası",
        } : r));
      }
    }
    setReading(false);
  }

  function updateCell(id: string, key: keyof RowData, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, data: { ...r.data, [key]: value } } : r));
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  // ── Toplu kaydet: SIRAYLA from-policy ─────────────────────────────────────
  async function saveAll() {
    const valid = rows.filter(r => (r.status === "ready" || r.status === "save_error") && isValidRow(r));
    if (valid.length === 0) { setError("Kaydedilecek geçerli satır yok (ad, tür ve TC/telefon gerekli)."); return; }
    setSaving(true);
    setError("");

    let saved = 0, matched = 0, failed = 0;
    for (const row of valid) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "saving" } : r));
      try {
        const d = row.data;
        const fd = new FormData();
        fd.append("file", row.file);
        fd.append("name", d.name);
        fd.append("phone", d.phone);
        fd.append("insurance_type", d.policy_type);
        fd.append("tc_identity_no", d.tc_identity_no);
        fd.append("tax_no", d.tax_no);
        fd.append("identity_no", d.tc_identity_no || d.tax_no);
        fd.append("address", d.address);
        fd.append("vehicle_plate", d.plate.toUpperCase());
        fd.append("license_serial", d.license_serial);
        fd.append("brand_model", d.brand_model);
        fd.append("vehicle_year", d.vehicle_year);
        fd.append("engine_no", d.engine_no);
        fd.append("chassis_no", d.chassis_no);
        fd.append("vehicle_value", d.vehicle_value.replace(",", "."));
        fd.append("city", d.city);
        fd.append("district", d.district);
        fd.append("building_age", d.building_age);
        fd.append("area_m2", d.area_m2);
        fd.append("building_type", d.building_type);
        fd.append("housing_type", d.housing_type);
        fd.append("birth_date", d.birth_date);
        fd.append("gender", d.gender);
        fd.append("destination_country", d.destination_country);
        fd.append("policy_no", d.policy_no);
        fd.append("insurance_company", d.insurance_company);
        fd.append("premium", d.premium.replace(",", "."));
        fd.append("policy_start_date", d.start_date);
        fd.append("policy_end_date", d.end_date);
        fd.append("ocr_provider", row.ocrProvider ?? "");
        fd.append("ocr_mode", row.ocrMode ?? "");
        fd.append("ocr_raw_response", row.rawResponse ?? "");
        if (effectiveAgencyId) fd.append("agency_id", effectiveAgencyId);

        const res = await fetch("/api/customers/from-policy", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Kayıt başarısız");
        saved++;
        if (json.customerMatched) matched++;
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "saved", matched: json.customerMatched } : r));
      } catch (e) {
        failed++;
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: "save_error", error: e instanceof Error ? e.message : "Kayıt hatası" } : r));
      }
    }
    setSaving(false);
    setSummary({ saved, matched, failed });
    setPhase("done");
    onDone();
  }

  const readyCount = rows.filter(r => r.status === "ready" || r.status === "saved" || r.status === "save_error").length;
  const validCount = rows.filter(r => (r.status === "ready" || r.status === "save_error") && isValidRow(r)).length;

  const INPUT = "w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">📦 Toplu Poliçe İçe Aktar</h2>
            <p className="text-xs text-gray-400 mt-0.5">Birden çok poliçeyi OCR ile okuyup tek seferde kaydedin</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── DONE ── */}
        {phase === "done" && summary ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">İçe aktarma tamamlandı</h3>
            <p className="text-sm text-gray-500 mb-1">
              <b className="text-emerald-600">{summary.saved}</b> poliçe kaydedildi
              {summary.matched > 0 && <> · <b className="text-blue-600">{summary.matched}</b> mevcut müşteriye eklendi</>}
            </p>
            {summary.failed > 0 && <p className="text-sm text-rose-600 mb-3">{summary.failed} satır kaydedilemedi (tabloda işaretli)</p>}
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">Kapat</button>
              {summary.failed > 0 && (
                <button onClick={() => setPhase("review")} className="px-5 py-2 rounded-xl border border-gray-200 text-slate-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Hataları Gör</button>
              )}
            </div>
          </div>

        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Super admin acente seçimi */}
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Acente *</label>
                <select
                  value={selectedAgency}
                  onChange={e => setSelectedAgency(e.target.value)}
                  onFocus={loadAgencies}
                  className="w-full max-w-sm px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                >
                  <option value="">Acente seçin…</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            {/* Dosya seçimi */}
            <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); pickFiles(e.dataTransfer.files); }}
            >
              <input type="file" accept="application/pdf,image/jpeg,image/png" multiple className="hidden" onChange={e => pickFiles(e.target.files)} />
              <span className="text-3xl">📎</span>
              <span className="text-sm font-bold text-blue-600">Poliçeleri sürükleyin veya seçin</span>
              <span className="text-[11px] text-gray-400">Birden çok PDF / JPG / PNG — her biri max 8MB</span>
            </label>

            {error && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ {error}</p>}

            {/* Aksiyon barı */}
            {rows.length > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-500">
                  <b className="text-slate-700">{rows.length}</b> dosya
                  {readyCount > 0 && <> · {readyCount} okundu</>}
                  {validCount > 0 && <> · <b className="text-emerald-600">{validCount} kayda hazır</b></>}
                </p>
                <div className="flex items-center gap-2">
                  {phase === "select" && (
                    <button onClick={runOcr} disabled={reading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50">
                      {reading ? "Okunuyor…" : `${rows.length} Poliçeyi Oku`}
                    </button>
                  )}
                  {phase === "review" && (
                    <button onClick={saveAll} disabled={saving || reading || validCount === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-50">
                      {saving ? "Kaydediliyor…" : `${validCount} Poliçeyi Kaydet`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* İlerleme çubuğu */}
            {(reading || saving) && (
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${Math.round((readyCount / Math.max(1, rows.length)) * 100)}%` }} />
              </div>
            )}

            {/* Tablo */}
            {rows.length > 0 && phase !== "select" && (
              <div className="rounded-2xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["Durum", "Ad Soyad *", "Tür *", "Telefon", "TC", "Şirket", "Prim", "Başlangıç", "Bitiş", ""].map(h => (
                        <th key={h} className="text-left px-2.5 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map(r => {
                      const valid = isValidRow(r);
                      const statusUI =
                        r.status === "reading" ? <span className="text-violet-600">⏳ okunuyor</span> :
                        r.status === "ocr_error" ? <span className="text-rose-600" title={r.error}>❌ OCR</span> :
                        r.status === "saving" ? <span className="text-blue-600">💾 kaydediliyor</span> :
                        r.status === "saved" ? <span className="text-emerald-600">{r.matched ? "✓ eklendi" : "✓ kaydedildi"}</span> :
                        r.status === "save_error" ? <span className="text-rose-600" title={r.error}>❌ kayıt</span> :
                        r.status === "queued" ? <span className="text-slate-400">bekliyor</span> :
                        valid ? <span className="text-emerald-600">● hazır</span> : <span className="text-amber-600">● eksik</span>;

                      const disabled = r.status === "saving" || r.status === "saved" || r.status === "reading";
                      return (
                        <tr key={r.id} className={`${!valid && r.status === "ready" ? "bg-amber-50/40" : ""} ${r.status === "ocr_error" || r.status === "save_error" ? "bg-rose-50/40" : ""}`}>
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-[11px] font-semibold">{statusUI}</td>
                          <td className="px-2.5 py-1.5 min-w-[140px]"><input value={r.data.name} disabled={disabled} onChange={e => updateCell(r.id, "name", e.target.value)} className={INPUT} placeholder="Zorunlu" /></td>
                          <td className="px-2.5 py-1.5 min-w-[120px]">
                            <select value={r.data.policy_type} disabled={disabled} onChange={e => updateCell(r.id, "policy_type", e.target.value)} className={`${INPUT} ${!r.data.policy_type ? "border-amber-300" : ""}`}>
                              <option value="">Seç…</option>
                              {KNOWN_POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-2.5 py-1.5 min-w-[120px]"><input value={r.data.phone} disabled={disabled} onChange={e => updateCell(r.id, "phone", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5 min-w-[110px]"><input value={r.data.tc_identity_no} disabled={disabled} onChange={e => updateCell(r.id, "tc_identity_no", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5 min-w-[120px]"><input value={r.data.insurance_company} disabled={disabled} onChange={e => updateCell(r.id, "insurance_company", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5 min-w-[80px]"><input value={r.data.premium} disabled={disabled} onChange={e => updateCell(r.id, "premium", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5 min-w-[120px]"><input type="date" value={r.data.start_date} disabled={disabled} onChange={e => updateCell(r.id, "start_date", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5 min-w-[120px]"><input type="date" value={r.data.end_date} disabled={disabled} onChange={e => updateCell(r.id, "end_date", e.target.value)} className={INPUT} /></td>
                          <td className="px-2.5 py-1.5">
                            {!disabled && (
                              <button onClick={() => removeRow(r.id)} className="text-gray-300 hover:text-rose-500 transition-colors" title="Satırı kaldır">✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && phase === "review" && (
              <p className="text-[11px] text-gray-400">
                İpucu: Sarı satırlar eksik (ad, tür veya TC/telefon gerekli). Aynı TC veya telefona sahip poliçeler otomatik olarak tek müşteriye bağlanır. Plaka, motor/şasi no gibi diğer alanlar OCR&apos;dan otomatik kaydedilir.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
