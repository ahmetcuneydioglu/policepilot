"use client";

/**
 * İlişki sekmesi — IRM Faz 1.
 * Tek akış: manuel görüşmeler (zengin kart) + sistem olayları (türetilmiş timeline).
 * + Görüşme Ekle modali (30 saniyede doldurulabilir: chip-ağırlıklı form).
 * + Müşteri analizi etiketleri (customers.tags).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  Interaction, CHANNELS, LOCATIONS, INTERACTION_PRODUCTS, OUTCOMES, NEXT_ACTIONS,
  CUSTOMER_TAGS, channelMeta, outcomeMeta, nextActionMeta, locationMeta, AUTO_SOURCE_META,
} from "@/lib/interactionTypes";
import { dealStageOf } from "@/lib/portfolio";
import type { CustomerTimelineEvent } from "./types";
import { Plus, X, HeartHandshake, Sparkles, RefreshCw, KanbanSquare } from "lucide-react";

/** Müşterinin açık Satış Hattı işi (Portföy köprüsü) */
type OpenDeal = { id: string; title: string; stage: string; product_interest: string };

// Türetilmiş (eski) timeline olay ikonları
const DERIVED_ICON: Record<string, string> = {
  customer: "👤", policy: "🛡", quote_run: "📄", document: "📷", whatsapp: "💬", request: "📋",
};

type FeedItem =
  | { kind: "interaction"; date: string; int: Interaction }
  | { kind: "derived"; date: string; ev: CustomerTimelineEvent };

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const OUTCOME_TONE: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  slate: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function RelationshipTab({
  customerId, customerAgencyId, timeline, tags, onTagsChange, summary, summaryAt, onSummary,
}: {
  customerId: string;
  customerAgencyId: string | null;
  timeline: CustomerTimelineEvent[];
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  summary: string | null;
  summaryAt: string | null;
  onSummary: (summary: string, at: string) => void;
}) {
  const { profile, agencyId } = useAuth();
  const [items, setItems] = useState<Interaction[]>([]);
  const [deals, setDeals] = useState<OpenDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function generateSummary() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/customers/${customerId}/relationship-summary`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Özet üretilemedi.");
      onSummary(json.summary, json.generated_at);
      load(); // 🤖 olayı akışa düşer
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Özet üretilemedi.");
    } finally {
      setAiLoading(false);
    }
  }

  const load = useCallback(async () => {
    const [intRes, dealRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("customer_interactions") as any)
        .select("*")
        .eq("customer_id", customerId)
        .order("occurred_at", { ascending: false })
        .limit(200),
      // Portföy: açık Satış Hattı işleri (görüşmeyi işe bağlamak + şerit için)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("deals") as any)
        .select("id, title, stage, product_interest")
        .eq("customer_id", customerId)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);
    setItems((intRes.data ?? []) as Interaction[]);
    setDeals((dealRes.data ?? []) as OpenDeal[]);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  // ── Birleşik akış: manuel/auto interactions + türetilmiş sistem olayları ────
  const feed: FeedItem[] = useMemo(() => {
    const a: FeedItem[] = items.map((int) => ({ kind: "interaction", date: int.occurred_at, int }));
    const b: FeedItem[] = timeline.map((ev) => ({ kind: "derived", date: ev.date, ev }));
    return [...a, ...b].sort((x, y) => +new Date(y.date) - +new Date(x.date));
  }, [items, timeline]);

  // ── Etiketler ────────────────────────────────────────────────────────────────
  async function toggleTag(key: string) {
    const next = tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key];
    onTagsChange(next); // optimistic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("customers") as any).update({ tags: next }).eq("id", customerId);
  }

  // Son Temas: en yeni MANUEL görüşme (vizyonun "karta girince tek bakışta" bloğu)
  const lastTouch = useMemo(() => items.find((i) => i.kind === "manual") ?? null, [items]);

  return (
    <div className="space-y-4">
      {/* ── Son Temas — kim, nerede, ne konuşuldu, sonraki adım ── */}
      {lastTouch && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Son Temas</p>
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{channelMeta(lastTouch.channel).emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">
                {channelMeta(lastTouch.channel).label}
                {lastTouch.product ? ` · ${lastTouch.product}` : ""}
                {outcomeMeta(lastTouch.outcome) ? ` · ${outcomeMeta(lastTouch.outcome)!.label}` : ""}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lastTouch.staff_name ?? "Personel"} · {fmtDT(lastTouch.occurred_at)}
                {locationMeta(lastTouch.location) ? ` · 📍 ${locationMeta(lastTouch.location)!.label}${lastTouch.location_note ? ` (${lastTouch.location_note})` : ""}` : ""}
              </p>
              {lastTouch.note && <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{lastTouch.note}</p>}
              {nextActionMeta(lastTouch.next_action) && (
                <p className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-blue-100 text-[11px] font-semibold text-blue-700">
                  → {nextActionMeta(lastTouch.next_action)!.emoji} {nextActionMeta(lastTouch.next_action)!.label}
                  {lastTouch.next_action_date ? ` · ${new Date(lastTouch.next_action_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Açık Satış Hattı işleri (Portföy köprüsü) ── */}
      {deals.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <KanbanSquare className="w-3.5 h-3.5 text-indigo-500" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Açık İşler · Satış Hattı</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deals.map((d) => {
              const st = dealStageOf(d.stage);
              return (
                <Link key={d.id} href={`/portfoy?open=${d.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors">
                  <span className="text-xs font-semibold text-slate-700">{d.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Müşteri analizi etiketleri ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Müşteri Analizi</p>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOMER_TAGS.map((t) => {
            const on = tags.includes(t.key);
            return (
              <button key={t.key} onClick={() => toggleTag(t.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  on ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                }`}>
                <span>{t.emoji}</span>{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AI İlişki Özeti ── */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">AI İlişki Özeti</p>
          </div>
          <button onClick={generateSummary} disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-3 h-3 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Üretiliyor…" : summary ? "Yenile" : "Özet Oluştur"}
          </button>
        </div>
        {aiError && <p className="text-[11px] font-semibold text-rose-600 mb-2">{aiError}</p>}
        {summary ? (
          <>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
            {summaryAt && (
              <p className="mt-2 text-[10px] text-violet-400">
                Son güncelleme: {new Date(summaryAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">Görüşme geçmişinden satış-odaklı bir özet üretir: temas yoğunluğu, ilgilenilen ürün, son durum ve bir sonraki görüşme taktiği.</p>
        )}
      </div>

      {/* ── Akış başlığı + Görüşme Ekle ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">İlişki Akışı</h3>
          <span className="text-[11px] text-slate-400">{items.length} görüşme · {timeline.length} sistem olayı</span>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Görüşme Ekle
        </button>
      </div>

      {/* ── Akış ── */}
      {loading ? (
        <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ) : feed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
          <p className="text-2xl mb-2">🤝</p>
          <p className="text-sm font-semibold text-slate-600">Henüz ilişki kaydı yok</p>
          <p className="text-xs text-slate-400 mt-1">İlk görüşmeyi ekleyin — müşteriyle kurulan ilişki buradan yıllarca takip edilir.</p>
        </div>
      ) : (
        <div className="relative pl-5 space-y-3">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {feed.map((f) =>
            f.kind === "interaction" ? (
              <InteractionCard key={`i-${f.int.id}`} int={f.int} />
            ) : (
              <DerivedRow key={`d-${f.ev.type}-${f.ev.ref_id}-${f.date}`} ev={f.ev} />
            )
          )}
        </div>
      )}

      {modalOpen && (
        <AddInteractionModal
          customerId={customerId}
          agencyId={customerAgencyId ?? agencyId}
          staffId={profile?.id ?? null}
          staffName={profile?.full_name ?? null}
          openDeals={deals}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Manuel görüşme kartı ──────────────────────────────────────────────────────
function InteractionCard({ int }: { int: Interaction }) {
  if (int.kind === "auto") {
    const meta = AUTO_SOURCE_META[int.auto_source ?? ""] ?? { label: "Sistem olayı", emoji: "•" };
    return (
      <div className="relative">
        <span className="absolute -left-5 top-1.5 w-[15px] h-[15px] rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px]">{meta.emoji}</span>
        <p className="text-xs text-slate-500">
          <b className="text-slate-700">{meta.label}</b>
          {int.note ? <> · {int.note}</> : null}
          <span className="text-slate-400"> · {fmtDT(int.occurred_at)}</span>
        </p>
      </div>
    );
  }

  const ch = channelMeta(int.channel);
  const oc = outcomeMeta(int.outcome);
  const na = nextActionMeta(int.next_action);
  const loc = locationMeta(int.location);
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="absolute -left-5 top-4 w-[15px] h-[15px] rounded-full bg-blue-600 border-2 border-white shadow flex items-center justify-center" />
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{ch.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {ch.label}{int.product ? ` · ${int.product}` : ""}
            </p>
            <p className="text-[11px] text-slate-400">
              {int.staff_name ?? "Personel"} · {fmtDT(int.occurred_at)}
              {loc ? ` · 📍 ${loc.label}${int.location_note ? ` (${int.location_note})` : ""}` : ""}
            </p>
          </div>
        </div>
        {oc && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${OUTCOME_TONE[oc.tone]}`}>{oc.label}</span>
        )}
      </div>
      {int.note && <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{int.note}</p>}
      {na && (
        <p className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
          {na.emoji} Sonraki: {na.label}
          {int.next_action_date ? ` · ${new Date(int.next_action_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}` : ""}
        </p>
      )}
    </div>
  );
}

// ── Türetilmiş sistem olayı satırı ───────────────────────────────────────────
function DerivedRow({ ev }: { ev: CustomerTimelineEvent }) {
  return (
    <div className="relative">
      <span className="absolute -left-5 top-1.5 w-[15px] h-[15px] rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px]">
        {DERIVED_ICON[ev.type] ?? "•"}
      </span>
      <p className="text-xs text-slate-500">
        <b className="text-slate-700">{ev.title}</b>
        {ev.description ? <> · {ev.description}</> : null}
        <span className="text-slate-400"> · {fmtDT(ev.date)}</span>
      </p>
    </div>
  );
}

// ── Görüşme Ekle modali ───────────────────────────────────────────────────────
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
        on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
      }`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function AddInteractionModal({
  customerId, agencyId, staffId, staffName, openDeals, onClose, onSaved,
}: {
  customerId: string;
  agencyId: string | null;
  staffId: string | null;
  staffName: string | null;
  /** Portföy: görüşme bir Satış Hattı işine bağlanabilir */
  openDeals: OpenDeal[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const localDT = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const [channel, setChannel] = useState("phone");
  const [location, setLocation] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [when, setWhen] = useState(localDT);
  const [product, setProduct] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [dealId, setDealId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!agencyId) { setErr("Acente bilgisi bulunamadı."); return; }
    setSaving(true);
    setErr("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("customer_interactions") as any).insert({
      agency_id: agencyId,
      customer_id: customerId,
      staff_id: staffId,
      staff_name: staffName,
      occurred_at: new Date(when).toISOString(),
      kind: "manual",
      channel,
      location,
      location_note: location ? (locationNote.trim() || null) : null,
      product,
      outcome,
      note: note.trim() || null,
      next_action: nextAction,
      next_action_date: nextAction && nextDate ? nextDate : null,
      deal_id: dealId,
    });
    setSaving(false);
    if (error) { setErr("Kaydedilemedi: " + error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Görüşme Ekle</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {err && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{err}</p>}

        <Field label="İletişim Türü">
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => <Chip key={c.key} on={channel === c.key} onClick={() => setChannel(c.key)}>{c.emoji} {c.label}</Chip>)}
          </div>
        </Field>

        <Field label="Lokasyon (opsiyonel)">
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map((l) => <Chip key={l.key} on={location === l.key} onClick={() => setLocation(location === l.key ? null : l.key)}>{l.label}</Chip>)}
          </div>
          {location && (
            <input value={locationNote} onChange={(e) => setLocationNote(e.target.value)}
              placeholder="Örn: Acıbadem Hastanesi B blok"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarih & Saat">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
          </Field>
          <Field label="İlgili Ürün (opsiyonel)">
            <select value={product ?? ""} onChange={(e) => setProduct(e.target.value || null)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-400">
              <option value="">Seçilmedi</option>
              {INTERACTION_PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {openDeals.length > 0 && (
          <Field label="İşe Bağla (opsiyonel — Satış Hattı)">
            <div className="flex flex-wrap gap-1.5">
              {openDeals.map((d) => (
                <Chip key={d.id} on={dealId === d.id} onClick={() => setDealId(dealId === d.id ? null : d.id)}>
                  🧭 {d.title}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        <Field label="Görüşme Sonucu (opsiyonel)">
          <div className="flex flex-wrap gap-1.5">
            {OUTCOMES.map((o) => <Chip key={o.key} on={outcome === o.key} onClick={() => setOutcome(outcome === o.key ? null : o.key)}>{o.label}</Chip>)}
          </div>
        </Field>

        <Field label="Not (opsiyonel)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder="Görüşmede ne konuşuldu? Fiyat itirazı, özel talep, aile durumu…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-400" />
        </Field>

        <Field label="Sonraki Aksiyon (opsiyonel)">
          <div className="flex flex-wrap gap-1.5">
            {NEXT_ACTIONS.map((n) => <Chip key={n.key} on={nextAction === n.key} onClick={() => setNextAction(nextAction === n.key ? null : n.key)}>{n.emoji} {n.label}</Chip>)}
          </div>
          {nextAction && (
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
          )}
        </Field>

        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors">
          {saving ? "Kaydediliyor…" : "Görüşmeyi Kaydet"}
        </button>
      </div>
    </div>
  );
}
