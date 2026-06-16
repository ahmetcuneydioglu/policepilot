"use client";

/**
 * Plan Yönetimi — /admin/plans (yalnız super_admin)
 * 3 plan kartı (Starter / Growth / Enterprise): aylık fiyat + 7 taban limit;
 * her kart inline "Düzenle" → PATCH { type:"plan", plan, patch:{...} }.
 * Eklenti Fiyatları bölümü: 4 eklentinin unit_price'ı → PATCH { type:"addon", key, patch:{ unit_price } }.
 *
 * API: GET/PATCH /api/admin/plans  (Faz 2 — zaten yazıldı, yalnızca tüketiyoruz).
 * Referans desen: app/admin/agencies/[id]/page.tsx · SubscriptionEditor (DOKUNMADIK).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Layers, Users, UserSquare2, Zap, FileText, HardDrive, Sparkles,
  MessageCircle, CreditCard, Pencil, X, RefreshCw,
} from "lucide-react";
import {
  PageHeader, SectionCard, LoadingGrid, ErrorBox, fmtMoney, fmtNum,
} from "@/components/admin/ui";

// ─── Tipler (API sözleşmesi) ──────────────────────────────────────────────────

type PlanRow = {
  plan: "starter" | "pro" | "enterprise";
  label: string;
  monthly_price: number;
  base_users: number;
  base_customers: number;
  base_requests: number;
  base_policies: number;
  base_storage_mb: number;
  base_ai_credits: number;
  base_wa_monthly: number;
  modules: string[];
};

type AddonRow = {
  key: string;
  label: string;
  unit_label: string;
  unit_price: number;
  grants_metric: string | null;
  grant_per_unit: number;
  is_entitlement: boolean;
  is_active: boolean;
  sort_order: number;
};

// Plan görsel sırası + vurgu tonu (starter→pro→enterprise)
const PLAN_ORDER: PlanRow["plan"][] = ["starter", "pro", "enterprise"];
const PLAN_TONE: Record<PlanRow["plan"], { ring: string; head: string; accent: string }> = {
  starter:    { ring: "ring-slate-100",  head: "from-slate-600 to-slate-700",   accent: "text-slate-700" },
  pro:        { ring: "ring-indigo-100", head: "from-indigo-500 to-violet-600", accent: "text-indigo-700" },
  enterprise: { ring: "ring-violet-100", head: "from-violet-500 to-purple-600", accent: "text-violet-700" },
};

// 7 taban limit alanı — etiket + ikon (kart gösterimi ve form için ortak)
const LIMIT_FIELDS: { key: keyof PlanRow; label: string; Icon: typeof Users; suffix?: string }[] = [
  { key: "base_users",      label: "Kullanıcı",   Icon: Users },
  { key: "base_customers",  label: "Müşteri",     Icon: UserSquare2 },
  { key: "base_requests",   label: "Teklif",      Icon: Zap },
  { key: "base_policies",   label: "Poliçe",      Icon: FileText },
  { key: "base_storage_mb", label: "Depolama",    Icon: HardDrive, suffix: "MB" },
  { key: "base_ai_credits", label: "AI Kredisi",  Icon: Sparkles },
  { key: "base_wa_monthly", label: "WhatsApp/Ay", Icon: MessageCircle },
];

const INPUT =
  "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50";

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const [plans, setPlans]   = useState<PlanRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/plans");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Planlar yüklenemedi.");
      setPlans(json.plans ?? []);
      setAddons(json.addons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingGrid rows={2} cols={3} />;
  if (error)   return <ErrorBox message={error} />;

  // Plana göre kartları sabit sırada diz (eksik plan varsa atla)
  const ordered = PLAN_ORDER
    .map(p => plans.find(x => x.plan === p))
    .filter((x): x is PlanRow => Boolean(x));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan Yönetimi"
        subtitle="Paket fiyatları, taban limitleri ve eklenti birim fiyatları"
        Icon={Layers}
        actions={
          <button onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
        }
      />

      {/* ── Plan kartları ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ordered.map(p => (
          <PlanCard key={p.plan} plan={p} onSaved={load} />
        ))}
      </div>

      {/* ── Eklenti fiyatları ── */}
      <AddonPricing addons={addons} onSaved={load} />
    </div>
  );
}

// ─── Plan kartı (görüntü + inline düzenleme) ──────────────────────────────────

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const tone = PLAN_TONE[plan.plan];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 ring-1 ${tone.ring} shadow-sm overflow-hidden flex flex-col`}>
      {/* Başlık şeridi */}
      <div className={`px-5 py-4 bg-gradient-to-r ${tone.head} flex items-center justify-between gap-3`}>
        <div>
          <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{plan.plan}</p>
          <p className="text-base font-bold text-white leading-tight">{plan.label}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-white leading-none">{fmtMoney(plan.monthly_price)}</p>
          <p className="text-[10px] font-semibold text-white/70 mt-0.5">/ ay</p>
        </div>
      </div>

      {editing ? (
        <PlanEditForm plan={plan} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} />
      ) : (
        <>
          {/* Taban limitler */}
          <div className="p-5 space-y-2.5 flex-1">
            {LIMIT_FIELDS.map(f => (
              <div key={String(f.key)} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                  <f.Icon className="w-3.5 h-3.5 text-slate-400" /> {f.label}
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {fmtNum(plan[f.key] as number)}{f.suffix ? ` ${f.suffix}` : ""}
                </span>
              </div>
            ))}
            {plan.modules?.length > 0 && (
              <div className="pt-2 border-t border-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Modüller</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.modules.map(m => (
                    <span key={m} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">{m}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-5 pb-5">
            <button onClick={() => setEditing(true)}
              className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold ${tone.accent} hover:bg-slate-50 transition-all`}>
              <Pencil className="w-3.5 h-3.5" /> Düzenle
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlanEditForm({ plan, onClose, onSaved }: {
  plan: PlanRow; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    label:           plan.label,
    monthly_price:   String(plan.monthly_price),
    base_users:      String(plan.base_users),
    base_customers:  String(plan.base_customers),
    base_requests:   String(plan.base_requests),
    base_policies:   String(plan.base_policies),
    base_storage_mb: String(plan.base_storage_mb),
    base_ai_credits: String(plan.base_ai_credits),
    base_wa_monthly: String(plan.base_wa_monthly),
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const patch = {
        label:           form.label.trim(),
        monthly_price:   form.monthly_price,
        base_users:      form.base_users,
        base_customers:  form.base_customers,
        base_requests:   form.base_requests,
        base_policies:   form.base_policies,
        base_storage_mb: form.base_storage_mb,
        base_ai_credits: form.base_ai_credits,
        base_wa_monthly: form.base_wa_monthly,
      };
      const res  = await fetch("/api/admin/plans", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "plan", plan: plan.plan, patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
      setSaving(false);
    }
  }

  return (
    <div className="p-5 space-y-3.5 flex-1">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Görünen Ad</label>
        <input value={form.label} onChange={e => set("label", e.target.value)} className={INPUT} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Aylık Fiyat (₺)</label>
        <input type="number" min={0} value={form.monthly_price}
          onChange={e => set("monthly_price", e.target.value)} className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {LIMIT_FIELDS.map(f => (
          <div key={String(f.key)}>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
              {f.label}{f.suffix ? ` (${f.suffix})` : ""}
            </label>
            <input type="number" min={0}
              value={form[f.key as keyof typeof form]}
              onChange={e => set(f.key as keyof typeof form, e.target.value)}
              className={INPUT} />
          </div>
        ))}
      </div>

      {msg && (
        <p className={`text-xs rounded-xl px-3 py-2 border ${
          msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
        }`}>{msg.text}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onClose} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
          <X className="w-3.5 h-3.5" /> Vazgeç
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ─── Eklenti fiyatları (4 eklenti — unit_price düzenle) ───────────────────────

function AddonPricing({ addons, onSaved }: { addons: AddonRow[]; onSaved: () => void }) {
  return (
    <SectionCard title="Eklenti Fiyatları" subtitle="Birim fiyatlar — değişiklik tüm yeni satın alımlara yansır">
      {addons.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-slate-400">Tanımlı eklenti yok</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {addons.map(a => (
            <AddonRowEditor key={a.key} addon={a} onSaved={onSaved} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function AddonRowEditor({ addon, onSaved }: { addon: AddonRow; onSaved: () => void }) {
  const [price, setPrice] = useState(String(addon.unit_price));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = price.trim() !== String(addon.unit_price);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res  = await fetch("/api/admin/plans", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "addon", key: addon.key, patch: { unit_price: price } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Kaydedildi ✓" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
        <CreditCard className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-bold text-slate-800">{addon.label}</p>
        <p className="text-[11px] text-slate-400">
          {addon.unit_label}
          {!addon.is_active && <span className="ml-2 text-rose-500 font-semibold">· Pasif</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Birim Fiyat (₺)</label>
          <input type="number" min={0} value={price}
            onChange={e => { setPrice(e.target.value); setMsg(null); }}
            className="w-32 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50" />
        </div>
        <button onClick={save} disabled={saving || !dirty}
          className="mt-5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-40">
          {saving ? "…" : "Kaydet"}
        </button>
      </div>
      {msg && (
        <p className={`w-full text-xs rounded-xl px-3 py-2 border ${
          msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
        }`}>{msg.text}</p>
      )}
    </div>
  );
}
