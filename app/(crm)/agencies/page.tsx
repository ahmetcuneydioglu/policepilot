"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Agency = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_color: string;
  created_at: string;
  max_users:     number | null;
  max_customers: number | null;
  max_requests:  number | null;
  max_policies:  number | null;
  is_active:     boolean | null;
  plan:          string | null;
  expires_at:    string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  agency_id: string | null;
};

/** Per-agency resource counts fetched from each table. */
type AgencyCounts = {
  users:     number;
  customers: number;
  requests:  number;
  policies:  number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; cls: string }> = {
  starter:    { label: "Starter",    cls: "bg-gray-100 text-gray-600 border-gray-200" },
  pro:        { label: "Pro",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
  enterprise: { label: "Enterprise", cls: "bg-violet-100 text-violet-700 border-violet-200" },
};

const EMPTY_FORM = {
  name: "", slug: "", phone: "", email: "", website: "",
  primary_color: "#2563eb", logo_url: "",
  max_users: "10", max_customers: "100", max_requests: "100", max_policies: "100",
  plan: "starter",
};

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ─── Mini counter row ─────────────────────────────────────────────────────────
function CounterBadge({
  icon, label, current, max,
}: { icon: string; label: string; current: number; max: number }) {
  const pct     = max > 0 ? current / max : 0;
  const atLimit = current >= max;
  const nearLimit = pct >= 0.8 && !atLimit;

  const cls = atLimit
    ? "bg-red-50 border-red-200 text-red-700"
    : nearLimit
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-slate-50 border-gray-200 text-slate-600";

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold ${cls}`}>
      <span>{icon}</span>
      <span>{label}:</span>
      <span className="font-extrabold">{current}</span>
      <span className="opacity-60">/ {max}</span>
      {atLimit && <span className="ml-0.5">⚠</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgenciesPage() {
  const [agencies,  setAgencies]  = useState<Agency[]>([]);
  const [profiles,  setProfiles]  = useState<Profile[]>([]);
  /** Keyed by agency.id — holds actual record counts from each table. */
  const [counts,    setCounts]    = useState<Record<string, AgencyCounts>>({});
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");
  const [expandedId,setExpandedId]= useState<string | null>(null);
  const [assignUserId,  setAssignUserId]  = useState("");
  const [assignSaving,  setAssignSaving]  = useState(false);

  // ─── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    // Parallel: agencies + profiles + all agency_id columns from the 3 data tables
    const [
      { data: ag },
      { data: pr },
      { data: custRows },
      { data: reqRows },
      { data: polRows },
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("agencies")  as any).select("*").order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("profiles")  as any).select("id, full_name, role, agency_id").order("full_name"),
      // Fetch only agency_id to count rows per agency without pulling full records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("customers") as any).select("agency_id"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("requests")  as any).select("agency_id"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("policies")  as any).select("agency_id"),
    ]);

    if (ag) setAgencies(ag as Agency[]);
    if (pr) setProfiles(pr as Profile[]);

    // Build counts map from raw rows
    const newCounts: Record<string, AgencyCounts> = {};

    function tally(rows: { agency_id: string | null }[] | null, key: keyof AgencyCounts) {
      (rows ?? []).forEach((r) => {
        if (!r.agency_id) return;
        if (!newCounts[r.agency_id]) newCounts[r.agency_id] = { users: 0, customers: 0, requests: 0, policies: 0 };
        newCounts[r.agency_id][key] += 1;
      });
    }

    // Users come from profiles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pr ?? []).forEach((p: any) => {
      if (!p.agency_id) return;
      if (!newCounts[p.agency_id]) newCounts[p.agency_id] = { users: 0, customers: 0, requests: 0, policies: 0 };
      newCounts[p.agency_id].users += 1;
    });

    tally(custRows as { agency_id: string | null }[] | null, "customers");
    tally(reqRows  as { agency_id: string | null }[] | null, "requests");
    tally(polRows  as { agency_id: string | null }[] | null, "policies");

    setCounts(newCounts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Form helpers ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(ag: Agency) {
    setEditingId(ag.id);
    setForm({
      name:          ag.name,
      slug:          ag.slug,
      phone:         ag.phone  ?? "",
      email:         ag.email  ?? "",
      website:       ag.website ?? "",
      primary_color: ag.primary_color,
      logo_url:      ag.logo_url ?? "",
      max_users:     String(ag.max_users     ?? 10),
      max_customers: String(ag.max_customers ?? 100),
      max_requests:  String(ag.max_requests  ?? 100),
      max_policies:  String(ag.max_policies  ?? 100),
      plan:          ag.plan ?? "starter",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Acente adı zorunludur."); return; }
    if (!form.slug.trim()) { setFormError("Slug zorunludur."); return; }
    if (!/^[a-z0-9-]+$/.test(form.slug)) { setFormError("Slug yalnızca küçük harf, rakam ve tire içerebilir."); return; }

    setSaving(true);
    setFormError("");

    const payload = {
      name:          form.name.trim(),
      slug:          form.slug.trim(),
      phone:         form.phone.trim()   || null,
      email:         form.email.trim()   || null,
      website:       form.website.trim() || null,
      primary_color: form.primary_color  || "#2563eb",
      logo_url:      form.logo_url.trim() || null,
      max_users:     parseInt(form.max_users,     10) || 10,
      max_customers: parseInt(form.max_customers, 10) || 100,
      max_requests:  parseInt(form.max_requests,  10) || 100,
      max_policies:  parseInt(form.max_policies,  10) || 100,
      plan:          form.plan || "starter",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase.from("agencies") as any;
    const { error } = editingId
      ? await sb.update(payload).eq("id", editingId)
      : await sb.insert([payload]);

    setSaving(false);
    if (error) {
      const msg = error.message ?? String(error);
      setFormError(msg.includes("unique") ? `"${form.slug}" slug zaten kullanımda.` : msg);
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" acentesi silinsin mi? Bu işlem geri alınamaz.`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("agencies") as any).delete().eq("id", id);
    load();
  }

  async function toggleActive(ag: Agency) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("agencies") as any)
      .update({ is_active: !(ag.is_active ?? true) })
      .eq("id", ag.id);
    load();
  }

  async function handleAssignUser(agencyId: string, maxUsers: number) {
    if (!assignUserId) return;
    const currentUsers = counts[agencyId]?.users ?? 0;
    if (currentUsers >= maxUsers) {
      alert(`Kullanıcı limitine ulaşıldı (${currentUsers}/${maxUsers}). Limiti artırmak için Düzenle'yi kullanın.`);
      return;
    }
    setAssignSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any).update({ agency_id: agencyId }).eq("id", assignUserId);
    setAssignSaving(false);
    setAssignUserId("");
    load();
  }

  async function handleUnassignUser(profileId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("profiles") as any).update({ agency_id: null }).eq("id", profileId);
    load();
  }

  const unassigned = profiles.filter((p) => !p.agency_id);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Acenteler</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "Yükleniyor..." : `${agencies.length} acente`}
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Acente Ekle
        </button>
      </div>

      {/* ── Add / Edit Form ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            {editingId ? "Acente Düzenle" : "Yeni Acente"}
          </h2>
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Acente Adı *</label>
                <input type="text" value={form.name}
                  onChange={(e) => { const name = e.target.value; setForm((p) => ({ ...p, name, slug: editingId ? p.slug : slugify(name) })); }}
                  placeholder="Atlas Sigorta"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slug *</label>
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="px-2 text-xs text-slate-400 bg-slate-50 border-r border-gray-200 select-none py-2">/a/</span>
                  <input type="text" value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                    placeholder="atlas-sigorta"
                    className="flex-1 px-2 py-2 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              {/* Limits — 4 fields */}
              {[
                { key: "max_users",     label: "Maks. Kullanıcı" },
                { key: "max_customers", label: "Maks. Müşteri" },
                { key: "max_requests",  label: "Maks. Teklif Talebi" },
                { key: "max_policies",  label: "Maks. Poliçe" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input type="number" min="1" max="100000"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              ))}

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                <input type="text" value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0212 000 00 00"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">E-posta</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="info@acente.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ana Renk</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color}
                    onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                  <input type="text" value={form.primary_color}
                    onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                    placeholder="#2563eb"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>

              {/* Logo URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL <span className="text-slate-400 font-normal">(isteğe bağlı)</span></label>
                <input type="text" value={form.logo_url}
                  onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-600 mb-3 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Oluştur"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors">
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Agencies list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : agencies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-slate-400 text-sm">
          Henüz acente yok.
        </div>
      ) : (
        <div className="space-y-3">
          {agencies.map((ag) => {
            const agencyProfiles = profiles.filter((p) => p.agency_id === ag.id);
            const c = counts[ag.id] ?? { users: 0, customers: 0, requests: 0, policies: 0 };

            const maxUsers     = ag.max_users     ?? 10;
            const maxCustomers = ag.max_customers ?? 100;
            const maxRequests  = ag.max_requests  ?? 100;
            const maxPolicies  = ag.max_policies  ?? 100;

            const isActive   = ag.is_active ?? true;
            const plan       = ag.plan ?? "starter";
            const planMeta   = PLAN_LABELS[plan] ?? PLAN_LABELS["starter"];
            const isExpanded = expandedId === ag.id;

            // Any resource at limit?
            const anyAtLimit =
              c.users     >= maxUsers     ||
              c.customers >= maxCustomers ||
              c.requests  >= maxRequests  ||
              c.policies  >= maxPolicies;

            return (
              <div key={ag.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  isActive ? "border-gray-100" : "border-red-100 opacity-75"
                }`}>

                {/* Agency row */}
                <div className="flex items-start gap-4 px-5 py-4">

                  {/* Color badge */}
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm mt-0.5"
                    style={{ backgroundColor: ag.primary_color }}>
                    {ag.name.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">

                    {/* Top row: name + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-semibold text-slate-900 text-sm">{ag.name}</p>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-gray-200 px-1.5 py-0.5 rounded">
                        /a/{ag.slug}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${planMeta.cls}`}>
                        {planMeta.label}
                      </span>
                      {!isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 uppercase">
                          Pasif
                        </span>
                      )}
                      {anyAtLimit && isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                          ⚠ Limit uyarısı
                        </span>
                      )}
                    </div>

                    {/* ── Resource counters — the critical part ── */}
                    <div className="flex flex-wrap gap-1.5">
                      <CounterBadge icon="👤" label="Kullanıcı" current={c.users}     max={maxUsers}     />
                      <CounterBadge icon="👥" label="Müşteri"   current={c.customers} max={maxCustomers} />
                      <CounterBadge icon="📋" label="Teklif"    current={c.requests}  max={maxRequests}  />
                      <CounterBadge icon="📄" label="Poliçe"    current={c.policies}  max={maxPolicies}  />
                    </div>

                    {/* Contact info */}
                    {(ag.phone || ag.email) && (
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {ag.phone && <span className="text-[11px] text-slate-400">{ag.phone}</span>}
                        {ag.email && <span className="text-[11px] text-slate-400">{ag.email}</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <button onClick={() => toggleActive(ag)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          : "text-red-600 border-red-200 hover:bg-red-50"
                      }`}>
                      {isActive ? "✓ Aktif" : "✗ Pasif"}
                    </button>

                    <button onClick={() => setExpandedId(isExpanded ? null : ag.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-gray-200 hover:bg-slate-50 transition-colors">
                      Kullanıcılar {isExpanded ? "▲" : "▼"}
                    </button>

                    <button onClick={() => openEdit(ag)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors">
                      Düzenle
                    </button>

                    <button onClick={() => handleDelete(ag.id, ag.name)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                      Sil
                    </button>
                  </div>
                </div>

                {/* Expanded: users panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-slate-50/50">
                    {/* Limit warnings */}
                    {c.users >= maxUsers && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                        <span className="text-red-500 text-sm">⚠</span>
                        <p className="text-xs text-red-700 font-semibold">
                          Kullanıcı limiti doldu ({c.users}/{maxUsers})
                        </p>
                      </div>
                    )}
                    {c.customers >= maxCustomers && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                        <span className="text-amber-500 text-sm">⚠</span>
                        <p className="text-xs text-amber-700 font-semibold">
                          Müşteri limiti doldu ({c.customers}/{maxCustomers})
                        </p>
                      </div>
                    )}
                    {c.requests >= maxRequests && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                        <span className="text-amber-500 text-sm">⚠</span>
                        <p className="text-xs text-amber-700 font-semibold">
                          Teklif talebi limiti doldu ({c.requests}/{maxRequests})
                        </p>
                      </div>
                    )}

                    <p className="text-xs font-semibold text-slate-600 mb-3">
                      Bağlı Kullanıcılar ({c.users}/{maxUsers})
                    </p>

                    {agencyProfiles.length === 0 ? (
                      <p className="text-xs text-slate-400 mb-3">Henüz kullanıcı yok.</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {agencyProfiles.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div>
                              <p className="text-xs font-medium text-slate-800">{p.full_name ?? "İsimsiz"}</p>
                              <p className="text-[10px] text-slate-400">{p.role}</p>
                            </div>
                            <button onClick={() => handleUnassignUser(p.id)}
                              className="text-[10px] text-red-500 hover:text-red-700 transition-colors">
                              Çıkar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assign user — disabled at user limit */}
                    {unassigned.length > 0 && (
                      <div className={`flex items-center gap-2 ${c.users >= maxUsers ? "opacity-50 pointer-events-none" : ""}`}>
                        <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                          <option value="">Kullanıcı seç...</option>
                          {unassigned.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name ?? "İsimsiz"} ({p.role})</option>
                          ))}
                        </select>
                        <button onClick={() => handleAssignUser(ag.id, maxUsers)}
                          disabled={!assignUserId || assignSaving}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          Ata
                        </button>
                      </div>
                    )}

                    {/* Links */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Müşteri teklif linki:</p>
                        <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-700 select-all">
                          {typeof window !== "undefined" ? window.location.origin : ""}/a/{ag.slug}/teklif-al
                        </code>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Ekip davet linki:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-700 select-all flex-1 truncate">
                            {typeof window !== "undefined" ? window.location.origin : ""}/register?invite={ag.slug}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/register?invite=${ag.slug}`)}
                            className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 transition-colors whitespace-nowrap">
                            Kopyala
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
