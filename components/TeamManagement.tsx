"use client";

/**
 * Ekip / Kullanıcı Yönetimi — acente sahibinin kendi personelini yönettiği panel.
 * Hem Ayarlar sayfasına gömülü (embedded) hem /team sayfasında tam ekran kullanılır.
 *
 * Süper admin acenteye TANIDIĞI yetkileri (max_users limiti dahil) acente sahibi
 * burada alt kullanıcılara dağıtır. Tümü /api/team (kendi acentesiyle sınırlı,
 * users.manage yetkisi şart).
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  AGENCY_ROLES, PERMISSIONS, PERMISSION_GROUPS, resolvePermissions, agencyRoleLabel,
  type AgencyRole, type PermissionKey,
} from "@/lib/permissions";
import {
  Users, UserPlus, X, Mail, Phone, Clock, ChevronDown, ShieldCheck, RotateCcw, ShieldAlert,
} from "lucide-react";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  agency_role: string | null;
  status: string | null;
  last_login_at: string | null;
  permissions: Record<string, boolean> | null;
  created_at: string;
};

const INPUT = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-slate-50";

function timeAgo(iso: string | null): string {
  if (!iso) return "Hiç giriş yok";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended: "bg-rose-50 text-rose-700 border-rose-200",
  invited: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABEL: Record<string, string> = { active: "Aktif", suspended: "Askıda", invited: "Davetli" };

export default function TeamManagement({ embedded = false }: { embedded?: boolean }) {
  const { can, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [selfId, setSelfId]   = useState<string>("");
  const [callerRole, setCallerRole] = useState<string>("owner");
  const [usage, setUsage]     = useState<{ used: number; max: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  const canManage = can("users.manage");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, usageRes] = await Promise.all([fetch("/api/team"), fetch("/api/usage")]);
      const team = await teamRes.json();
      if (teamRes.ok) {
        setMembers(team.members ?? []);
        setSelfId(team.selfId ?? "");
        setCallerRole(team.callerRole ?? "owner");
      }
      const usageJson = await usageRes.json().catch(() => null);
      if (usageRes.ok && usageJson?.agency) setUsage(usageJson.agency.limits.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canManage) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, canManage, load]);

  // Yetki yoksa: gömülüyse hiç gösterme, tam sayfada uyarı göster
  if (!authLoading && !canManage) {
    if (embedded) return null;
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Ekip yönetimine erişiminiz yok</h2>
        <p className="text-sm text-slate-500">
          Bu bölüm yalnız acente sahibi ve yöneticilere açıktır. Yetki için acente sahibinizle görüşün.
        </p>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const atLimit = usage ? usage.used >= usage.max : false;
  const pct = usage && usage.max > 0 ? Math.min(100, Math.round((usage.used / usage.max) * 100)) : 0;
  const callerIsOwner = callerRole === "owner";

  return (
    <div className="space-y-4">
      {/* Başlık (tam sayfada) */}
      {!embedded && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Users className="w-[18px] h-[18px] text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Kullanıcı Yönetimi</h1>
            </div>
            <p className="text-gray-500 text-sm pl-[46px]">Personelinizi, rollerini ve yetkilerini yönetin</p>
          </div>
        </div>
      )}

      {/* Kullanıcı limiti + davet butonu */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {usage ? (
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kullanıcı Limiti</p>
              <span className={`text-sm font-bold ${atLimit ? "text-rose-600" : pct >= 80 ? "text-amber-600" : "text-slate-700"}`}>
                {usage.used} / {usage.max} kullanıcı{atLimit && " · dolu"}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${atLimit ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
            </div>
            {atLimit && (
              <p className="text-[11px] text-rose-600 mt-1.5">Limit doldu. Daha fazla kullanıcı için platform yöneticisiyle görüşün.</p>
            )}
          </div>
        ) : <div />}
        <button onClick={() => setInviting((v) => !v)} disabled={atLimit}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50 flex-shrink-0">
          {inviting ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {inviting ? "Kapat" : "Alt Kullanıcı Ekle"}
        </button>
      </div>

      {inviting && <InviteForm callerIsOwner={callerIsOwner} onDone={() => { setInviting(false); load(); }} />}

      <div className="space-y-3">
        {members.map((m) => (
          <TeamMemberCard key={m.id} member={m} isSelf={m.id === selfId} callerIsOwner={callerIsOwner} onChanged={load} />
        ))}
        {members.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">Henüz ekip üyesi yok. “Alt Kullanıcı Ekle” ile başlayın.</p>
        )}
      </div>
    </div>
  );
}

// ─── Davet formu ─────────────────────────────────────────────────────────────
function InviteForm({ callerIsOwner, onDone }: { callerIsOwner: boolean; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [role, setRole]   = useState<AgencyRole>("sales");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink]   = useState<string | null>(null);

  const roleOptions = AGENCY_ROLES.filter((r) => callerIsOwner || r.value !== "owner");

  async function invite() {
    setSaving(true); setMsg(null); setLink(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name, agency_role: role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Davet başarısız.");
      setMsg({ ok: true, text: "Üye davet edildi ✓" });
      setLink(json.inviteLink ?? null);
      setEmail(""); setName("");
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Davet başarısız." });
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
      <p className="text-sm font-bold text-indigo-700">Yeni Alt Kullanıcı Davet Et</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-posta" className={INPUT} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad (opsiyonel)" className={INPUT} />
      </div>
      <div className="flex flex-wrap gap-2">
        {roleOptions.map((r) => (
          <button key={r.value} type="button" onClick={() => setRole(r.value)} title={r.description}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              role === r.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      {msg && (
        <p className={`text-xs rounded-xl px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>
      )}
      {link && (
        <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
            ⚠️ Otomatik e-posta gönderilmez — bu linki kişiye siz iletin.
          </p>
          <p className="text-[10px] text-slate-400">Kişi linke tıklayıp şifresini belirleyince hesabı aktive olur ve giriş yapabilir.</p>
          <p className="break-all text-[11px] text-indigo-600 bg-slate-50 rounded-lg p-2">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigator.clipboard?.writeText(link)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-500 transition-colors">Linki Kopyala</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`PolicePilot ekibimize katılmak için şifrenizi belirleyin: ${link}`)}`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors">WhatsApp ile Gönder</a>
          </div>
        </div>
      )}
      <button onClick={invite} disabled={saving}
        className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
        {saving ? "Davet ediliyor…" : "Davet Et"}
      </button>
    </div>
  );
}

// ─── Üye kartı ───────────────────────────────────────────────────────────────
function TeamMemberCard({ member, isSelf, callerIsOwner, onChanged }: {
  member: Member; isSelf: boolean; callerIsOwner: boolean; onChanged: () => void;
}) {
  const [role, setRole]     = useState<AgencyRole>((member.agency_role as AgencyRole) ?? "viewer");
  const [status, setStatus] = useState(member.status ?? "active");
  const [phone, setPhone]   = useState(member.phone ?? "");
  const [eff, setEff]       = useState<Record<PermissionKey, boolean>>(resolvePermissions(member.agency_role, member.permissions));
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy]     = useState<"resend" | "delete" | null>(null);
  const [resendLink, setResendLink] = useState<string | null>(null);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const isSuperAdmin = member.role === "super_admin";
  const isOwnerMember = (member.agency_role ?? "") === "owner";
  const locked = isSuperAdmin || (isOwnerMember && !callerIsOwner);

  function changeRole(next: AgencyRole) { setRole(next); setEff(resolvePermissions(next, null)); }
  function resetToTemplate() { setEff(resolvePermissions(role, null)); }

  async function save() {
    setSaving(true); setMsg(null);
    const template = resolvePermissions(role, null);
    const override: Partial<Record<PermissionKey, boolean>> = {};
    (Object.keys(eff) as PermissionKey[]).forEach((k) => { if (eff[k] !== template[k]) override[k] = eff[k]; });
    const permissions = Object.keys(override).length ? override : null;
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_role: role, status, phone, permissions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Kaydedilemedi.");
      setMsg({ ok: true, text: "Kaydedildi ✓" });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Kaydedilemedi." });
    } finally { setSaving(false); }
  }

  async function resend() {
    setBusy("resend"); setMsg(null); setResendLink(null);
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Link üretilemedi.");
      setResendLink(json.inviteLink ?? null);
      setMsg({ ok: true, text: "Yeni davet/parola linki üretildi ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Link üretilemedi." });
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm(`${member.full_name ?? member.email ?? "Bu üye"} silinecek. Onaylıyor musunuz?`)) return;
    setBusy("delete"); setMsg(null);
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Silinemedi.");
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Silinemedi." });
      setBusy(null);
    }
  }

  const initials = (member.full_name ?? member.email ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-4 flex items-start gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{initials}</div>
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-800">{member.full_name ?? "İsimsiz"}</p>
            {isSelf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Siz</span>}
            {isSuperAdmin && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Platform Yöneticisi</span>}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[member.status ?? "active"] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
              {STATUS_LABEL[member.status ?? "active"] ?? member.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-slate-400">
            {member.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</span>}
            {member.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{member.phone}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(member.last_login_at)}</span>
            <span className="font-semibold text-slate-500">{agencyRoleLabel(member.agency_role)}</span>
          </div>
        </div>
      </div>

      {locked ? (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-slate-400">
            {isSuperAdmin ? "Platform yöneticisi bu ekrandan düzenlenemez." : "Acente sahibini yalnız bir acente sahibi düzenleyebilir."}
          </p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 pt-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Rol</p>
            <div className="flex flex-wrap gap-2">
              {AGENCY_ROLES.filter((r) => callerIsOwner || r.value !== "owner").map((r) => (
                <button key={r.value} type="button" onClick={() => changeRole(r.value)} title={r.description}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    role === r.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Durum</p>
              <div className="flex gap-2">
                {(["active", "suspended"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      status === s ? (s === "active" ? "bg-emerald-600 text-white border-emerald-600" : "bg-rose-600 text-white border-rose-600") : "bg-white text-slate-600 border-slate-200"
                    }`}>
                    {s === "active" ? "Aktif" : "Askıya Al"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Telefon</p>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="905XXXXXXXXX" className={INPUT} />
            </div>
          </div>

          <div>
            <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700">
              <ShieldCheck className="w-3.5 h-3.5" /> Yetkiler
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-2 rounded-xl border border-slate-200 p-3 space-y-3">
                <div className="flex justify-end">
                  <button onClick={resetToTemplate} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700">
                    <RotateCcw className="w-3 h-3" /> Rol varsayılanına dön
                  </button>
                </div>
                {PERMISSION_GROUPS.map((group) => {
                  const items = PERMISSIONS.filter((p) => p.group === group);
                  if (!items.length) return null;
                  return (
                    <div key={group}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {items.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={eff[p.key] ?? false}
                              onChange={(e) => setEff((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400/40" />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {msg && (
            <p className={`text-xs rounded-xl px-3 py-2 border ${msg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>
          )}
          {resendLink && (
            <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
              <p className="font-semibold text-slate-500">Aktivasyon linki (üyeye iletin):</p>
              <p className="break-all text-indigo-600">{resendLink}</p>
              <button onClick={() => navigator.clipboard?.writeText(resendLink)} className="text-indigo-600 font-semibold hover:underline">Kopyala</button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={resend} disabled={busy !== null}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
                {busy === "resend" ? "Üretiliyor…" : "Daveti Yenile"}
              </button>
              {!isSelf && (
                <button onClick={remove} disabled={busy !== null}
                  className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-all disabled:opacity-50">
                  {busy === "delete" ? "Siliniyor…" : "Sil"}
                </button>
              )}
            </div>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm disabled:opacity-50">
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
