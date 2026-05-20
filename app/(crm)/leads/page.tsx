"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Lead = {
  id: string;
  company_name: string;
  district: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  google_rating: number | null;
  review_count: number | null;
  google_maps_url: string | null;
  lead_score: number;
  lead_temperature: string;
  status: string;
  weakness: string | null;
  outreach_message: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = [
  "Yeni",
  "Mesaj Atıldı",
  "Yanıt Geldi",
  "Demo Planlandı",
  "Teklif Verildi",
  "Müşteri Oldu",
  "Kaybedildi",
];

const STATUS_CLS: Record<string, string> = {
  Yeni: "bg-slate-100 text-slate-700 border-slate-200",
  "Mesaj Atıldı": "bg-blue-100 text-blue-700 border-blue-200",
  "Yanıt Geldi": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Demo Planlandı": "bg-violet-100 text-violet-700 border-violet-200",
  "Teklif Verildi": "bg-amber-100 text-amber-700 border-amber-200",
  "Müşteri Oldu": "bg-emerald-100 text-emerald-700 border-emerald-200",
  Kaybedildi: "bg-red-100 text-red-700 border-red-200",
};

const TEMP_OPTIONS = ["Sıcak", "Orta", "Zayıf"];

const TEMP_CLS: Record<string, string> = {
  Sıcak: "bg-orange-100 text-orange-700 border-orange-200",
  Orta: "bg-amber-100 text-amber-700 border-amber-200",
  Zayıf: "bg-slate-100 text-slate-600 border-slate-200",
};

const EMPTY_FORM = {
  company_name: "",
  district: "",
  phone: "",
  website: "",
  instagram: "",
  google_rating: "",
  review_count: "",
  google_maps_url: "",
  lead_score: "50",
  lead_temperature: "Orta",
  status: "Yeni",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function scoreCls(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-blue-100 text-blue-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function analyzeWeaknesses(lead: Lead): string[] {
  const ws: string[] = [];
  if (!lead.website) ws.push("Web teklif formu bulunmuyor");
  if (lead.review_count !== null && lead.review_count < 50)
    ws.push("Google yorumu düşük");
  if (lead.website) ws.push("Mevcut site incelenmeli");
  return ws;
}

function defaultOutreach(company: string): string {
  return `Merhaba ${company}, sigorta acenteleri için müşterilerin trafik, kasko ve sağlık teklif taleplerini web formu üzerinden toplayıp acente paneline düşüren küçük bir sistem geliştirdik. Uygun olursanız kısa demo paylaşabilirim.`;
}

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length === 11) return "9" + d;
  if (d.length === 10) return "90" + d;
  return d;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseCSV(text: string): Partial<Lead>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const expectedHeaders = [
    "company_name",
    "district",
    "phone",
    "website",
    "instagram",
    "google_rating",
    "review_count",
    "google_maps_url",
  ];

  let dataLines = lines;
  // Check if first line looks like a header
  const firstCols = firstLine.split(delimiter).map((c) => c.trim().toLowerCase());
  const hasHeader = expectedHeaders.some((h) => firstCols.includes(h));
  if (hasHeader) {
    dataLines = lines.slice(1);
  }

  return dataLines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      const [
        company_name,
        district,
        phone,
        website,
        instagram,
        google_rating,
        review_count,
        google_maps_url,
      ] = cols;
      return {
        company_name: company_name || "",
        district: district || null,
        phone: phone ? normalizePhone(phone) : null,
        website: website || null,
        instagram: instagram || null,
        google_rating: google_rating ? parseFloat(google_rating) : null,
        review_count: review_count ? parseInt(review_count, 10) : null,
        google_maps_url: google_maps_url || null,
        lead_score: 50,
        lead_temperature: "Orta",
        status: "Yeni",
      };
    });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvParsed, setCsvParsed] = useState<Partial<Lead>[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("Tümü");
  const [filterTemp, setFilterTemp] = useState("Tümü");
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [filterWA, setFilterWA] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadLeads = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("leads") as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setLeads(data as Lead[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // ---------------------------------------------------------------------------
  // Add lead
  // ---------------------------------------------------------------------------
  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      setFormError("Firma adı zorunludur.");
      return;
    }
    setFormError("");
    setSaving(true);
    const insertData = {
      company_name: form.company_name.trim(),
      district: form.district.trim() || null,
      phone: form.phone.trim() ? normalizePhone(form.phone.trim()) : null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      google_rating: form.google_rating ? parseFloat(form.google_rating) : null,
      review_count: form.review_count ? parseInt(form.review_count, 10) : null,
      google_maps_url: form.google_maps_url.trim() || null,
      lead_score: parseInt(form.lead_score, 10) || 50,
      lead_temperature: form.lead_temperature,
      status: form.status,
      outreach_message: defaultOutreach(form.company_name.trim()),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("leads") as any).insert([insertData]);
    setSaving(false);
    if (!error) {
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      loadLeads();
    }
  }

  // ---------------------------------------------------------------------------
  // Status / temp / score updates (optimistic)
  // ---------------------------------------------------------------------------
  async function updateStatus(id: string, status: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any).update({ status }).eq("id", id);
  }

  async function updateTemp(id: string, lead_temperature: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, lead_temperature } : l))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any)
      .update({ lead_temperature })
      .eq("id", id);
  }

  async function updateScore(id: string, delta: number) {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const ns = Math.min(100, Math.max(0, l.lead_score + delta));
        return { ...l, lead_score: ns };
      })
    );
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const newScore = Math.min(100, Math.max(0, lead.lead_score + delta));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any)
      .update({ lead_score: newScore })
      .eq("id", id);
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------
  async function saveNote(id: string, notes: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, notes } : l))
    );
    setEditingNoteId(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any).update({ notes }).eq("id", id);
  }

  // ---------------------------------------------------------------------------
  // Mark contacted
  // ---------------------------------------------------------------------------
  async function markContacted(id: string) {
    const now = new Date().toISOString();
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, last_contacted_at: now } : l))
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any)
      .update({ last_contacted_at: now })
      .eq("id", id);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function deleteLead(id: string) {
    if (!confirm("Bu lead silinsin mi?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("leads") as any).delete().eq("id", id);
  }

  // ---------------------------------------------------------------------------
  // CSV import
  // ---------------------------------------------------------------------------
  function handleCSVParse() {
    const parsed = parseCSV(csvText);
    setCsvParsed(parsed);
  }

  async function handleCSVImport() {
    if (csvParsed.length === 0) return;
    setCsvImporting(true);
    for (const row of csvParsed) {
      if (!row.company_name?.trim()) continue;
      const insertData = {
        ...row,
        outreach_message: defaultOutreach(row.company_name!),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("leads") as any).insert([insertData]);
    }
    setCsvImporting(false);
    setCsvText("");
    setCsvParsed([]);
    setShowCSV(false);
    loadLeads();
  }

  // ---------------------------------------------------------------------------
  // Copy to clipboard
  // ---------------------------------------------------------------------------
  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filtered = leads.filter((l) => {
    if (filterStatus !== "Tümü" && l.status !== filterStatus) return false;
    if (filterTemp !== "Tümü" && l.lead_temperature !== filterTemp) return false;
    if (filterNoWebsite && l.website) return false;
    if (filterWA && !l.phone) return false;
    if (
      searchQ.trim() &&
      !l.company_name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !(l.district || "").toLowerCase().includes(searchQ.toLowerCase())
    )
      return false;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => l.lead_temperature === "Sıcak").length;
  const customers = leads.filter((l) => l.status === "Müşteri Oldu").length;
  const noWebsite = leads.filter((l) => !l.website).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Page header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">Satış Leadleri</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-wider">
            İÇ OPERASYON
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowCSV(!showCSV);
              setShowAddForm(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            CSV İçe Aktar
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowCSV(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Lead Ekle
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats row */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Toplam Lead", value: totalLeads, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "Sıcak Lead", value: hotLeads, color: "text-orange-700", bg: "bg-orange-50" },
          { label: "Müşteri Oldu", value: customers, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Web Sitesi Yok", value: noWebsite, color: "text-red-700", bg: "bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 shadow-sm p-4`}>
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add Form */}
      {/* ------------------------------------------------------------------ */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Yeni Lead Ekle</h2>
          <form onSubmit={handleAddLead}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {[
                { name: "company_name", label: "Firma Adı *", placeholder: "Örn. ABC Sigorta" },
                { name: "district", label: "İlçe", placeholder: "Örn. Kadıköy" },
                { name: "phone", label: "Telefon", placeholder: "05xx xxx xx xx" },
                { name: "website", label: "Website", placeholder: "https://..." },
                { name: "instagram", label: "Instagram", placeholder: "@hesap" },
                { name: "google_maps_url", label: "Google Maps URL", placeholder: "https://maps.google.com/..." },
                { name: "google_rating", label: "Google Puanı", placeholder: "4.5" },
                { name: "review_count", label: "Yorum Sayısı", placeholder: "120" },
                { name: "lead_score", label: "Lead Skoru (0-100)", placeholder: "50" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={form[f.name as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sıcaklık</label>
                <select
                  value={form.lead_temperature}
                  onChange={(e) => setForm((p) => ({ ...p, lead_temperature: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {TEMP_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Durum</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 mb-3">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CSV Import */}
      {/* ------------------------------------------------------------------ */}
      {showCSV && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">CSV İçe Aktar</h2>
          <p className="text-xs text-slate-500 mb-3">
            Beklenen sütunlar: company_name, district, phone, website, instagram, google_rating, review_count, google_maps_url
            <br />Sekme veya virgül ayracı desteklenir. Başlık satırı varsa otomatik atlanır.
          </p>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvParsed([]);
            }}
            placeholder="CSV verisini buraya yapıştırın..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 mb-3"
          />
          {csvParsed.length > 0 && (
            <p className="text-xs text-slate-600 mb-3">
              {csvParsed.length} satır algılandı. İçe aktarmaya hazır.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCSVParse}
              className="px-4 py-1.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Ayrıştır
            </button>
            {csvParsed.length > 0 && (
              <button
                onClick={handleCSVImport}
                disabled={csvImporting}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {csvImporting ? "İçe aktarılıyor..." : `${csvParsed.length} Lead İçe Aktar`}
              </button>
            )}
            <button
              onClick={() => {
                setShowCSV(false);
                setCsvText("");
                setCsvParsed([]);
              }}
              className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filters */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Firma veya ilçe ara..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option>Tümü</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {/* Temp filter */}
          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option>Tümü</option>
            {TEMP_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          {/* No website */}
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterNoWebsite}
              onChange={(e) => setFilterNoWebsite(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            Web sitesi yok
          </label>

          {/* WhatsApp */}
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterWA}
              onChange={(e) => setFilterWA(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            WhatsApp uygun
          </label>

          <span className="ml-auto text-xs text-slate-400">{filtered.length} lead</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Table */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            Lead bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Firma / İlçe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">İletişim</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rating</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sıcaklık / Skor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Web</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Son İletişim</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <React.Fragment key={lead.id}>
                    {/* Main row */}
                    <tr className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                      {/* Firma / İlçe */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                            className="text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors"
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-150 ${expandedId === lead.id ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div>
                            <button
                              onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                              className="font-medium text-slate-900 hover:text-blue-600 transition-colors text-left"
                            >
                              {lead.company_name}
                            </button>
                            {lead.district && (
                              <p className="text-xs text-slate-400 mt-0.5">{lead.district}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* İletişim */}
                      <td className="px-4 py-3">
                        {lead.phone ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-700 text-xs">{lead.phone}</span>
                            <div className="flex gap-1">
                              <a
                                href={`https://wa.me/${lead.phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium hover:bg-emerald-200 transition-colors"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WA
                              </a>
                              {lead.instagram && (
                                <a
                                  href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-100 text-pink-700 text-[10px] font-medium hover:bg-pink-200 transition-colors"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                  </svg>
                                  IG
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3">
                        {lead.google_rating !== null ? (
                          <div>
                            <span className="text-slate-700 text-xs">
                              ★ {lead.google_rating}
                            </span>
                            {lead.review_count !== null && (
                              <p className="text-[10px] text-slate-400">{lead.review_count} yorum</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Sıcaklık / Skor */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={lead.lead_temperature}
                            onChange={(e) => updateTemp(lead.id, e.target.value)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border cursor-pointer focus:outline-none ${TEMP_CLS[lead.lead_temperature] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                          >
                            {TEMP_OPTIONS.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateScore(lead.id, -10)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs flex items-center justify-center transition-colors font-bold"
                            >
                              −
                            </button>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreCls(lead.lead_score)}`}>
                              {lead.lead_score}
                            </span>
                            <button
                              onClick={() => updateScore(lead.id, 10)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs flex items-center justify-center transition-colors font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded border cursor-pointer focus:outline-none max-w-[140px] ${STATUS_CLS[lead.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Web */}
                      <td className="px-4 py-3">
                        {lead.website ? (
                          <a
                            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-medium text-blue-600 hover:underline"
                          >
                            ✓ Var
                          </a>
                        ) : (
                          <span className="text-[10px] font-medium text-red-500">✗ Yok</span>
                        )}
                      </td>

                      {/* Son İletişim */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-600">{formatDate(lead.last_contacted_at)}</span>
                          <button
                            onClick={() => markContacted(lead.id)}
                            className="text-[10px] font-medium text-blue-600 hover:text-blue-700 text-left transition-colors"
                          >
                            Bugün
                          </button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteLead(lead.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === lead.id && (
                      <tr className="border-b border-gray-100 bg-slate-50/60">
                        <td colSpan={8} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Column 1: Weakness Analysis */}
                            <div>
                              <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Zayıf Nokta Analizi
                              </h3>
                              <div className="flex flex-wrap gap-1.5">
                                {analyzeWeaknesses(lead).map((w) => (
                                  <span
                                    key={w}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    {w}
                                  </span>
                                ))}
                              </div>
                              {lead.google_maps_url && (
                                <a
                                  href={lead.google_maps_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Google Maps
                                </a>
                              )}
                            </div>

                            {/* Column 2: Outreach Message */}
                            <div>
                              <h3 className="text-xs font-semibold text-slate-700 mb-2">Outreach Mesajı</h3>
                              <div className="bg-white rounded-lg border border-gray-200 p-3 text-xs text-slate-700 leading-relaxed mb-2">
                                {lead.outreach_message || defaultOutreach(lead.company_name)}
                              </div>
                              <button
                                onClick={() =>
                                  copyText(
                                    lead.id,
                                    lead.outreach_message || defaultOutreach(lead.company_name)
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  copied === lead.id
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {copied === lead.id ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Kopyalandı!
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Mesajı Kopyala
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Column 3: Notes */}
                            <div>
                              <h3 className="text-xs font-semibold text-slate-700 mb-2">Notlar</h3>
                              {editingNoteId === lead.id ? (
                                <div>
                                  <textarea
                                    rows={4}
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                    autoFocus
                                    className="w-full px-3 py-2 rounded-lg border border-blue-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none mb-2"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveNote(lead.id, noteInput)}
                                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                                    >
                                      Kaydet
                                    </button>
                                    <button
                                      onClick={() => setEditingNoteId(null)}
                                      className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
                                    >
                                      İptal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingNoteId(lead.id);
                                    setNoteInput(lead.notes || "");
                                  }}
                                  className="min-h-[80px] bg-white rounded-lg border border-gray-200 p-3 text-xs cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                  {lead.notes ? (
                                    <span className="text-slate-700 leading-relaxed whitespace-pre-wrap">{lead.notes}</span>
                                  ) : (
                                    <span className="text-slate-400 italic">Not eklemek için tıkla...</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
