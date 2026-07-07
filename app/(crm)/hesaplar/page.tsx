"use client";

/**
 * PORTFÖY — Hesaplar (kurumsal hiyerarşi: hastane/fabrika/şirket → kişiler → işler).
 * Örnek zincir: Acıbadem Hastanesi → Dr. Mehmet Kaya → görüşmeler → Satış Hattı işi.
 * Liste + hesap detay drawer'ı (kişi bağlama, açık işler).
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { withAgencyFilter } from "@/lib/tenant";
import {
  ACCOUNT_KINDS, accountKindMeta, dealStageOf, type Account, type Deal,
} from "@/lib/portfolio";
import EmptyState from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Plus, Building2, Search, X, Users, KanbanSquare, Loader2, Unlink } from "lucide-react";

type Person = { id: string; name: string; phone: string | null; title: string | null; account_id: string | null };

const INPUT = "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1.5";

export default function AccountsPage() {
  const { role, agencyId } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role !== "super_admin" && !agencyId) return;
    const [apiRes, custRes] = await Promise.all([
      fetch("/api/portfolio").then((r) => r.json()).catch(() => ({})),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withAgencyFilter((supabase.from("customers") as any).select("id, name, phone, title, account_id"), role, agencyId).order("name"),
    ]);
    setAccounts(apiRes.accounts ?? []);
    setDeals(apiRes.deals ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPeople(((custRes as any).data ?? []) as Person[]);
    setLoading(false);
  }, [role, agencyId]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const person = new Map<string, number>();
    for (const p of people) if (p.account_id) person.set(p.account_id, (person.get(p.account_id) ?? 0) + 1);
    const deal = new Map<string, number>();
    for (const d of deals) if (d.account_id && d.status === "open") deal.set(d.account_id, (deal.get(d.account_id) ?? 0) + 1);
    return { person, deal };
  }, [people, deals]);

  const filtered = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("tr");
    if (!s) return accounts;
    return accounts.filter((a) => a.name.toLocaleLowerCase("tr").includes(s) || (a.city ?? "").toLocaleLowerCase("tr").includes(s));
  }, [accounts, search]);

  const openAccount = openId ? accounts.find((a) => a.id === openId) ?? null : null;

  if (loading) {
    return <div className="max-w-5xl"><ListSkeleton kpis={0} rows={6} /></div>;
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hesaplar</h1>
          <p className="text-sm text-slate-400">Kurumsal portföyleriniz: hastane, fabrika, şirket — kişiler ve işler tek çatıda</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Yeni Hesap
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hesap adı veya şehir ara…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {filtered.length === 0 ? (
        search.trim() ? (
          <EmptyState Icon={Search} title="Aramanızla eşleşen hesap yok" desc="Farklı bir ad veya şehir deneyin." />
        ) : (
          <EmptyState Icon={Building2} title="Henüz kurumsal hesap yok"
            desc="Acıbadem gibi bir hesap açın; doktorları kişi olarak bağlayın, işleri Satış Hattı'ndan yönetin."
            actionLabel="Yeni Hesap" onAction={() => setShowAdd(true)} />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const km = accountKindMeta(a.kind);
            return (
              <button key={a.id} onClick={() => setOpenId(a.id)}
                className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">{km.emoji}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{a.name}</p>
                    <p className="text-[11px] text-slate-400">{km.label}{a.city ? ` · ${a.city}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-300" /> {counts.person.get(a.id) ?? 0} kişi</span>
                  <span className="inline-flex items-center gap-1"><KanbanSquare className="w-3.5 h-3.5 text-slate-300" /> {counts.deal.get(a.id) ?? 0} açık iş</span>
                  {a.owner_name && <span className="ml-auto text-slate-400 truncate">{a.owner_name}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddAccountModal agencyId={agencyId} onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }} />
      )}
      {openAccount && (
        <AccountDrawer account={openAccount} people={people} deals={deals}
          onClose={() => setOpenId(null)} onChanged={load}
          onOpenDeal={(id) => router.push(`/portfoy?open=${id}`)} />
      )}
    </div>
  );
}

/* ── Yeni hesap ─────────────────────────────────────────────────────────── */
function AddAccountModal({ agencyId, onClose, onCreated }: { agencyId: string | null; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("hastane");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Hesap adı zorunludur."); return; }
    if (!agencyId) { setError("Bağlı acente bulunamadı."); return; }
    setSaving(true);
    setError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from("accounts") as any).insert({
      agency_id: agencyId,
      name: name.trim(),
      kind,
      city: city.trim() || null,
      phone: phone.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (err) { setError("Kaydedilemedi: " + err.message); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Yeni Hesap</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm">{error}</div>}
        <div className="space-y-3.5">
          <div>
            <label className={LABEL}>Hesap Adı *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acıbadem Hastanesi" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Tür</label>
            <div className="flex flex-wrap gap-1.5">
              {ACCOUNT_KINDS.map((k) => (
                <button key={k.key} onClick={() => setKind(k.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${kind === k.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {k.emoji} {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Şehir</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Telefon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0212 …" className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Not</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="İK müdürüyle tanışıldı…" className={`${INPUT} resize-none`} />
          </div>
          <button onClick={save} disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Hesabı Aç
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hesap detayı ───────────────────────────────────────────────────────── */
function AccountDrawer({
  account, people, deals, onClose, onChanged, onOpenDeal,
}: {
  account: Account;
  people: Person[];
  deals: Deal[];
  onClose: () => void;
  onChanged: () => void;
  onOpenDeal: (id: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linking, setLinking] = useState(false);
  useEffect(() => { setShow(true); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 200); };

  const km = accountKindMeta(account.kind);
  const linked = people.filter((p) => p.account_id === account.id);
  const accountDeals = deals.filter((d) => d.account_id === account.id);
  const candidates = useMemo(() => {
    const q = linkQuery.trim().toLocaleLowerCase("tr");
    if (!q) return [];
    return people.filter((p) => p.account_id !== account.id && p.name.toLocaleLowerCase("tr").includes(q)).slice(0, 6);
  }, [people, linkQuery, account.id]);

  const setPersonAccount = async (personId: string, accountId: string | null) => {
    setLinking(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("customers") as any).update({ account_id: accountId }).eq("id", personId);
    setLinking(false);
    setLinkQuery("");
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`} onClick={close} />
      <div className={`relative h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col transition-transform duration-200 ${show ? "translate-x-0" : "translate-x-full"}`}>
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">{km.emoji}</div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{account.name}</p>
              <p className="text-[11px] text-slate-400">{km.label}{account.city ? ` · ${account.city}` : ""}{account.phone ? ` · ${account.phone}` : ""}</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {account.note && (
            <p className="text-sm text-slate-600 bg-white rounded-2xl border border-slate-200/70 p-4">{account.note}</p>
          )}

          {/* Kişiler */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Kişiler ({linked.length})</p>
            {linked.length === 0 && <p className="text-xs text-slate-400 mb-2">Henüz kişi bağlanmamış.</p>}
            <div className="space-y-1.5">
              {linked.map((p) => (
                <div key={p.id} className="flex items-center gap-2 group">
                  <Link href={`/customers/${p.id}`} className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.title ?? "—"}{p.phone ? ` · ${p.phone}` : ""}</p>
                  </Link>
                  <button onClick={() => setPersonAccount(p.id, null)} disabled={linking} title="Bağı kaldır"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {/* Kişi bağla */}
            <div className="mt-3">
              <input value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="Kişi bağla: müşteri adı yaz…" className={INPUT} />
              {candidates.length > 0 && (
                <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50 bg-white">
                  {candidates.map((p) => (
                    <button key={p.id} onClick={() => setPersonAccount(p.id, account.id)} disabled={linking}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50/60 transition-colors">
                      <span className="font-medium text-slate-800">{p.name}</span>
                      {p.phone && <span className="text-slate-400 text-xs ml-2">{p.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* İşler */}
          <section className="bg-white rounded-2xl border border-slate-200/70 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Satış Hattı İşleri ({accountDeals.length})</p>
            {accountDeals.length === 0 ? (
              <p className="text-xs text-slate-400">Bu hesaba bağlı iş yok. Satış Hattı&apos;ndan &quot;Yeni İş&quot; açarken hesabı seçin.</p>
            ) : (
              <div className="space-y-1.5">
                {accountDeals.map((d) => (
                  <button key={d.id} onClick={() => onOpenDeal(d.id)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{d.customers?.name ?? d.title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${d.status === "lost" ? "bg-rose-100 text-rose-700" : dealStageOf(d.stage).badge}`}>
                        {d.status === "lost" ? "Kaybedildi" : dealStageOf(d.stage).label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{d.product_interest}{d.owner_name ? ` · ${d.owner_name}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
