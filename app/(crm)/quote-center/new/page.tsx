"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, ChevronRight, Car, Shield, Home,
  Heart, Globe, UserCheck, UserPlus, Check,
  Search, RefreshCw, Plus, Trash2, Info,
  CheckCircle2, XCircle,
} from "lucide-react";

// ─── Product config ───────────────────────────────────────────────────────────
type ProductGroup = "vehicle" | "property" | "health" | "travel";

const PRODUCTS = [
  { type: "Trafik",       label: "Trafik Sigortası",  group: "vehicle"   as ProductGroup, Icon: Car },
  { type: "Kasko",        label: "Kasko Sigortası",   group: "vehicle"   as ProductGroup, Icon: Shield },
  { type: "İMM",          label: "İMM Sigortası",     group: "vehicle"   as ProductGroup, Icon: Shield },
  { type: "DASK",         label: "DASK",              group: "property"  as ProductGroup, Icon: Home },
  { type: "Konut",        label: "Konut Sigortası",   group: "property"  as ProductGroup, Icon: Home },
  { type: "TSS",          label: "Tamam. Sağlık",     group: "health"    as ProductGroup, Icon: Heart },
  { type: "Ferdi Kaza",   label: "Ferdi Kaza",        group: "health"    as ProductGroup, Icon: Heart },
  { type: "Özel Sağlık",  label: "Özel Sağlık",       group: "health"    as ProductGroup, Icon: Heart },
  { type: "Seyahat",      label: "Seyahat Sigortası", group: "travel"    as ProductGroup, Icon: Globe },
];

// ─── Insurance companies per group ──────────────────────────────────────────
const COMPANIES: Record<ProductGroup, string[]> = {
  vehicle: [
    "Neova Sigorta", "Turknippon Sigorta", "Ray Sigorta", "AK Sigorta",
    "Anadolu Sigorta", "Ankara Sigorta", "AXA Sigorta", "Bereket Sigorta",
    "Corpus Sigorta", "HDI Sigorta", "Koru Sigorta", "Mapfre Sigorta",
    "Sompo Sigorta", "Türkiye Sigorta",
  ],
  property: [
    "Allianz Sigorta", "Anadolu Sigorta", "AXA Sigorta", "Ergo Sigorta",
    "Groupama Sigorta", "Güneş Sigorta", "HDI Sigorta", "Mapfre Sigorta",
    "Türkiye Sigorta", "Unico Sigorta",
  ],
  health: [
    "Acıbadem Sigorta", "Allianz Sigorta", "Anadolu Sigorta", "AXA Sigorta",
    "Cigna Sigorta", "Groupama Sigorta", "Güneş Sigorta", "Türkiye Sigorta",
  ],
  travel: [
    "Allianz Sigorta", "Anadolu Sigorta", "AXA Sigorta", "Ergo Sigorta",
    "Groupama Sigorta", "Neova Sigorta", "Türkiye Sigorta",
  ],
};

// ─── Types ───────────────────────────────────────────────────────────────────
type CustomerMode = "existing" | "new";

type CompanyRow = {
  name: string;
  price: string;
  installment: string;
  note: string;
  state: "idle" | "loading" | "filled" | "noOffer";
};

type FormState = {
  // Step 1
  customerMode:     CustomerMode;
  customerId:       string;
  customerAgencyId: string;   // ← müşterinin kendi agency_id'si (super_admin için)
  customerName:     string;
  customerPhone:    string;
  customerEmail:    string;
  customerTc:       string;
  customerDob:      string;
  customerCity:     string;
  customerDistrict: string;
  // Step 2
  productType:    string;
  plaka:          string;
  ruhsatSeri:     string;
  kullanimTarzi:  string;
  motorNo:        string;
  sasiNo:         string;
  marka:          string;
  model:          string;
  modelYili:      string;
  tescilTarihi:   string;
  il:             string;
  ilce:           string;
  metrekare:      string;
  binaYili:       string;
  yas:            string;
  cinsiyet:       string;
  notes:          string;
  // Step 3 — company quotes
  companies:      CompanyRow[];
};

const INIT: FormState = {
  customerMode: "existing", customerId: "", customerAgencyId: "", customerName: "", customerPhone: "",
  customerEmail: "", customerTc: "", customerDob: "", customerCity: "", customerDistrict: "",
  productType: "", plaka: "", ruhsatSeri: "", kullanimTarzi: "OTOMOBİL",
  motorNo: "", sasiNo: "", marka: "", model: "", modelYili: "", tescilTarihi: "",
  il: "", ilce: "", metrekare: "", binaYili: "", yas: "", cinsiyet: "", notes: "",
  companies: [],
};

// ─── Summary sidebar ─────────────────────────────────────────────────────────
function SummaryPanel({ form }: { form: FormState }) {
  const productCfg = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle  = productCfg?.group === "vehicle";

  return (
    <div className="hidden xl:flex flex-col w-64 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-fit sticky top-6 space-y-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Özet</p>

      {/* Customer */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <UserCheck className="w-3 h-3" /> Kişi Bilgileri
        </p>
        <div className="space-y-1 text-xs">
          {[
            { label: "TC/VKN",  val: form.customerTc   || "—" },
            { label: "Müşteri", val: form.customerName  || "—" },
            { label: "İl",      val: form.customerCity  || "—" },
            { label: "İlçe",    val: form.customerDistrict || "—" },
            { label: "D. Tarihi", val: form.customerDob || "—" },
          ].map(r => (
            <div key={r.label} className="flex justify-between gap-2">
              <span className="text-gray-400">{r.label}</span>
              <span className="font-semibold text-slate-700 text-right truncate max-w-[120px]">{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {isVehicle && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Car className="w-3 h-3" /> Araç Bilgileri
          </p>
          <div className="space-y-1 text-xs">
            {[
              { label: "Plaka",   val: form.plaka       || "—" },
              { label: "Seri",    val: form.ruhsatSeri  || "—" },
              { label: "Marka",   val: form.marka       || "—" },
              { label: "Model",   val: form.model       || "—" },
              { label: "Yılı",    val: form.modelYili   || "—" },
              { label: "Motor",   val: form.motorNo     || "—" },
              { label: "Şasi",    val: form.sasiNo      || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between gap-2">
                <span className="text-gray-400">{r.label}</span>
                <span className="font-semibold text-slate-700 text-right truncate max-w-[120px]">{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {form.productType && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs">
          <p className="text-blue-500 font-semibold">{form.productType} Sigortası</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewQuoteRunPage() {
  const router              = useRouter();
  const { role, agencyId }  = useAuth();

  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState<FormState>(INIT);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // TC lookup state
  const [tcLoading, setTcLoading]   = useState(false);
  const [tcFetched, setTcFetched]   = useState(false);

  // Plaka lookup state
  const [plakaLoading, setPlakaLoading] = useState(false);
  const [plakaFetched, setPlakaFetched] = useState(false);

  // Existing customers
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string; agency_id: string }>>([]);
  const [custSearch, setCustSearch] = useState("");

  // Simulate API timers
  const tcTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plakaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from("customers") as any)
        .select("id, name, phone, agency_id")   // ← agency_id de çekiliyor
        .order("name");
      if (role === "agency_user" && agencyId) q = q.eq("agency_id", agencyId);
      const { data } = await q;
      setCustomers(data ?? []);
    }
    loadCustomers();
  }, [role, agencyId]);

  // Initialise company list when product changes
  useEffect(() => {
    const cfg = PRODUCTS.find(p => p.type === form.productType);
    if (!cfg) return;
    const list = COMPANIES[cfg.group].map(name => ({
      name, price: "", installment: "Peşin", note: "", state: "idle" as const,
    }));
    setForm(prev => ({ ...prev, companies: list }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productType]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function updateCompany(idx: number, field: keyof CompanyRow, val: string) {
    setForm(prev => {
      const companies = [...prev.companies];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (companies[idx] as any)[field] = val;
      if (field === "price" && val) companies[idx].state = "filled";
      return { ...prev, companies };
    });
  }

  // ── TC / Plaka lookup simulation ─────────────────────────────────────────
  function handleTcLookup() {
    if (!form.customerTc || form.customerTc.length < 10) return;
    setTcLoading(true);
    if (tcTimer.current) clearTimeout(tcTimer.current);
    tcTimer.current = setTimeout(() => {
      // Simulate fetched data — user should replace with real data
      setForm(prev => ({
        ...prev,
        customerDob:      prev.customerDob      || "01.01.1985",
        customerCity:     prev.customerCity     || "İSTANBUL",
        customerDistrict: prev.customerDistrict || "KADIKÖY",
      }));
      setTcLoading(false);
      setTcFetched(true);
    }, 1500);
  }

  function handlePlakaLookup() {
    if (!form.plaka || form.plaka.length < 5) return;
    setPlakaLoading(true);
    if (plakaTimer.current) clearTimeout(plakaTimer.current);
    plakaTimer.current = setTimeout(() => {
      // Simulate fetched vehicle data
      setForm(prev => ({
        ...prev,
        kullanimTarzi: prev.kullanimTarzi || "OTOMOBİL",
        motorNo:       prev.motorNo       || "R9M500X" + Math.random().toString(36).slice(-5).toUpperCase(),
        sasiNo:        prev.sasiNo        || "WDD2050" + Math.random().toString(36).slice(-9).toUpperCase(),
        marka:         prev.marka         || "ANADOLU",
        model:         prev.model         || "Model Seçiniz",
        modelYili:     prev.modelYili     || "2020",
        tescilTarihi:  prev.tescilTarihi  || "01.06.2020",
      }));
      setPlakaLoading(false);
      setPlakaFetched(true);
    }, 1200);
  }

  // ── Simulate all company quotes loading ───────────────────────────────────
  function simulateQuotes() {
    // Reset all to loading
    setForm(prev => ({
      ...prev,
      companies: prev.companies.map(c => ({ ...c, state: "loading", price: "" })),
    }));

    // Stagger each company result
    form.companies.forEach((_, idx) => {
      const delay = 600 + idx * 400 + Math.random() * 300;
      setTimeout(() => {
        setForm(prev => {
          const companies = [...prev.companies];
          const rand = Math.random();
          if (rand < 0.15) {
            companies[idx] = { ...companies[idx], state: "noOffer", price: "" };
          } else {
            const base  = form.productType === "Trafik" ? 15000 : 25000;
            const price = Math.round((base + Math.random() * base * 0.7) / 100) * 100;
            companies[idx] = { ...companies[idx], state: "filled", price: String(price) };
          }
          return { ...prev, companies };
        });
      }, delay);
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (step === 1) {
      if (form.customerMode === "existing" && !form.customerId) return "Lütfen bir müşteri seçin";
      if (form.customerMode === "new" && !form.customerName.trim()) return "Ad Soyad zorunludur";
    }
    if (step === 2) {
      if (!form.productType) return "Lütfen bir sigorta türü seçin";
    }
    return null;
  }

  function handleNext() {
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const cfg = PRODUCTS.find(p => p.type === form.productType);

      // Resolve agency_id:
      //   - agency_user  → agencyId (JWT)
      //   - super_admin  → müşterinin agency_id'si (form.customerAgencyId)
      const effectiveAgencyId = agencyId || form.customerAgencyId || null;

      if (!effectiveAgencyId) {
        setError("Acente belirlenemedi. Lütfen listeden bir müşteri seçin.");
        setSaving(false);
        return;
      }

      // Create customer if new mode
      let customerId    = form.customerId || null;
      let customerName  = form.customerName;
      let customerPhone = form.customerPhone;

      if (form.customerMode === "new") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: nc, error: ce } = await (supabase.from("customers") as any)
          .insert({
            agency_id: effectiveAgencyId, name: form.customerName,
            phone: form.customerPhone, insurance_type: form.productType,
          })
          .select("id, name, phone").single();
        if (ce) throw ce;
        customerId = nc.id; customerName = nc.name; customerPhone = nc.phone;
      }

      const productData = cfg?.group === "vehicle"
        ? { group: cfg.group, plaka: form.plaka, ruhsatSeri: form.ruhsatSeri,
            kullanimTarzi: form.kullanimTarzi, motorNo: form.motorNo, sasiNo: form.sasiNo,
            marka: form.marka, model: form.model, modelYili: form.modelYili,
            tescilTarihi: form.tescilTarihi, il: form.il, ilce: form.ilce }
        : cfg?.group === "property"
        ? { group: cfg?.group, il: form.il, ilce: form.ilce, metrekare: form.metrekare, binaYili: form.binaYili }
        : cfg?.group === "health"
        ? { group: cfg?.group, yas: form.yas, cinsiyet: form.cinsiyet, il: form.il, ilce: form.ilce }
        : { group: cfg?.group };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: run, error: re } = await (supabase.from("quote_runs") as any)
        .insert({
          agency_id: effectiveAgencyId, customer_id: customerId, product_type: form.productType,
          product_data: productData, customer_name: customerName, customer_phone: customerPhone,
          customer_email: form.customerEmail, customer_tc: form.customerTc,
          notes: form.notes || null, status: "Yeni",
        })
        .select("id").single();
      if (re) throw re;

      // Insert company results (only filled or noOffer rows)
      const resultRows = form.companies
        .filter(c => c.price || c.state === "noOffer")
        .map(c => ({
          quote_run_id: run.id, company_name: c.name,
          price:        c.price ? parseFloat(c.price.replace(/\D/g, "")) : null,
          installment:  c.installment, note: c.note,
          status:       c.state === "noOffer" ? "Teklif Yok" : "Aktif",
        }));

      if (resultRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("quote_results") as any).insert(resultRows);
      }

      router.push(`/quote-center/${run.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const STEPS = ["Müşteri", "Ürün & Araç", "Teklif Sonuçları"];
  const productCfg = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle  = productCfg?.group === "vehicle";
  const isProperty = productCfg?.group === "property";
  const isHealth   = productCfg?.group === "health";

  const filteredCustomers = customers.filter(c =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  );

  const filledCount  = form.companies.filter(c => c.state === "filled").length;
  const loadingCount = form.companies.filter(c => c.state === "loading").length;
  const sortedCompanies = [...form.companies].sort((a, b) => {
    if (!a.price && !b.price) return 0;
    if (!a.price) return 1;
    if (!b.price) return -1;
    return parseFloat(a.price) - parseFloat(b.price);
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 items-start">
      {/* Summary sidebar */}
      <SummaryPanel form={form} />

      {/* Main panel */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/quote-center" className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Teklif Çalışması Başlat</h1>
            <p className="text-sm text-gray-400">Adım {step} / {STEPS.length} — {STEPS[step - 1]}</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0">
          {STEPS.map((label, i) => {
            const idx     = i + 1;
            const done    = step > idx;
            const current = step === idx;
            return (
              <div key={label} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  current ? "bg-blue-600 text-white"
                  : done   ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-400"
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    current ? "bg-white/20" : done ? "bg-white/20" : ""
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : <span className="text-[10px] font-bold">{idx}</span>}
                  </div>
                  <span className="hidden sm:block whitespace-nowrap">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 transition-colors ${step > idx ? "bg-emerald-200" : "bg-gray-100"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

          {error && (
            <div className="mx-6 mt-5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ═══════ STEP 1 — Müşteri ═══════ */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Müşteri Seçimi</h2>
                <p className="text-sm text-gray-400 mt-0.5">Mevcut CRM müşterisini seçin veya yeni oluşturun</p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                {([
                  { key: "existing", label: "Mevcut Müşteri", Icon: UserCheck },
                  { key: "new",      label: "Yeni Müşteri",   Icon: UserPlus },
                ] as const).map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => set("customerMode", key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.customerMode === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* Existing */}
              {form.customerMode === "existing" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" placeholder="İsim veya telefon ara…" value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4 italic">Müşteri bulunamadı</p>
                    ) : filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => setForm(prev => ({ ...prev, customerId: c.id, customerAgencyId: c.agency_id, customerName: c.name, customerPhone: c.phone }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          form.customerId === c.id ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        </div>
                        {form.customerId === c.id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New */}
              {form.customerMode === "new" && (
                <div className="space-y-4">
                  {/* TC Lookup */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">TC Kimlik / Vergi No</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="12345678901" value={form.customerTc}
                        onChange={e => set("customerTc", e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleTcLookup()}
                        className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={handleTcLookup} disabled={tcLoading}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                      >
                        {tcLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Sorgula
                      </button>
                    </div>
                    {tcFetched && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Kişi bilgileri getirildi. Lütfen kontrol ederek devam edin.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "customerName",     label: "Ad Soyad *",       full: true },
                      { key: "customerDob",      label: "Doğum Tarihi",     placeholder: "GG.AA.YYYY" },
                      { key: "customerPhone",    label: "Telefon",          placeholder: "05XX…" },
                      { key: "customerEmail",    label: "E-posta" },
                      { key: "customerCity",     label: "İl",               placeholder: "İSTANBUL" },
                      { key: "customerDistrict", label: "İlçe",             placeholder: "KADIKÖY" },
                    ].map(f => (
                      <div key={f.key} className={(f as { full?: boolean }).full ? "col-span-2" : ""}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                        <input type="text" placeholder={(f as { placeholder?: string }).placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ STEP 2 — Ürün & Araç ═══════ */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              {/* Product type */}
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">Sigorta Türü</h2>
                <p className="text-sm text-gray-400">Tür seçin, ardından ürün bilgilerini girin</p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PRODUCTS.map(p => {
                  const active = form.productType === p.type;
                  return (
                    <button key={p.type} onClick={() => set("productType", p.type)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-[11px] font-semibold transition-all ${
                        active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 hover:border-blue-200 text-gray-500"
                      }`}
                    >
                      <p.Icon className={`w-5 h-5 ${active ? "text-blue-500" : "text-gray-400"}`} />
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Vehicle fields */}
              {isVehicle && (
                <div className="space-y-4">
                  <div className="h-px bg-gray-100" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Araç Bilgileri</p>

                  {/* Plaka + Ruhsat Seri */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Plaka *</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="34 ABC 123" value={form.plaka}
                          onChange={e => set("plaka", e.target.value.toUpperCase())}
                          onBlur={handlePlakaLookup}
                          className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                        />
                        <button onClick={handlePlakaLookup} disabled={plakaLoading}
                          className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
                          title="Plaka Sorgula"
                        >
                          {plakaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                      {plakaFetched && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Plaka bilgileri getirildi.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ruhsat Belge Seri/No</label>
                      <input type="text" placeholder="AB-123456" value={form.ruhsatSeri}
                        onChange={e => set("ruhsatSeri", e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "kullanimTarzi", label: "Kullanım Tarzı", placeholder: "OTOMOBİL" },
                      { key: "marka",         label: "Marka",           placeholder: "TOYOTA" },
                      { key: "model",         label: "Model",           placeholder: "COROLLA 1.6" },
                      { key: "modelYili",     label: "Model Yılı",      placeholder: "2020" },
                      { key: "motorNo",       label: "Motor No",        placeholder: "ABC123…" },
                      { key: "sasiNo",        label: "Şasi No",         placeholder: "WDD…" },
                      { key: "tescilTarihi",  label: "Tescil Tarihi",   placeholder: "GG.AA.YYYY" },
                      { key: "il",            label: "İl",              placeholder: "İSTANBUL" },
                      { key: "ilce",          label: "İlçe",            placeholder: "KADIKÖY" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Property fields */}
              {isProperty && (
                <div className="space-y-3">
                  <div className="h-px bg-gray-100" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Konut Bilgileri</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "il",          label: "İl",           placeholder: "İSTANBUL" },
                      { key: "ilce",        label: "İlçe",         placeholder: "KADIKÖY" },
                      { key: "metrekare",   label: "Metrekare",    placeholder: "120" },
                      { key: "binaYili",    label: "Bina Yapım Yılı", placeholder: "2005" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Health fields */}
              {isHealth && (
                <div className="space-y-3">
                  <div className="h-px bg-gray-100" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sağlık Bilgileri</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "yas",      label: "Yaş",      placeholder: "35" },
                      { key: "cinsiyet", label: "Cinsiyet", placeholder: "Erkek / Kadın" },
                      { key: "il",       label: "İl",       placeholder: "İSTANBUL" },
                      { key: "ilce",     label: "İlçe",     placeholder: "KADIKÖY" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notlar</label>
                <textarea rows={2} placeholder="Özel notlar, müşteri istekleri…"
                  value={form.notes} onChange={e => set("notes", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ═══════ STEP 3 — Teklif Sonuçları ═══════ */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Teklif Sonuçları</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {form.productType} sigortası · {form.customerName || "Müşteri"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {loadingCount > 0 && (
                    <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {loadingCount} çalışıyor…
                    </span>
                  )}
                  {filledCount > 0 && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {filledCount} teklif
                    </span>
                  )}
                  <button onClick={simulateQuotes}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tekrar Yükle
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                <Info className="w-4 h-4 flex-shrink-0" />
                Fiyatları manuel girin veya "Tekrar Yükle" ile demo modunu çalıştırın. API entegrasyonu yapıldığında teklifler otomatik gelecek.
              </div>

              {/* Company table */}
              <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <div className="col-span-4">Şirket</div>
                  <div className="col-span-3">Fiyat (₺)</div>
                  <div className="col-span-2">Taksit</div>
                  <div className="col-span-2">Not</div>
                  <div className="col-span-1"></div>
                </div>

                {sortedCompanies.map((c, idx) => {
                  const origIdx = form.companies.findIndex(fc => fc.name === c.name);
                  const prices  = form.companies.map(x => parseFloat(x.price) || 0).filter(p => p > 0);
                  const minP    = prices.length > 0 ? Math.min(...prices) : 0;
                  const myP     = parseFloat(c.price) || 0;
                  const priceCls =
                    !c.price || c.state !== "filled" ? ""
                    : myP === minP ? "bg-emerald-500 text-white"
                    : myP <= minP * 1.15 ? "bg-amber-400 text-white"
                    : "bg-red-400 text-white";

                  return (
                    <div key={c.name} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50/60 transition-colors">
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-[9px] font-bold text-indigo-600 flex-shrink-0">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 leading-tight">{c.name}</span>
                      </div>

                      <div className="col-span-3">
                        {c.state === "loading" ? (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Çalışılıyor…
                          </div>
                        ) : c.state === "noOffer" ? (
                          <span className="text-xs text-gray-400 italic">Teklif yok</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {c.price && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${priceCls || "bg-gray-100 text-gray-700"}`}>
                                {parseInt(c.price).toLocaleString("tr-TR")} ₺
                              </span>
                            )}
                            {!c.price && (
                              <input type="number" placeholder="Fiyat"
                                value={c.price}
                                onChange={e => updateCompany(origIdx, "price", e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2">
                        {c.state !== "loading" && c.state !== "noOffer" && (
                          <select value={c.installment}
                            onChange={e => updateCompany(origIdx, "installment", e.target.value)}
                            className="w-full text-xs border border-gray-100 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            {["Peşin","3 taksit","6 taksit","9 taksit","12 taksit"].map(t => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="col-span-2">
                        {c.state !== "loading" && c.state !== "noOffer" && (
                          <input type="text" placeholder="Not"
                            value={c.note}
                            onChange={e => updateCompany(origIdx, "note", e.target.value)}
                            className="w-full text-xs border border-gray-100 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>

                      <div className="col-span-1 flex justify-end">
                        {c.state !== "loading" && (
                          <button onClick={() => updateCompany(origIdx, "state", c.state === "noOffer" ? "idle" : "noOffer")}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                              c.state === "noOffer"
                                ? "bg-red-50 text-red-400 hover:bg-gray-50 hover:text-gray-400"
                                : "text-gray-300 hover:bg-red-50 hover:text-red-400"
                            }`}
                            title={c.state === "noOffer" ? "Tekrar aktif et" : "Teklif yok işaretle"}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 text-center">
                Fiyat girmediğiniz şirketler boş bırakılır — daha sonra düzenleyebilirsiniz.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step === 1 ? router.push("/quote-center") : setStep(s => s - 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? "İptal" : "Geri"}
          </button>

          {step < STEPS.length ? (
            <button onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Devam <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
            >
              {saving ? "Kaydediliyor…" : "Teklif Çalışmasını Kaydet"}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
