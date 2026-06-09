"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  ChevronLeft, ChevronRight, Car, Shield, Home,
  Heart, Globe, UserCheck, UserPlus, Check,
  Search, RefreshCw, Info,
  CheckCircle2, XCircle, AlertCircle, FileText,
  Zap, User, Settings, Sparkles, Award,
  MessageSquare, Copy, Building2, AlertTriangle,
  Clock, Ban, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  DEMO_MODE, ACTIVE_PROVIDER,
  getPersonFromTc, getVehicleFromPlaka,
} from "@/lib/demo-mode";
import { DEMO_COMPANIES } from "@/lib/demo-mode";
import {
  activeProvider,
  STATUS_UI,
  type ResultStatus,
  type SourceType,
} from "@/lib/quote-providers";

// ─── Product config ───────────────────────────────────────────────────────────
type ProductGroup = "vehicle" | "property" | "health" | "travel";

const PRODUCTS = [
  { type: "Trafik",      label: "Trafik Sigortası",  group: "vehicle"   as ProductGroup, Icon: Car    },
  { type: "Kasko",       label: "Kasko Sigortası",   group: "vehicle"   as ProductGroup, Icon: Shield },
  { type: "İMM",         label: "İMM Sigortası",     group: "vehicle"   as ProductGroup, Icon: Shield },
  { type: "DASK",        label: "DASK",              group: "property"  as ProductGroup, Icon: Home   },
  { type: "Konut",       label: "Konut Sigortası",   group: "property"  as ProductGroup, Icon: Home   },
  { type: "TSS",         label: "Tamam. Sağlık",     group: "health"    as ProductGroup, Icon: Heart  },
  { type: "Ferdi Kaza",  label: "Ferdi Kaza",        group: "health"    as ProductGroup, Icon: Heart  },
  { type: "Özel Sağlık", label: "Özel Sağlık",       group: "health"    as ProductGroup, Icon: Heart  },
  { type: "Seyahat",     label: "Seyahat Sigortası", group: "travel"    as ProductGroup, Icon: Globe  },
];

const COMPANIES: Record<ProductGroup, string[]> = {
  vehicle:  DEMO_COMPANIES,
  property: ["Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Ergo Sigorta","Groupama Sigorta","Güneş Sigorta","HDI Sigorta","Mapfre Sigorta","Türkiye Sigorta","Unico Sigorta"],
  health:   ["Acıbadem Sigorta","Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Cigna Sigorta","Groupama Sigorta","Güneş Sigorta","Türkiye Sigorta"],
  travel:   ["Allianz Sigorta","Anadolu Sigorta","AXA Sigorta","Ergo Sigorta","Groupama Sigorta","Neova Sigorta","Türkiye Sigorta"],
};

const PRODUCT_COLORS: Record<ProductGroup, { border: string; bg: string; icon: string }> = {
  vehicle:  { border: "border-blue-500",  bg: "bg-blue-50",  icon: "text-blue-600"  },
  property: { border: "border-amber-500", bg: "bg-amber-50", icon: "text-amber-600" },
  health:   { border: "border-rose-500",  bg: "bg-rose-50",  icon: "text-rose-600"  },
  travel:   { border: "border-cyan-500",  bg: "bg-cyan-50",  icon: "text-cyan-600"  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CustomerMode = "existing" | "new";

type CompanyRow = {
  name:         string;
  status:       ResultStatus;
  price:        string;
  installment:  string;
  note:         string;
  sourceType:   SourceType;
  providerName: string;
  errorSource?: string | null;
  errorCode?:   string;
  errorMessage?: string;
  actionHint?:  string;
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
  customerMode: "existing", customerId: "", customerAgencyId: "",
  customerName: "", customerPhone: "", customerEmail: "", customerTc: "",
  customerDob: "", customerCity: "", customerDistrict: "",
  productType: "", plaka: "", ruhsatSeri: "", kullanimTarzi: "OTOMOBİL",
  motorNo: "", sasiNo: "", marka: "", model: "", modelYili: "", tescilTarihi: "",
  il: "", ilce: "", metrekare: "", binaYili: "", yas: "", cinsiyet: "", notes: "",
  companies: [],
};

const STEPS = [
  { label: "Müşteri Profili",       icon: User     },
  { label: "Ürün & Risk Bilgileri", icon: Settings },
  { label: "Teklif Motoru",         icon: Zap      },
];

// ─── StatusDot ────────────────────────────────────────────────────────────────
function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={`text-[11px] font-medium ${ok ? "text-emerald-700" : "text-slate-400"}`}>{label}</span>
      {ok && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />}
    </div>
  );
}

// ─── LiveFilePanel ────────────────────────────────────────────────────────────
function LiveFilePanel({ form, step }: { form: FormState; step: number }) {
  const cfg        = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle  = cfg?.group === "vehicle";
  const successN   = form.companies.filter(c => c.status === "success").length;
  const errorN     = form.companies.filter(c => STATUS_UI[c.status]?.isError).length;
  const hasQuotes  = successN > 0;

  return (
    <div className="hidden xl:flex flex-col w-64 flex-shrink-0 sticky top-6 space-y-3">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-blue-300" />
          </div>
          <p className="text-xs font-bold tracking-wider text-slate-300 uppercase">Teklif Dosyası</p>
          {DEMO_MODE && (
            <span className="ml-auto text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">DEMO</span>
          )}
        </div>
        <div className="flex gap-1 mb-2.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
              i < step ? "bg-emerald-400" : i === step - 1 ? "bg-blue-400" : "bg-white/10"
            }`} />
          ))}
        </div>
        <p className="text-[11px] text-slate-400">Adım {step}/{STEPS.length} · {STEPS[step-1].label}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <UserCheck className="w-3 h-3" /> Kişi Bilgileri
        </p>
        {[
          { label: "Müşteri",   val: form.customerName  },
          { label: "TC/VKN",    val: form.customerTc    },
          { label: "Telefon",   val: form.customerPhone  },
          { label: "İl",        val: form.customerCity   },
          { label: "D. Tarihi", val: form.customerDob   },
        ].map(r => (
          <div key={r.label} className="flex justify-between gap-2">
            <span className="text-[11px] text-slate-400">{r.label}</span>
            <span className={`text-[11px] font-semibold text-right truncate max-w-[110px] ${r.val ? "text-slate-700" : "text-slate-300"}`}>{r.val || "—"}</span>
          </div>
        ))}
      </div>

      {isVehicle && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Car className="w-3 h-3" /> Araç
          </p>
          {[
            { label: "Plaka",  val: form.plaka     },
            { label: "Marka",  val: form.marka     },
            { label: "Model",  val: form.model     },
            { label: "Yıl",    val: form.modelYili },
          ].map(r => (
            <div key={r.label} className="flex justify-between gap-2">
              <span className="text-[11px] text-slate-400">{r.label}</span>
              <span className={`text-[11px] font-semibold font-mono text-right truncate max-w-[110px] ${r.val ? "text-slate-700" : "text-slate-300"}`}>{r.val || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {form.companies.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Engine Özeti</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-emerald-50 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-emerald-600">{successN}</p>
              <p className="text-[10px] text-emerald-600">Başarılı</p>
            </div>
            <div className="flex-1 bg-rose-50 rounded-xl p-2 text-center">
              <p className="text-base font-bold text-rose-500">{errorN}</p>
              <p className="text-[10px] text-rose-500">Hata</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-2.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operasyon</p>
        <StatusDot ok={!!(form.customerName || form.customerId)} label="Müşteri bilgisi" />
        <StatusDot ok={!!form.customerTc}  label="Kimlik bilgisi" />
        {isVehicle && <StatusDot ok={!!(form.plaka && form.marka)} label="Araç bilgisi" />}
        <StatusDot ok={!!form.productType} label="Ürün seçildi" />
        <StatusDot ok={hasQuotes}          label="Teklif motoru" />
      </div>
    </div>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder:text-slate-400 transition-all";

// ─── ErrorDetailPanel ─────────────────────────────────────────────────────────
function ErrorDetailPanel({ row, onClose }: { row: CompanyRow; onClose: () => void }) {
  const ui = STATUS_UI[row.status];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${
          row.status === "sbm_error"      ? "bg-amber-50 border-b border-amber-200"  :
          row.status === "company_error"  ? "bg-orange-50 border-b border-orange-200" :
          row.status === "timeout"        ? "bg-rose-50 border-b border-rose-200"    :
          "bg-slate-50 border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center text-sm font-bold text-slate-700 shadow-sm">
              {row.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{row.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ui.badgeCls}`}>{ui.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Source & code */}
          <div className="grid grid-cols-2 gap-3">
            {row.errorSource && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kaynak</p>
                <p className="text-sm font-bold text-slate-800">{row.errorSource}</p>
              </div>
            )}
            {row.errorCode && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hata Kodu</p>
                <p className="text-xs font-mono font-bold text-slate-800 break-all">{row.errorCode}</p>
              </div>
            )}
          </div>

          {/* Message */}
          {row.errorMessage && (
            <div className={`rounded-xl p-3.5 border ${
              row.status === "sbm_error"     ? "bg-amber-50 border-amber-200"  :
              row.status === "company_error" ? "bg-orange-50 border-orange-200" :
              "bg-rose-50 border-rose-200"
            }`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Hata Mesajı</p>
              <p className="text-sm text-slate-700 leading-relaxed">{row.errorMessage}</p>
            </div>
          )}

          {/* Action hint */}
          {row.actionHint && (
            <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-1">Önerilen Aksiyon</p>
                <p className="text-sm text-blue-800 leading-relaxed">{row.actionHint}</p>
              </div>
            </div>
          )}

          {/* Provider info */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
            <span>Kaynak: {row.providerName}</span>
            <span className="font-mono">{row.sourceType}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ResultStatusBadge ────────────────────────────────────────────────────────
function ResultStatusBadge({ status }: { status: ResultStatus }) {
  const ui = STATUS_UI[status];
  const Icon =
    status === "running"       ? RefreshCw   :
    status === "success"       ? CheckCircle2 :
    status === "no_offer"      ? Ban         :
    status === "sbm_error"     ? AlertTriangle :
    status === "company_error" ? AlertCircle  :
    status === "timeout"       ? Clock        :
    status === "cancelled"     ? XCircle      :
    null;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ui.badgeCls}`}>
      {Icon && <Icon className={`w-3 h-3 ${status === "running" ? "animate-spin" : ""}`} />}
      {ui.label}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NewQuoteRunPage() {
  const router             = useRouter();
  const { role, agencyId } = useAuth();

  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const [tcLoading,    setTcLoading]    = useState(false);
  const [tcMsg,        setTcMsg]        = useState<{ type: "success"|"info"; text: string }|null>(null);
  const [plakaLoading, setPlakaLoading] = useState(false);
  const [plakaMsg,     setPlakaMsg]     = useState<{ type: "success"|"info"; text: string }|null>(null);

  const [customers,  setCustomers]  = useState<Array<{ id: string; name: string; phone: string; agency_id: string }>>([]);
  const [custSearch, setCustSearch] = useState("");
  const [agencies,   setAgencies]   = useState<Array<{ id: string; name: string }>>([]);
  const [adminAgencyId, setAdminAgencyId] = useState("");

  const [simulating, setSimulating] = useState(false);
  const [waCopied,   setWaCopied]   = useState(false);
  const [errorPanel, setErrorPanel] = useState<CompanyRow | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const tcTimer    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const plakaTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── Customers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from("customers") as any).select("id, name, phone, agency_id").order("name");
      if (role === "agency_user" && agencyId) q = q.eq("agency_id", agencyId);
      const { data } = await q;
      setCustomers(data ?? []);
    }
    load();
  }, [role, agencyId]);

  // ── Agencies (super_admin) ─────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "super_admin") return;
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("agencies") as any).select("id, name").order("name");
      setAgencies(data ?? []);
    }
    load();
  }, [role]);

  // ── Reset companies when product changes ──────────────────────────────────
  useEffect(() => {
    const cfg = PRODUCTS.find(p => p.type === form.productType);
    if (!cfg) return;
    const list = COMPANIES[cfg.group].map<CompanyRow>(name => ({
      name, status: "pending", price: "", installment: "Peşin",
      note: "", sourceType: activeProvider.sourceType, providerName: activeProvider.name,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(prev => ({ ...prev, companies: list }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productType]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function updateCompany(idx: number, patch: Partial<CompanyRow>) {
    setForm(prev => {
      const companies = [...prev.companies];
      companies[idx]  = { ...companies[idx], ...patch };
      return { ...prev, companies };
    });
  }

  // ── TC Lookup ─────────────────────────────────────────────────────────────
  function handleTcLookup() {
    const tc = form.customerTc.trim();
    if (tc.length < 10) return;
    setTcLoading(true); setTcMsg(null);
    if (tcTimer.current) clearTimeout(tcTimer.current);
    tcTimer.current = setTimeout(() => {
      if (DEMO_MODE) {
        const p = getPersonFromTc(tc);
        setForm(prev => ({
          ...prev,
          customerName:     prev.customerName     || p.name,
          customerCity:     prev.customerCity     || p.city,
          customerDistrict: prev.customerDistrict || p.district,
          customerDob:      prev.customerDob      || p.dob,
        }));
        setTcMsg({ type: "success", text: "Kimlik bilgileri getirildi. Lütfen kontrol ederek devam edin." });
      } else {
        setTcMsg({ type: "info", text: "TC kimlik sorgulama entegrasyonu aktif değil. Bilgileri manuel girebilirsiniz." });
      }
      setTcLoading(false);
    }, DEMO_MODE ? 1200 : 600);
  }

  // ── Plaka Lookup ──────────────────────────────────────────────────────────
  function handlePlakaLookup() {
    const plaka = form.plaka.trim();
    if (plaka.length < 5) return;
    setPlakaLoading(true); setPlakaMsg(null);
    if (plakaTimer.current) clearTimeout(plakaTimer.current);
    plakaTimer.current = setTimeout(() => {
      if (DEMO_MODE) {
        const v = getVehicleFromPlaka(plaka);
        setForm(prev => ({
          ...prev,
          marka:        prev.marka        || v.marka,
          model:        prev.model        || v.model,
          modelYili:    prev.modelYili    || v.modelYili,
          kullanimTarzi:prev.kullanimTarzi|| v.kullanimTarzi,
          motorNo:      prev.motorNo      || v.motorNo,
          sasiNo:       prev.sasiNo       || v.sasiNo,
          tescilTarihi: prev.tescilTarihi || v.tescilTarihi,
        }));
        setPlakaMsg({ type: "success", text: "Araç bilgileri getirildi. Lütfen kontrol ederek devam edin." });
      } else {
        setPlakaMsg({ type: "info", text: "Araç sorgulama entegrasyonu aktif değil. Bilgileri manuel doldurun." });
      }
      setPlakaLoading(false);
    }, DEMO_MODE ? 1000 : 600);
  }

  // ── Demo simulation ───────────────────────────────────────────────────────
  const simulateDemoQuotes = useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    setExpandedRows(new Set());

    // Reset all to running
    setForm(prev => ({
      ...prev,
      companies: prev.companies.map(c => ({
        ...c, status: "running" as ResultStatus, price: "",
      })),
    }));

    const seed = form.customerTc || form.plaka || form.customerName;

    // Run provider (sync — demo returns instantly)
    const providerResults = await activeProvider.runQuote({
      productType: form.productType,
      companyNames: form.companies.map(c => c.name),
      seed,
      customerTc:   form.customerTc,
      plaka:        form.plaka,
      customerName: form.customerName,
    });

    // Staggered reveal: 1-4 seconds per company
    providerResults.forEach((result, idx) => {
      const delay = 1000 + Math.random() * 3000;
      setTimeout(() => {
        setForm(prev => {
          const companies = [...prev.companies];
          const origIdx   = companies.findIndex(c => c.name === result.companyName);
          if (origIdx === -1) return prev;
          companies[origIdx] = {
            ...companies[origIdx],
            status:       result.status,
            price:        result.price != null ? String(result.price) : "",
            installment:  result.installment ?? "Peşin",
            note:         result.note ?? "",
            sourceType:   result.sourceType,
            providerName: result.providerName,
            errorSource:  result.errorSource ?? null,
            errorCode:    result.errorCode,
            errorMessage: result.errorMessage,
            actionHint:   result.actionHint,
          };
          return { ...prev, companies };
        });
        // Mark done after last one
        if (idx === providerResults.length - 1) {
          setTimeout(() => setSimulating(false), 200);
        }
      }, delay);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.companies.length, form.productType, form.customerTc, form.plaka, form.customerName, simulating]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (step === 1) {
      if (form.customerMode === "existing" && !form.customerId) return "Lütfen bir müşteri seçin";
      if (form.customerMode === "new" && !form.customerName.trim()) return "Ad Soyad zorunludur";
    }
    if (step === 2 && !form.productType) return "Lütfen bir sigorta türü seçin";
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
    setSaving(true); setError(null);
    try {
      const cfg = PRODUCTS.find(p => p.type === form.productType);
      const effectiveAgencyId =
        agencyId || form.customerAgencyId || adminAgencyId || undefined;

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
        .filter(c => c.status !== "pending")
        .map(c => ({
          company_name:  c.name,
          price:         c.price ? parseFloat(c.price) : null,
          installment:   c.installment,
          note:          c.note || null,
          status:        c.status === "success" ? "Aktif"
                       : c.status === "no_offer" ? "Teklif Yok"
                       : c.status,
          source_type:   c.sourceType,
          provider_name: c.providerName,
          error_source:  c.errorSource ?? null,
          error_code:    c.errorCode   ?? null,
          error_message: c.errorMessage ?? null,
          action_hint:   c.actionHint  ?? null,
          raw_response:  {},
        }));

      const successN = form.companies.filter(c => c.status === "success").length;
      const errorN   = form.companies.filter(c => STATUS_UI[c.status]?.isError).length;

      const res = await fetch("/api/quote-runs", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id:       effectiveAgencyId ?? null,
          customer_id:     form.customerMode === "existing" ? form.customerId || null : null,
          create_customer: form.customerMode === "new",
          customer_name:   form.customerName,
          customer_phone:  form.customerPhone,
          customer_email:  form.customerEmail,
          customer_tc:     form.customerTc,
          product_type:    form.productType,
          product_data:    productData,
          notes:           form.notes || null,
          provider_type:   activeProvider.sourceType,
          success_count:   successN,
          error_count:     errorN,
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

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function buildWizardWhatsApp(): string {
    const top = [...form.companies]
      .filter(c => c.status === "success" && c.price)
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, 5);
    if (top.length === 0) return "";
    const lines = top.map((c, i) =>
      `${i === 0 ? "🏆" : `${i + 1}.`} ${c.name}: ${parseInt(c.price).toLocaleString("tr-TR")} ₺${c.installment && c.installment !== "Peşin" ? ` (${c.installment})` : ""}`
    );
    return `Merhaba ${form.customerName || "Sayın Müşterimiz"},\n\n${form.productType} sigortanız için teklifleriniz hazır:\n\n${lines.join("\n")}\n\nEn uygun seçenek için sizi arayacağız.\n\nİyi günler dileriz.`;
  }

  // ── AI Analysis ───────────────────────────────────────────────────────────
  function buildAiAnalysis(): { icon: React.ReactNode; text: string; cls: string }[] {
    const successC = form.companies.filter(c => c.status === "success" && c.price);
    const sbmC     = form.companies.filter(c => c.status === "sbm_error");
    const timeoutC = form.companies.filter(c => c.status === "timeout");
    const errC     = form.companies.filter(c => c.status === "company_error");
    const total    = form.companies.length;

    const bullets: { icon: React.ReactNode; text: string; cls: string }[] = [];

    if (successC.length === 0) {
      bullets.push({ icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Henüz başarılı teklif alınamadı.", cls: "text-slate-400" });
      return bullets;
    }

    const sorted = [...successC].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    const best   = sorted[0];
    const avg    = Math.round(successC.reduce((s, c) => s + parseFloat(c.price), 0) / successC.length);
    const alts   = sorted.slice(1, 3).map(c => c.name.replace(" Sigorta", "")).join(", ");

    bullets.push({ icon: <Award className="w-3.5 h-3.5" />, text: `${best.name} en uygun teklifi sundu: ${parseInt(best.price).toLocaleString("tr-TR")} ₺`, cls: "text-emerald-300" });
    if (alts) bullets.push({ icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: `Alternatifler: ${alts}`, cls: "text-blue-300" });
    bullets.push({ icon: <Sparkles className="w-3.5 h-3.5" />, text: `${total} şirketten ${successC.length}'i teklif verdi — ortalama ${avg.toLocaleString("tr-TR")} ₺`, cls: "text-violet-300" });

    if (sbmC.length > 0) {
      bullets.push({ icon: <AlertTriangle className="w-3.5 h-3.5" />, text: `${sbmC.length} şirket SBM kural hatası döndürdü (${sbmC.map(c => c.name.replace(" Sigorta","")).join(", ")})`, cls: "text-amber-300" });
    }
    if (timeoutC.length > 0) {
      bullets.push({ icon: <Clock className="w-3.5 h-3.5" />, text: `${timeoutC.length} şirket zaman aşımına uğradı`, cls: "text-rose-300" });
    }
    if (errC.length > 0) {
      bullets.push({ icon: <AlertCircle className="w-3.5 h-3.5" />, text: `${errC.length} şirket sistem hatası bildirdi`, cls: "text-orange-300" });
    }

    return bullets;
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const productCfg  = PRODUCTS.find(p => p.type === form.productType);
  const isVehicle   = productCfg?.group === "vehicle";
  const isProperty  = productCfg?.group === "property";
  const isHealth    = productCfg?.group === "health";

  const filteredCustomers = customers.filter(c =>
    !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  );

  const successCount = form.companies.filter(c => c.status === "success").length;
  const errorCount   = form.companies.filter(c => STATUS_UI[c.status]?.isError).length;
  const allResolved  = form.companies.length > 0 && form.companies.every(c => c.status !== "running" && c.status !== "pending");

  const filledPrices = form.companies.filter(c => c.status === "success").map(c => parseFloat(c.price) || 0).filter(p => p > 0);
  const minPrice     = filledPrices.length > 0 ? Math.min(...filledPrices) : 0;

  // Sort: success (cheapest first), no_offer, errors, pending/running
  const sortedCompanies = [...form.companies].sort((a, b) => {
    const rank = (s: ResultStatus) =>
      s === "success"       ? 0 :
      s === "no_offer"      ? 3 :
      s === "running"       ? 4 :
      s === "pending"       ? 5 :
      2; // errors
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (a.status === "success" && b.status === "success")
      return (parseFloat(a.price)||0) - (parseFloat(b.price)||0);
    return 0;
  });

  function initials(name: string) {
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function toggleExpanded(name: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 items-start">
      <LiveFilePanel form={form} step={step} />

      {/* Error detail modal */}
      {errorPanel && (
        <ErrorDetailPanel row={errorPanel} onClose={() => setErrorPanel(null)} />
      )}

      <div className="flex-1 min-w-0 space-y-5">

        {/* Demo banner */}
        {DEMO_MODE && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-amber-800">DEMO MODE</span>
            <span className="text-xs text-amber-700">· Örnek veriler kullanılmaktadır. Provider: <span className="font-mono font-bold">{ACTIVE_PROVIDER}</span></span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/quote-center" className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Teklif Çalışması Başlat</h1>
            <p className="text-sm text-slate-400">{STEPS[step - 1].label}</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const idx = i + 1; const done = step > idx; const cur = step === idx;
            const SI = s.icon;
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                  cur  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : done ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                  : "bg-slate-100 text-slate-400"
                }`}>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {done ? <Check className="w-3 h-3" /> : cur ? <SI className="w-3 h-3" /> : <span className="text-[10px] font-bold">{idx}</span>}
                  </div>
                  <span className="hidden sm:block whitespace-nowrap">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${step > idx ? "bg-emerald-300" : "bg-slate-100"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
          {error && (
            <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* ══ STEP 1 ══ */}
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
                  { key: "new",      label: "Yeni Müşteri",   Icon: UserPlus  },
                ] as const).map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => set("customerMode", key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.customerMode === key ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* Existing customer list */}
              {form.customerMode === "existing" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="İsim veya telefon ile ara…" value={custSearch}
                      onChange={e => setCustSearch(e.target.value)} className={`${inputCls} pl-10`}
                    />
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-8"><p className="text-sm text-slate-400 italic">Müşteri bulunamadı</p></div>
                    ) : filteredCustomers.map(c => (
                      <button key={c.id}
                        onClick={() => setForm(prev => ({ ...prev, customerId: c.id, customerAgencyId: c.agency_id, customerName: c.name, customerPhone: c.phone }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          form.customerId === c.id ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
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
                  {/* Super admin: agency selector */}
                  {role === "super_admin" && (
                    <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-200">
                      <label className="block text-[11px] font-bold text-violet-700 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Acente Seç *
                      </label>
                      <select value={adminAgencyId} onChange={e => setAdminAgencyId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-all"
                      >
                        <option value="">— Acente seçin —</option>
                        {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  )}

                  <Field label="TC Kimlik / Vergi No">
                    <div className="flex gap-2">
                      <input type="text" placeholder="12345678901" value={form.customerTc}
                        onChange={e => { set("customerTc", e.target.value); setTcMsg(null); }}
                        onKeyDown={e => e.key === "Enter" && handleTcLookup()} className={inputCls}
                      />
                      <button onClick={handleTcLookup} disabled={tcLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-60 whitespace-nowrap"
                      >
                        {tcLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sorgulanıyor</> : <><Search className="w-3.5 h-3.5" /> Sorgula</>}
                      </button>
                    </div>
                    {tcMsg && (
                      <div className={`mt-1.5 flex items-start gap-1.5 text-[11px] rounded-lg px-3 py-2 border ${
                        tcMsg.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
                      }`}>
                        {tcMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                        {tcMsg.text}
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
                        <input type="text" placeholder={(f as { placeholder?: string }).placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)} className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2 ══ */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Ürün & Risk Bilgileri</h2>
                <p className="text-sm text-slate-400 mt-0.5">Sigorta türünü seçin, ardından detayları girin</p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PRODUCTS.map(p => {
                  const active = form.productType === p.type;
                  const col    = PRODUCT_COLORS[p.group];
                  return (
                    <button key={p.type} onClick={() => set("productType", p.type)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-[11px] font-semibold transition-all ${
                        active ? `${col.border} ${col.bg} shadow-sm` : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p.Icon className={`w-5 h-5 ${active ? col.icon : "text-slate-400"}`} />
                      <span className={`text-center leading-tight ${active ? col.icon : "text-slate-500"}`}>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {isVehicle && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Car className="w-3.5 h-3.5" /> Araç Bilgileri</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Plaka *">
                      <div className="flex gap-2">
                        <input type="text" placeholder="34 ABC 123" value={form.plaka}
                          onChange={e => { set("plaka", e.target.value.toUpperCase()); setPlakaMsg(null); }}
                          className={`${inputCls} font-mono uppercase`}
                        />
                        <button onClick={handlePlakaLookup} disabled={plakaLoading}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                        >
                          {plakaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                      {plakaMsg && (
                        <div className={`mt-1.5 flex items-start gap-1.5 text-[11px] rounded-lg px-3 py-2 border ${
                          plakaMsg.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
                        }`}>
                          {plakaMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                          {plakaMsg.text}
                        </div>
                      )}
                    </Field>
                    <Field label="Ruhsat Belge Seri/No">
                      <input type="text" placeholder="AB-123456" value={form.ruhsatSeri}
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
                        <input type="text" placeholder={f.placeholder}
                          value={form[f.key as keyof FormState] as string}
                          onChange={e => set(f.key as keyof FormState, e.target.value)} className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {isProperty && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Home className="w-3.5 h-3.5" /> Konut Bilgileri</p>
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
                          onChange={e => set(f.key as keyof FormState, e.target.value)} className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              {isHealth && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Heart className="w-3.5 h-3.5" /> Sağlık Bilgileri</p>
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
                          onChange={e => set(f.key as keyof FormState, e.target.value)} className={inputCls}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Notlar</label>
                <textarea rows={2} placeholder="Özel notlar, müşteri istekleri…"
                  value={form.notes} onChange={e => set("notes", e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ══ STEP 3 ══ */}
          {step === 3 && (
            <div className="p-6 space-y-5">

              {/* Header row */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Teklif Motoru</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{form.productType} sigortası · {form.customerName || "Müşteri"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Summary chips */}
                  {successCount > 0 && !simulating && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />{successCount} teklif
                    </span>
                  )}
                  {errorCount > 0 && !simulating && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />{errorCount} hata
                    </span>
                  )}
                  {simulating && (
                    <span className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Toplanıyor…
                    </span>
                  )}
                  {DEMO_MODE && (
                    <button onClick={simulateDemoQuotes} disabled={simulating}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-sm shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 transition-all"
                    >
                      {simulating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Toplanıyor…</> : <><Zap className="w-3.5 h-3.5" /> Teklifleri Getir</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Mode info */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${DEMO_MODE ? "bg-indigo-50 border-indigo-200" : "bg-blue-50 border-blue-200"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${DEMO_MODE ? "bg-indigo-600" : "bg-blue-600"}`}>
                  <Info className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${DEMO_MODE ? "text-indigo-800" : "text-blue-800"}`}>
                    {DEMO_MODE ? "Demo modu — Örnek teklif verileri" : "Manuel teklif modu"}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${DEMO_MODE ? "text-indigo-600" : "text-blue-600"}`}>
                    {DEMO_MODE
                      ? "\"Teklifleri Getir\" ile şirket simülasyonunu başlatın. Hata satırlarına tıklayarak detayları görün."
                      : "Şirketlerden aldığınız fiyatları aşağıya girin."}
                  </p>
                </div>
              </div>

              {/* Company table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Şirket</div>
                  <div className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fiyat / Durum</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taksit</div>
                  <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Not</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-slate-50">
                  {sortedCompanies.map(c => {
                    const origIdx = form.companies.findIndex(fc => fc.name === c.name);
                    const myP   = parseFloat(c.price) || 0;
                    const isBest = myP > 0 && myP === minPrice;
                    const isMid  = !isBest && myP > 0 && minPrice > 0 && myP <= minPrice * 1.15;
                    const ui    = STATUS_UI[c.status];
                    const hasErr = ui.isError;
                    const isExpanded = expandedRows.has(c.name);

                    const priceBadge =
                      isBest ? "bg-emerald-500 text-white" :
                      isMid  ? "bg-amber-400 text-white"   :
                      myP > 0 ? "bg-rose-400 text-white"  :
                      "";

                    return (
                      <div key={c.name}>
                        <div className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-all ${ui.rowCls}`}>
                          {/* Company name */}
                          <div className="col-span-4 flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                              isBest ? "bg-emerald-100 text-emerald-700" :
                              c.status === "running" ? "bg-blue-50 text-blue-400" :
                              hasErr ? "bg-rose-50 text-rose-500" :
                              "bg-indigo-50 text-indigo-600"
                            }`}>
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 leading-tight truncate">{c.name}</p>
                              {isBest && <p className="text-[9px] font-bold text-emerald-600">🏆 En Uygun</p>}
                            </div>
                          </div>

                          {/* Price / Status */}
                          <div className="col-span-3">
                            {c.status === "running" ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-blue-500">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Çalışıyor…
                              </div>
                            ) : c.status === "pending" ? (
                              <span className="text-[11px] text-slate-400">Bekliyor</span>
                            ) : c.status === "success" && c.price ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${priceBadge}`}>
                                  {parseInt(c.price).toLocaleString("tr-TR")} ₺
                                </span>
                                <button onClick={() => updateCompany(origIdx, { status: "pending" as ResultStatus })}
                                  className="text-[10px] text-slate-400 hover:text-slate-600" title="Düzenle">✎</button>
                              </div>
                            ) : c.status === "no_offer" ? (
                              <span className="text-[11px] text-slate-400 italic">Teklif Yok</span>
                            ) : hasErr ? (
                              <ResultStatusBadge status={c.status} />
                            ) : (
                              <input type="number" placeholder="Fiyat girin" value={c.price}
                                onChange={e => {
                                  updateCompany(origIdx, {
                                    price: e.target.value,
                                    status: e.target.value ? "success" as ResultStatus : "pending" as ResultStatus,
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 placeholder:text-slate-300"
                              />
                            )}
                          </div>

                          {/* Installment */}
                          <div className="col-span-2">
                            {(c.status === "success" || c.status === "pending") && (
                              <select value={c.installment}
                                onChange={e => updateCompany(origIdx, { installment: e.target.value })}
                                className="w-full text-xs border border-slate-100 rounded-lg px-1.5 py-1.5 focus:outline-none bg-white"
                              >
                                {["Peşin","3 taksit","6 taksit","9 taksit","12 taksit"].map(t => <option key={t}>{t}</option>)}
                              </select>
                            )}
                          </div>

                          {/* Note */}
                          <div className="col-span-2">
                            {(c.status === "success" || c.status === "pending") && (
                              <input type="text" placeholder="Not" value={c.note}
                                onChange={e => updateCompany(origIdx, { note: e.target.value })}
                                className="w-full text-xs border border-slate-100 rounded-lg px-1.5 py-1.5 focus:outline-none placeholder:text-slate-300"
                              />
                            )}
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 flex justify-end gap-1">
                            {hasErr && (
                              <button onClick={() => setErrorPanel(c)}
                                className="w-6 h-6 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors"
                                title="Hata detayı"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!hasErr && c.status !== "running" && (
                              <button
                                onClick={() => {
                                  if (c.status === "no_offer") {
                                    updateCompany(origIdx, { status: "pending" as ResultStatus });
                                  } else {
                                    updateCompany(origIdx, { status: "no_offer" as ResultStatus, price: "" });
                                  }
                                }}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                                  c.status === "no_offer" ? "bg-rose-50 text-rose-400" : "text-slate-200 hover:bg-rose-50 hover:text-rose-400"
                                }`}
                                title={c.status === "no_offer" ? "Tekrar aktif et" : "Teklif yok işaretle"}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {hasErr && (
                              <button onClick={() => toggleExpanded(c.name)}
                                className="w-6 h-6 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center"
                                title="Detay satırı"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline error detail row */}
                        {hasErr && isExpanded && (
                          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                            <div className="flex items-start gap-3 flex-wrap">
                              {c.errorSource && (
                                <div className="text-xs">
                                  <span className="font-bold text-slate-500">Kaynak: </span>
                                  <span className="font-mono text-slate-700">{c.errorSource}</span>
                                </div>
                              )}
                              {c.errorCode && (
                                <div className="text-xs">
                                  <span className="font-bold text-slate-500">Kod: </span>
                                  <span className="font-mono text-slate-700">{c.errorCode}</span>
                                </div>
                              )}
                              {c.errorMessage && (
                                <div className="text-xs flex-1 min-w-full mt-1">
                                  <span className="font-bold text-slate-500">Mesaj: </span>
                                  <span className="text-slate-700">{c.errorMessage}</span>
                                </div>
                              )}
                              {c.actionHint && (
                                <div className="text-xs flex-1 min-w-full mt-0.5 text-blue-600">
                                  <span className="font-bold">Aksiyon: </span>{c.actionHint}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Best price footer */}
                {minPrice > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-emerald-50/60 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> En iyi teklif
                    </span>
                    <span className="text-sm font-bold text-emerald-700">{minPrice.toLocaleString("tr-TR")} ₺</span>
                  </div>
                )}
              </div>

              {/* ── AI Analysis ── */}
              {allResolved && successCount >= 1 && (() => {
                const bullets = buildAiAnalysis();
                return bullets.length > 0 ? (
                  <div className="relative overflow-hidden rounded-2xl p-4"
                    style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0c1a3d 100%)" }}
                  >
                    <div className="absolute inset-0 opacity-[0.04]"
                      style={{ backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)", backgroundSize: "16px 16px" }}
                    />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-blue-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white mb-2">AI Teklif Analizi</p>
                        <ul className="space-y-1.5">
                          {bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className={`flex-shrink-0 mt-0.5 ${b.cls}`}>{b.icon}</span>
                              <span className={`text-[11px] leading-relaxed ${b.cls}`}>{b.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* ── WhatsApp Panel ── */}
              {allResolved && successCount >= 1 && (() => {
                const waMsg = buildWizardWhatsApp();
                if (!waMsg) return null;
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">WhatsApp Mesajı</h3>
                          <p className="text-[11px] text-slate-400">En iyi {Math.min(successCount, 5)} teklif hazırlandı</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(waMsg); setWaCopied(true); setTimeout(() => setWaCopied(false), 2000); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          {waCopied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopyalandı!</> : <><Copy className="w-3.5 h-3.5" /> Kopyala</>}
                        </button>
                        {form.customerPhone && (
                          <a href={`https://wa.me/${form.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-500/20"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp&apos;ta Gönder
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">{waMsg}</pre>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[11px] text-slate-400 text-center">
                Hatalı satırlar kaydedilir — detay sayfasından sonradan güncelleyebilirsiniz.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => step === 1 ? router.push("/quote-center") : setStep(s => s - 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />{step === 1 ? "İptal" : "Geri"}
          </button>
          {step < STEPS.length ? (
            <button onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              Devam <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60"
            >
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Kaydediliyor…</> : <><Check className="w-4 h-4" /> Teklif Çalışmasını Kaydet</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
