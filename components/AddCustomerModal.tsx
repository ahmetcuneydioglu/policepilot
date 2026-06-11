"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { canAddCustomer, limitMessage } from "@/lib/limits";
import { INACTIVE_MESSAGE } from "@/lib/limits";

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

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div>
      <label className={LABEL}>{label}{optional && <span className="ml-1 text-gray-400 font-normal">(isteğe bağlı)</span>}</label>
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
  const [identityNo,   setIdentityNo]   = useState("");
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

  // ── Check customer limit on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!agencyId) { setLimitChecked(true); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canAddCustomer(supabase as any, agencyId).then((res) => {
      setLimitOk(res.ok && res.isActive);
      if (!res.isActive) setLimitMsg(INACTIVE_MESSAGE);
      else if (!res.ok)  setLimitMsg(`${limitMessage("customer")} (${res.current}/${res.max})`);
      setLimitChecked(true);
    });
  }, [agencyId]);

  const group = INSURANCE_TYPES.find((t) => t.value === insuranceType)?.group ?? "";

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

    const res = await fetch("/api/customers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:           name.trim(),
        phone:          phone.trim(),
        email:          email.trim() || null,
        insurance_type: insuranceType,
        note:           note.trim() || null,
        identity_no:    identityNo.trim() || null,
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
              <button onClick={() => { setDone(false); setName(""); setPhone(""); setEmail(""); setIdentityNo(""); setNote(""); setInsuranceType(""); setPlate(""); setLicenseSerial(""); setBrandModel(""); setVehicleYear(""); setEngineNo(""); setChassisNo(""); setBirthDate(""); setGender(""); setCity(""); setHealthNote(""); setPropCity(""); setPropDistrict(""); setAddress(""); setBuildingAge(""); setAreaM2(""); setDescription(""); setPolicyNo(""); setInsuranceCompany(""); setPremium(""); setPolicyStartDate(""); setPolicyEndDate(""); setDocFile(null); setDocWarning(""); setDocUploaded(false); }}
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
                <Field label="Ad Soyad *">
                  <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ahmet Yılmaz" className={INPUT} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefon *">
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="0532 123 45 67" className={INPUT} />
                  </Field>
                  <Field label="TC / VKN" optional>
                    <input value={identityNo} onChange={(e) => setIdentityNo(e.target.value)} placeholder="12345678901" className={INPUT} />
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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Sigorta Türü</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INSURANCE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setInsuranceType(t.value)}
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
                        <Field label="Plaka" optional>
                          <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="34ABC123" className={INPUT} />
                        </Field>
                        <Field label="Ruhsat Seri No" optional>
                          <input value={licenseSerial} onChange={(e) => setLicenseSerial(e.target.value)} placeholder="AA 00000" className={INPUT} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Araç Marka / Model" optional>
                          <input value={brandModel} onChange={(e) => setBrandModel(e.target.value)} placeholder="Hyundai Getz 1.4" className={INPUT} />
                        </Field>
                        <Field label="Araç Yılı" optional>
                          <input type="number" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="2020" min="1990" max="2030" className={INPUT} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Motor No" optional>
                          <input value={engineNo} onChange={(e) => setEngineNo(e.target.value)} placeholder="G4EE6359743" className={INPUT} />
                        </Field>
                        <Field label="Şasi No" optional>
                          <input value={chassisNo} onChange={(e) => setChassisNo(e.target.value)} placeholder="KMHBU51DP6U513670" className={INPUT} />
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
                      <Field label="Adres" optional>
                        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tam adres" className={INPUT} />
                      </Field>
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
                    <Field label="Poliçe No" optional>
                      <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder="74798326" className={INPUT} />
                    </Field>
                    <Field label="Sigorta Şirketi" optional>
                      <input value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} placeholder="Ethica Sigorta" className={INPUT} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Başlangıç Tarihi" optional>
                      <input type="date" value={policyStartDate} onChange={(e) => handleStartDate(e.target.value)} className={INPUT} />
                    </Field>
                    <Field label="Poliçe Bitiş Tarihi" optional>
                      <input type="date" value={policyEndDate} onChange={(e) => setPolicyEndDate(e.target.value)} className={INPUT} />
                    </Field>
                  </div>
                  <Field label="Ödenecek Prim (₺)" optional>
                    <input type="number" step="0.01" min="0" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="10153.10" className={INPUT} />
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
          </form>
        )}
      </div>
    </div>
  );
}
