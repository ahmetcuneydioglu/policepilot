"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, ChevronRight, Car, Shield, Home,
  Heart, Globe, UserCheck, UserPlus, Check,
  Search, RefreshCw, Info,
  CheckCircle2, XCircle, AlertCircle, FileText,
  Zap, User, Settings,
} from "lucide-react";

// ─── Product config ───────────────────────────────────────────────────────────
type ProductGroup = "vehicle" | "property" | "health" | "travel";

const PRODUCTS = [
  { type: "Trafik",      label: "Trafik Sigortası",  group: "vehicle"   as ProductGroup, Icon: Car,    desc: "Zorunlu trafik" },
  { type: "Kasko",       label: "Kasko Sigortası",   group: "vehicle"   as ProductGroup, Icon: Shield, desc: "Araç hasarı" },
  { type: "İMM",         label: "İMM Sigortası",     group: "vehicle"   as ProductGroup, Icon: Shield, desc: "İhtiyari mali" },
  { type: "DASK",        label: "DASK",              group: "property"  as ProductGroup, Icon: Home,   desc: "Zorunlu deprem" },
  { type: "Konut",       label: "Konut Sigortası",   group: "property"  as ProductGroup, Icon: Home,   desc: "Konut güvencesi" },
  { type: "TSS",         label: "Tamam. Sağlık",     group: "health"    as ProductGroup, Icon: Heart,  desc: "TSS" },
  { type: "Ferdi Kaza",  label: "Ferdi Kaza",        group: "health"    as ProductGroup, Icon: Heart,  desc: "Kaza güvencesi" },
  { type: "Özel Sağlık", label: "Özel Sağlık",       group: "health"    as ProductGroup, Icon: Heart,  desc: "Özel sağlık" },
  { type: "Seyahat",     label: "Seyahat Sigortası", group: "travel"    as ProductGroup, Icon: Globe,  desc: "Yurt içi/dışı" },
];

const PRODUCT_COLORS: Record<ProductGroup, { bg: string; activeBg: string; border: string; activeBorder: string; icon: string; activeIcon: string }> = {
  vehicle:  { bg: "bg-blue-50",   activeBg: "bg-blue-50",   border: "border-slate-200", activeBorder: "border-blue-500",   icon: "text-slate-400", activeIcon: "text-blue-600" },
  property: { bg: "bg-amber-50",  activeBg: "bg-amber-50",  border: "border-slate-200", activeBorder: "border-amber-500",  icon: "text-slate-400", activeIcon: "text-amber-600" },
  health:   { bg: "bg-rose-50",   activeBg: "bg-rose-50",   border: "border-slate-200", activeBorder: "border-rose-500",   icon: "text-slate-400", activeIcon: "text-rose-600" },
  travel:   { bg: "bg-cyan-50",   activeBg: "bg-cyan-50",   border: "border-slate-200", activeBorder: "border-cyan-500",   icon: "text-slate-400", activeIcon: "text-cyan-600" },
};

// ─── Insurance companies per group ───────────────────────────────────────────
const COMPANIES: Record<ProductGroup, string[]> = {
  vehicle: [
    "Neova Sigorta", "AXA Sigorta", "Ray Sigorta", "AK Sigorta",
    "Anadolu Sigorta", "Türkiye Sigorta", "Mapfre Sigorta", "Sompo Sigorta",
    "HDI Sigorta", "Bereket Sigorta", "Ankara Sigorta", "Corpus Sigorta",
    "Turknippon Sigorta", "Koru Sigorta",
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

// ─── Types ────────────────────────────────────────────────────────────────────
type CustomerMode = "existing" | "new";

type CompanyRow = {
  name: string;
  price: string;
  installment: string;
  note: string;
  noOffer: boolean;
};

type FormState = {
  customerMode:     CustomerMode;
  customerId:       string;
  customerAgencyId: string;
  customerName:     string;
  customerPhone:    string;
  customerEmail:    string;
  customerTc:       string;
  customerDob:      string;
  customerCity:     string;
  customerDistrict: string;
  productType:      string;
  plaka:            string;
  ruhsatSeri:       string;
  kullanimTarzi:    string;
  motorNo:          string;
  sasiNo:           string;
  marka:            string;
  model:            string;
  modelYili:        string;
  tescilTarihi:     string;
  il:               string;
  ilce:             string;
  metrekare:        string;
  binaYili:         string;
  yas:              string;
  cinsiyet:         string;
  notes:            string;
  companies:        CompanyRow[];
};

const INIT: FormState = {
  customerMode: "existing", customerId: "", customerAgencyId: "", customerName: "",
  customerPhone: "", customerEmail: "", customerTc: "", customerDob: "",
  customerCity: "", customerDistrict: "",
  productType: "", plaka: "", ruhsatSeri: "", kullanimTarzi: "OTOMOBİL",
  motorNo: "", sasiNo: "", marka: "", model: "", modelYili: "", tescilTarihi: "",
  il: "", ilce: "", metrekare: "", binaYili: "", yas: "", cinsiyet: "", notes: "",
  companies: [],
};

// ─── Step labels ─────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Müşteri Profili",       icon: User },
  { label: "Ürün & Risk Bilgileri", icon: Settings },
  { label: "Teklif Motoru",         icon: Zap },
];

// ─── Status dot component ─────────────────────────────────────────────────────
function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={`text-[11px] font-medium ${ok ? "text-emerald-700" : "text-slate-400"}`}>{label}</span>
      {ok && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />}
    </div>
  );
}

// ─── Left panel — "Canlı Teklif Dosyası" ─────────────────────────────────────
function LiveFilePanel({ form, step }: { form: FormState; step: number }) {
  const productCfg = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle  = productCfg?.group === "vehicle";

  const hasCustomer = !!(form.customerName || form.customerId);
  const hasTc       = !!form.customerTc;
  const hasVehicle  = !!(form.plaka && form.marka);
  const hasProduct  = !!form.productType;
  const hasQuotes   = form.companies.some(c => c.price);

  return (
    <div className="hidden xl:flex flex-col w-64 flex-shrink-0 sticky top-6 space-y-3">
      {/* File header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-blue-300" />
          </div>
          <p className="text-xs font-bold tracking-wider text-slate-300 uppercase">Teklif Dosyası</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < step ? "bg-emerald-400" : i === step - 1 ? "bg-blue-400" : "bg-white/10"}`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-400">Adım {step}/{STEPS.length} · {STEPS[step-1].label}</p>
      </div>

      {/* Customer info */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <UserCheck className="w-3 h-3" /> Kişi Bilgileri
        </p>
        {[
          { label: "Müşteri", val: form.customerName },
          { label: "TC/VKN",  val: form.customerTc },
          { label: "Telefon", val: form.customerPhone },
          { label: "İl",      val: form.customerCity },
          { label: "D. Tarihi", val: form.customerDob },
        ].map(r => (
          <div key={r.label} className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-400">{r.label}</span>
            <span className={`text-[11px] font-semibold text-right truncate max-w-[110px] ${r.val ? "text-slate-700" : "text-slate-300"}`}>
              {r.val || "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Vehicle info */}
      {isVehicle && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Car className="w-3 h-3" /> Araç Bilgileri
          </p>
          {[
            { label: "Plaka",  val: form.plaka },
            { label: "Marka",  val: form.marka },
            { label: "Model",  val: form.model },
            { label: "Yılı",   val: form.modelYili },
            { label: "Motor",  val: form.motorNo },
            { label: "Şasi",   val: form.sasiNo },
          ].map(r => (
            <div key={r.label} className="flex justify-between gap-2">
              <span className="text-[11px] text-slate-400">{r.label}</span>
              <span className={`text-[11px] font-semibold font-mono text-right truncate max-w-[110px] ${r.val ? "text-slate-700" : "text-slate-300"}`}>
                {r.val || "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Operasyon durumu */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operasyon Durumu</p>
        <StatusDot ok={hasCustomer} label="Müşteri bilgisi" />
        <StatusDot ok={hasTc}       label="Kimlik bilgisi" />
        {isVehicle && <StatusDot ok={hasVehicle} label="Araç bilgisi" />}
        <StatusDot ok={hasProduct}  label="Ürün seçildi" />
        <StatusDot ok={hasQuotes}   label="Teklif girişleri" />
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400 transition-all";

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewQuoteRunPage() {
  const router             = useRouter();
  const { role, agencyId } = useAuth();

  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState<FormState>(INIT);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // TC lookup state
  const [tcLoading,   setTcLoading]   = useState(false);
  const [tcMsg,       setTcMsg]       = useState<string | null>(null);

  // Plaka lookup state
  const [plakaLoading, setPlakaLoading] = useState(false);
  const [plakaMsg,     setPlakaMsg]     = useState<string | null>(null);

  // Customers
  const [customers,   setCustomers]   = useState<Array<{ id: string; name: string; phone: string; agency_id: string }>>([]);
  const [custSearch,  setCustSearch]  = useState("");

  // Timer refs
  const tcTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plakaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load customers ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCustomers() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from("customers") as any).select("id, name, phone, agency_id").order("name");
      if (role === "agency_user" && agencyId) q = q.eq("agency_id", agencyId);
      const { data } = await q;
      setCustomers(data ?? []);
    }
    loadCustomers();
  }, [role, agencyId]);

  // ── Reset companies when product changes ──────────────────────────────────
  useEffect(() => {
    const cfg = PRODUCTS.find(p => p.type === form.productType);
    if (!cfg) return;
    const list = COMPANIES[cfg.group].map(name => ({
      name, price: "", installment: "Peşin", note: "", noOffer: false,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(prev => ({ ...prev, companies: list }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productType]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function updateCompany(idx: number, field: keyof CompanyRow, val: string | boolean) {
    setForm(prev => {
      const companies = [...prev.companies];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (companies[idx] as any)[field] = val;
      return { ...prev, companies };
    });
  }

  // ── TC lookup — entegrasyon aktif değil ───────────────────────────────────
  function handleTcLookup() {
    if (!form.customerTc || form.customerTc.length < 10) return;
    setTcLoading(true);
    setTcMsg(null);
    if (tcTimer.current) clearTimeout(tcTimer.current);
    tcTimer.current = setTimeout(() => {
      setTcLoading(false);
      setTcMsg("TC kimlik sorgulama entegrasyonu aktif değil. Bilgileri manuel olarak girebilirsiniz.");
    }, 800);
  }

  // ── Plaka lookup — entegrasyon aktif değil ────────────────────────────────
  function handlePlakaLookup() {
    if (!form.plaka || form.plaka.length < 5) return;
    setPlakaLoading(true);
    setPlakaMsg(null);
    if (plakaTimer.current) clearTimeout(plakaTimer.current);
    plakaTimer.current = setTimeout(() => {
      setPlakaLoading(false);
      setPlakaMsg("Araç sorgulama entegrasyonu aktif değil. Bilgileri manuel doldurabilirsiniz.");
    }, 800);
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
      const effectiveAgencyId = agencyId || form.customerAgencyId || null;

      if (!effectiveAgencyId) {
        setError("Acente belirlenemedi. Lütfen listeden bir müşteri seçin.");
        setSaving(false);
        return;
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

      const results = form.companies
        .filter(c => c.price || c.noOffer)
        .map(c => ({
          company_name: c.name,
          price:        c.price ? parseFloat(c.price.replace(/[^\d.]/g, "")) : null,
          installment:  c.installment,
          note:         c.note || null,
          status:       c.noOffer ? "Teklif Yok" : "Aktif",
        }));

      const res = await fetch("/api/quote-runs", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id:       effectiveAgencyId,
          customer_id:     form.customerMode === "existing" ? form.customerId || null : null,
          create_customer: form.customerMode === "new",
          customer_name:   form.customerName,
          customer_phone:  form.customerPhone,
          customer_email:  form.customerEmail,
          customer_tc:     form.customerTc,
          product_type:    form.productType,
          product_data:    productData,
          notes:           form.notes || null,
          results,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sunucu hatası");
      router.push(`/quote-center/${data.runId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const productCfg = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle  = productCfg?.group === "vehicle";
  const isProperty = productCfg?.group === "property";
  const isHealth   = productCfg?.group === "health";

  const filteredCustomers = customers.filter(c =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  );

  const filledCount = form.companies.filter(c => c.price).length;

  const sortedCompanies = [...form.companies].sort((a, b) => {
    const ap = parseFloat(a.price) || 0;
    const bp = parseFloat(b.price) || 0;
    if (a.noOffer && !b.noOffer) return 1;
    if (!a.noOffer && b.noOffer) return -1;
    if (!ap && !bp) return 0;
    if (!ap) return 1;
    if (!bp) return -1;
    return ap - bp;
  });

  const pricesArr = form.companies.map(c => parseFloat(c.price) || 0).filter(p => p > 0);
  const minPrice  = pricesArr.length > 0 ? Math.min(...pricesArr) : 0;

  function initials(name: string) {
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 items-start">
      {/* Left panel */}
      <LiveFilePanel form={form} step={step} />

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link href="/quote-center"
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:shadow-sm transition-all bg-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Teklif Çalışması Başlat</h1>
            <p className="text-sm text-slate-400">{STEPS[step - 1].label}</p>
          </div>
        </div>

        {/* ── Step progress ── */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const idx     = i + 1;
            const done    = step > idx;
            const current = step === idx;
            const StepIcon = s.icon;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                  current ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : done   ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                  : "bg-slate-100 text-slate-400"
                }`}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                    {done
                      ? <Check className="w-3 h-3" />
                      : current
                        ? <StepIcon className="w-3 h-3" />
                        : <span className="text-[10px] font-bold">{idx}</span>
                    }
                  </div>
                  <span className="hidden sm:block whitespace-nowrap">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all duration-300 ${step > idx ? "bg-emerald-300" : "bg-slate-100"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">

          {/* Error */}
          {error && (
            <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* ══════════ STEP 1 — Müşteri Profili ══════════ */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Müşteri Profili</h2>
                <p className="text-sm text-slate-400 mt-0.5">CRM müşterisini seçin veya yeni müşteri oluşturun</p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                {([
                  { key: "existing", label: "Mevcut Müşteri", Icon: UserCheck },
                  { key: "new",      label: "Yeni Müşteri",   Icon: UserPlus },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => set("customerMode", key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                      form.customerMode === key
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* Existing customer */}
              {form.customerMode === "existing" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="İsim veya telefon ile ara…"
                      value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-400 italic">Müşteri bulunamadı</p>
                      </div>
                    ) : filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setForm(prev => ({
                          ...prev,
                          customerId: c.id,
                          customerAgencyId: c.agency_id,
                          customerName: c.name,
                          customerPhone: c.phone,
                        }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                          form.customerId === c.id
                            ? "border-blue-400 bg-blue-50 shadow-sm"
                            : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm`}>
                          {initials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{c.phone}</p>
                        </div>
                        {form.customerId === c.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New customer */}
              {form.customerMode === "new" && (
                <div className="space-y-4">
                  {/* TC Lookup */}
                  <Field label="TC Kimlik / Vergi No">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="12345678901"
                        value={form.customerTc}
                        onChange={e => { set("customerTc", e.target.value); setTcMsg(null); }}
                        onKeyDown={e => e.key === "Enter" && handleTcLookup()}
                        className={inputCls}
                      />
                      <button
                        onClick={handleTcLookup}
                        disabled={tcLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60 whitespace-nowrap"
                      >
                        {tcLoading
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sorgulanıyor</>
                          : <><Search className="w-3.5 h-3.5" /> Sorgula</>}
                      </button>
                    </div>
                    {tcMsg && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {tcMsg}
                      </div>
                    )}
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "customerName",     label: "Ad Soyad *",   span: 2 },
                      { key: "customerDob",      label: "Doğum Tarihi", placeholder: "GG.AA.YYYY" },
                      { key: "customerPhone",    label: "Telefon",      placeholder: "05XX…" },
                      { key: "customerEmail",    label: "E-posta",      placeholder: "mail@…" },
                      { key: "customerCity",     label: "İl",           placeholder: "İSTANBUL" },
                      { key: "customerDistrict", label: "İlçe",         placeholder: "KADIKÖY" },
                    ].map(f => (
                      <div key={f.key} className={f.span === 2 ? "col-span-2" : ""}>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{f.label}</label>
                        <input
                          type="text"
                          placeholder={(f as { placeholder?: string }).placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP 2 — Ürün & Risk Bilgileri ══════════ */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ürün & Risk Bilgileri</h2>
                <p className="text-sm text-slate-400 mt-0.5">Sigorta türünü seçin, ardından detayları girin</p>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PRODUCTS.map(p => {
                  const active = form.productType === p.type;
                  const colors = PRODUCT_COLORS[p.group];
                  return (
                    <button
                      key={p.type}
                      onClick={() => set("productType", p.type)}
                      className={`group flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-[11px] font-semibold transition-all duration-200 ${
                        active
                          ? `${colors.activeBorder} ${colors.activeBg} shadow-sm`
                          : `${colors.border} hover:${colors.activeBorder} hover:${colors.activeBg}`
                      }`}
                    >
                      <p.Icon className={`w-5 h-5 transition-colors ${active ? colors.activeIcon : colors.icon}`} />
                      <span className={`text-center leading-tight ${active ? colors.activeIcon : "text-slate-500"}`}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Vehicle fields */}
              {isVehicle && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Car className="w-3.5 h-3.5" /> Araç Bilgileri
                  </p>

                  {/* Plaka + Ruhsat Seri */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Plaka *">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="34 ABC 123"
                          value={form.plaka}
                          onChange={e => { set("plaka", e.target.value.toUpperCase()); setPlakaMsg(null); }}
                          className={`${inputCls} font-mono uppercase`}
                        />
                        <button
                          onClick={handlePlakaLookup}
                          disabled={plakaLoading}
                          title="Plaka Sorgula"
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
                        >
                          {plakaLoading
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                      {plakaMsg && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {plakaMsg}
                        </div>
                      )}
                    </Field>
                    <Field label="Ruhsat Belge Seri/No">
                      <input
                        type="text"
                        placeholder="AB-123456"
                        value={form.ruhsatSeri}
                        onChange={e => set("ruhsatSeri", e.target.value.toUpperCase())}
                        className={`${inputCls} font-mono uppercase`}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "kullanimTarzi", label: "Kullanım Tarzı", placeholder: "OTOMOBİL" },
                      { key: "marka",         label: "Marka",          placeholder: "TOYOTA" },
                      { key: "model",         label: "Model",          placeholder: "COROLLA 1.6" },
                      { key: "modelYili",     label: "Model Yılı",     placeholder: "2020" },
                      { key: "motorNo",       label: "Motor No",       placeholder: "ABC123…" },
                      { key: "sasiNo",        label: "Şasi No",        placeholder: "WDD…" },
                      { key: "tescilTarihi",  label: "Tescil Tarihi",  placeholder: "GG.AA.YYYY" },
                      { key: "il",            label: "İl",             placeholder: "İSTANBUL" },
                      { key: "ilce",          label: "İlçe",           placeholder: "KADIKÖY" },
                    ].map(f => (
                      <Field key={f.key} label={f.label}>
                        <input
                          type="text"
                          placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {/* Property fields */}
              {isProperty && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Home className="w-3.5 h-3.5" /> Konut Bilgileri
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "il",        label: "İl",               placeholder: "İSTANBUL" },
                      { key: "ilce",      label: "İlçe",             placeholder: "KADIKÖY" },
                      { key: "metrekare", label: "Metrekare",        placeholder: "120" },
                      { key: "binaYili",  label: "Bina Yapım Yılı",  placeholder: "2005" },
                    ].map(f => (
                      <Field key={f.key} label={f.label}>
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {/* Health fields */}
              {isHealth && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5" /> Sağlık Bilgileri
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "yas",      label: "Yaş",      placeholder: "35" },
                      { key: "cinsiyet", label: "Cinsiyet", placeholder: "Erkek / Kadın" },
                      { key: "il",       label: "İl",       placeholder: "İSTANBUL" },
                      { key: "ilce",     label: "İlçe",     placeholder: "KADIKÖY" },
                    ].map(f => (
                      <Field key={f.key} label={f.label}>
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Notlar</label>
                <textarea
                  rows={2}
                  placeholder="Özel notlar, müşteri istekleri…"
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ══════════ STEP 3 — Teklif Motoru ══════════ */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Teklif Motoru</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {form.productType} sigortası · {form.customerName || "Müşteri"}
                  </p>
                </div>
                {filledCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {filledCount} teklif girildi
                  </div>
                )}
              </div>

              {/* Manuel mod banner */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Manuel teklif modunda çalışıyorsunuz</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Şirketlerden aldığınız fiyatları aşağıya girin. API entegrasyonu aktif edildiğinde teklifler otomatik gelecek.
                  </p>
                </div>
              </div>

              {/* Company table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Table head */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Şirket</div>
                  <div className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fiyat (₺)</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taksit</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Not</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-slate-50">
                  {sortedCompanies.map(c => {
                    const origIdx = form.companies.findIndex(fc => fc.name === c.name);
                    const myP     = parseFloat(c.price) || 0;
                    const isBest  = myP > 0 && myP === minPrice;
                    const isMid   = !isBest && myP > 0 && minPrice > 0 && myP <= minPrice * 1.15;

                    const priceBadge = c.price
                      ? isBest  ? "bg-emerald-500 text-white"
                        : isMid ? "bg-amber-400 text-white"
                        : "bg-rose-400 text-white"
                      : "";

                    return (
                      <div
                        key={c.name}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                          c.noOffer ? "bg-slate-50/80 opacity-60" : isBest ? "bg-emerald-50/40" : "hover:bg-slate-50/60"
                        }`}
                      >
                        {/* Company */}
                        <div className="col-span-4 flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                            isBest ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 leading-tight">{c.name}</p>
                            {isBest && <p className="text-[10px] text-emerald-600 font-semibold">En iyi fiyat</p>}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="col-span-3">
                          {c.noOffer ? (
                            <span className="text-[11px] text-slate-400 italic">Teklif yok</span>
                          ) : c.price ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${priceBadge}`}>
                              {parseInt(c.price).toLocaleString("tr-TR")} ₺
                            </span>
                          ) : (
                            <input
                              type="number"
                              placeholder="Fiyat girin"
                              value={c.price}
                              onChange={e => updateCompany(origIdx, "price", e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-300"
                            />
                          )}
                        </div>

                        {/* Installment */}
                        <div className="col-span-2">
                          {!c.noOffer && (
                            <select
                              value={c.installment}
                              onChange={e => updateCompany(origIdx, "installment", e.target.value)}
                              className="w-full text-xs border border-slate-100 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/30 bg-white"
                            >
                              {["Peşin","3 taksit","6 taksit","9 taksit","12 taksit"].map(t => <option key={t}>{t}</option>)}
                            </select>
                          )}
                        </div>

                        {/* Note */}
                        <div className="col-span-2">
                          {!c.noOffer && (
                            <input
                              type="text"
                              placeholder="Not"
                              value={c.note}
                              onChange={e => updateCompany(origIdx, "note", e.target.value)}
                              className="w-full text-xs border border-slate-100 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/30 placeholder:text-slate-300"
                            />
                          )}
                        </div>

                        {/* Toggle no-offer */}
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => {
                              updateCompany(origIdx, "noOffer", !c.noOffer);
                              if (!c.noOffer) updateCompany(origIdx, "price", "");
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                              c.noOffer
                                ? "bg-rose-50 text-rose-400 hover:bg-slate-50 hover:text-slate-400"
                                : "text-slate-200 hover:bg-rose-50 hover:text-rose-400"
                            }`}
                            title={c.noOffer ? "Tekrar aktif et" : "Teklif yok işaretle"}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Best price summary */}
                {minPrice > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-emerald-50/60 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      En iyi teklif
                    </span>
                    <span className="text-sm font-bold text-emerald-700">
                      {minPrice.toLocaleString("tr-TR")} ₺
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Fiyat girmediğiniz şirketler boş bırakılır — daha sonra düzenleme sayfasından ekleyebilirsiniz.
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step === 1 ? router.push("/quote-center") : setStep(s => s - 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? "İptal" : "Geri"}
          </button>

          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
            >
              Devam <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 disabled:opacity-60"
            >
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
                : <><Check className="w-4 h-4" /> Teklif Çalışmasını Kaydet</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
