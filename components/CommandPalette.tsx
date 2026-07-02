"use client";

/**
 * Command Palette (⌘K) — arama + aksiyon tek yüzeyde (Linear okulu).
 * Boşken: hızlı aksiyonlar + sayfalar. Yazınca: /api/search gruplu sonuçlar
 * (müşteri/poliçe/fırsat) + eşleşen komutlar. Klavye: ↑↓ Enter Esc.
 * Kütüphanesiz (~0 KB bağımlılık). CRMShell'e mount edilir;
 * window "sigortaos:palette" olayı ile de açılır (sidebar tetikleyicisi).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, UserPlus, Target, ShieldCheck, MessageSquare, RefreshCw, Bot,
  Users, LayoutDashboard, Settings, ArrowRight, Loader2, Phone, IdCard, FileText,
} from "lucide-react";
import { stageOf } from "@/lib/opportunities";

type SearchRes = {
  intent: string;
  customers: { id: string; name: string; phone: string | null; identity_no: string | null; insurance_type: string | null }[];
  policies: { id: string; policy_no: string | null; policy_type: string; status: string; customer_id: string; customer_name: string | null }[];
  opportunities: { id: string; request_type: string; status: string; customer_id: string; customer_name: string | null }[];
};

type Item = {
  key: string;
  group: string;
  Icon: typeof Search;
  title: string;
  sub?: string | null;
  badge?: { text: string; cls: string } | null;
  href: string;
  keywords?: string; // boş-durum aksiyon filtresi için
};

const ACTIONS: Item[] = [
  { key: "a-cust", group: "Oluştur", Icon: UserPlus, title: "Yeni Müşteri", href: "/customers?new=1", keywords: "yeni müşteri ekle musteri" },
  { key: "a-opp", group: "Oluştur", Icon: Target, title: "Yeni Satış Fırsatı", href: "/firsatlar?new=1", keywords: "yeni fırsat firsat lead teklif" },
  { key: "a-pol", group: "Oluştur", Icon: ShieldCheck, title: "Yeni Poliçe", href: "/policies?new=1", keywords: "yeni poliçe police ekle" },
  { key: "g-dash", group: "Git", Icon: LayoutDashboard, title: "Dashboard", href: "/dashboard", keywords: "ana sayfa panel" },
  { key: "g-opp", group: "Git", Icon: Target, title: "Satış Fırsatları", href: "/firsatlar", keywords: "fırsat kanban pipeline satış" },
  { key: "g-cust", group: "Git", Icon: Users, title: "Müşteriler", href: "/customers", keywords: "müşteri liste" },
  { key: "g-pol", group: "Git", Icon: ShieldCheck, title: "Poliçeler", href: "/policies", keywords: "poliçe liste" },
  { key: "g-ren", group: "Git", Icon: RefreshCw, title: "Yenilemeler", href: "/renewals", keywords: "yenileme bitiş" },
  { key: "g-wa", group: "Git", Icon: MessageSquare, title: "WhatsApp Kuyruğu", href: "/whatsapp-queue", keywords: "whatsapp mesaj kuyruk" },
  { key: "g-ai", group: "Git", Icon: Bot, title: "AI Asistan", href: "/ai-assistant", keywords: "yapay zeka ai asistan" },
  { key: "g-set", group: "Git", Icon: Settings, title: "Ayarlar", href: "/settings", keywords: "ayar ekip whatsapp paket" },
];

function tr(s: string) { return s.toLocaleLowerCase("tr"); }

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Açma/kapama: ⌘K / Ctrl+K + sidebar olayı ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sigortaos:palette", onEvent);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("sigortaos:palette", onEvent); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setRes(null); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  // ── Arama (debounce) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (q.trim().length < 2) { setRes(null); setLoading(false); return; }
    setLoading(true);
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json();
        if (!j?.error) setRes(j as SearchRes);
      } catch { /* sessiz */ }
      setLoading(false);
    }, 250);
  }, [q]);

  // ── Görünen liste ─────────────────────────────────────────────────────────
  const items = useMemo<Item[]>(() => {
    const query = tr(q.trim());
    if (query.length < 2) return ACTIONS; // boş durum: tüm aksiyonlar + sayfalar

    const out: Item[] = [];
    if (res) {
      for (const c of res.customers) out.push({
        key: `c-${c.id}`, group: "Müşteriler", Icon: Users, title: c.name,
        sub: [c.phone, c.identity_no].filter(Boolean).join(" · ") || c.insurance_type,
        href: `/customers/${c.id}`,
      });
      for (const p of res.policies) out.push({
        key: `p-${p.id}`, group: "Poliçeler", Icon: FileText,
        title: `${p.policy_type}${p.policy_no ? ` · ${p.policy_no}` : ""}`,
        sub: p.customer_name,
        badge: p.status === "Aktif" ? { text: "Aktif", cls: "bg-emerald-100 text-emerald-700" } : null,
        href: `/policies?q=${encodeURIComponent(p.policy_no ?? p.customer_name ?? "")}`,
      });
      for (const o of res.opportunities) out.push({
        key: `o-${o.id}`, group: "Fırsatlar", Icon: Target,
        title: `${o.customer_name ?? "Müşteri"} · ${o.request_type}`,
        badge: { text: o.status, cls: stageOf(o.status).badge },
        href: `/firsatlar?open=${o.id}`,
      });
    }
    // Eşleşen komutlar en alta
    for (const a of ACTIONS) {
      if (tr(a.title).includes(query) || (a.keywords && tr(a.keywords).includes(query))) out.push(a);
    }
    return out;
  }, [q, res]);

  useEffect(() => { setSel(0); }, [items.length, q]);

  const go = useCallback((item: Item) => {
    setOpen(false);
    router.push(item.href);
  }, [router]);

  // ── Klavye navigasyonu ────────────────────────────────────────────────────
  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && items[sel]) { e.preventDefault(); go(items[sel]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  // Grupla (sıra korunur)
  const groups: { name: string; items: { item: Item; i: number }[] }[] = [];
  items.forEach((item, i) => {
    const g = groups.find((x) => x.name === item.group);
    if (g) g.items.push({ item, i });
    else groups.push({ name: item.group, items: [{ item, i }] });
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onMouseDown={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Girdi */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          {loading ? <Loader2 className="w-4.5 h-4.5 w-[18px] h-[18px] text-indigo-500 animate-spin flex-shrink-0" />
                   : <Search className="w-[18px] h-[18px] text-slate-300 flex-shrink-0" />}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
            placeholder="Müşteri, TC, telefon, plaka, poliçe no ara veya komut yaz…"
            className="flex-1 text-[15px] outline-none placeholder:text-slate-300 bg-transparent" />
          <kbd className="hidden sm:block text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Liste */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              {loading ? "Aranıyor…" : "Sonuç bulunamadı."}
            </p>
          ) : groups.map((g) => (
            <div key={g.name} className="mb-1">
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{g.name}</p>
              {g.items.map(({ item, i }) => (
                <button key={item.key} data-i={i}
                  onMouseEnter={() => setSel(i)} onClick={() => go(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${sel === i ? "bg-indigo-50" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sel === i ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                    <item.Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                    {item.sub && <p className="text-xs text-slate-400 truncate">{item.sub}</p>}
                  </div>
                  {item.badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${item.badge.cls}`}>{item.badge.text}</span>}
                  {sel === i && <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Alt bilgi */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/60">
          <span><kbd className="font-bold">↑↓</kbd> gezin</span>
          <span><kbd className="font-bold">↵</kbd> aç</span>
          <span className="ml-auto flex items-center gap-1"><Phone className="w-3 h-3" /><IdCard className="w-3 h-3" /> TC · telefon · plaka · poliçe no ile arayabilirsiniz</span>
        </div>
      </div>
    </div>
  );
}
