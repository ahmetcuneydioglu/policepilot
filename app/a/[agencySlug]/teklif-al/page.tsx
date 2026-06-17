"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/insurance-products";

type Agency = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_color: string;
};

const TAB_ACTIVE_DEFAULT = "bg-blue-600 text-white border-blue-600";

const PRODUCT_TAGS: Record<string, string[]> = {
  "trafik":             ["Zorunlu"],
  "kasko":              ["En Çok Tercih"],
  "imm":                ["Ekstra Güvence"],
  "yesil-kart":         ["Yurt Dışı"],
  "elektrikli-kasko":   ["EV Araçlar"],
  "tamamlayici-saglik": ["SGK Destekli"],
  "ozel-saglik":        ["Kapsamlı"],
  "seyahat-saglik":     ["Yurt Dışı"],
  "dask":               ["Zorunlu"],
  "konut":              ["Yangın & Hırsızlık"],
  "esyam-guvende":      ["Elektronik"],
  "evcil-hayvan":       ["Veteriner"],
  "cep-telefonu":       ["Kırılma & Çalınma"],
  "ferdi-kaza":         ["Kaza Güvencesi"],
};

export default function AgencyTeklifPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = use(params);
  const [agency, setAgency]   = useState<Agency | null>(null);
  const [fetching, setFetching] = useState(true);
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("id, name, slug, logo_url, phone, email, website, primary_color")
      .eq("slug", agencySlug)
      .maybeSingle()
      .then(({ data }: { data: Agency | null }) => {
        setAgency(data);
        setFetching(false);
      });
  }, [agencySlug]);

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!agency) {
    notFound();
  }

  const color  = agency.primary_color ?? "#2563eb";
  const active = CATEGORIES.find((c) => c.id === activeId)!;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {agency.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: color }}
              >
                {agency.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-bold text-slate-900 text-base">{agency.name}</span>
          </div>
          <div className="flex items-center gap-4">
            {agency.phone && (
              <a
                href={`tel:${agency.phone}`}
                className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {agency.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1.5">
            Hangi Sigorta İçin Teklif Alacaksınız?
          </h1>
          <p className="text-gray-500 text-sm">
            {agency.name} — ürünü seçin, formu doldurun, size hemen dönelim.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => {
                const isActive = cat.id === activeId;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveId(cat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
                    style={
                      isActive
                        ? { backgroundColor: color, color: "#fff", borderColor: color }
                        : {}
                    }
                    {...(!isActive && {
                      className:
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all bg-white text-slate-600 border-gray-200 hover:border-gray-300 hover:text-slate-800",
                    })}
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                    <span
                      className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                      style={isActive ? { backgroundColor: "rgba(255,255,255,0.2)" } : { backgroundColor: "#f3f4f6", color: "#6b7280" }}
                    >
                      {cat.products.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <span className="text-lg">{active.icon}</span>
              <span>{active.description}</span>
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {active.products.map((product) => {
                const tags = PRODUCT_TAGS[product.slug] ?? [];
                return (
                  <Link
                    key={product.slug}
                    href={`/a/${agencySlug}/teklif-al/${product.slug}`}
                    className="group relative flex flex-col items-center justify-center gap-2.5 bg-white border border-gray-100 rounded-2xl px-3 py-6 text-center hover:border-blue-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {tags[0] && (
                      <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}>
                        {tags[0]}
                      </span>
                    )}
                    <span className="text-3xl">{product.icon}</span>
                    <span className="text-xs font-semibold text-slate-700 leading-tight group-hover:text-blue-700 transition-colors">
                      {product.label}
                    </span>
                    <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity -mt-1"
                      style={{ color }}>
                      Teklif Al →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 lg:sticky lg:top-20">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Nasıl Çalışır?</h3>
              <ol className="space-y-4">
                {[
                  { n: "1", t: "Ürünü seç",               d: "İhtiyacınıza uygun sigorta türünü seçin." },
                  { n: "2", t: "Formu doldur",             d: "Bilgilerinizi girin, 2 dakika yeter." },
                  { n: "3", t: "Talebin acenteye düşsün",  d: "Formunuz anında uzman acentemize iletilir." },
                  { n: "4", t: "WhatsApp'tan al",          d: "15 dk. içinde size dönüş yapılır." },
                ].map((step, i, arr) => (
                  <li key={step.n} className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-6 h-6 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center"
                        style={{ backgroundColor: color }}>
                        {step.n}
                      </div>
                      {i < arr.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: `${color}20` }} />}
                    </div>
                    <div className="pb-3">
                      <p className="font-semibold text-slate-800 text-xs">{step.t}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Güvenceler</p>
              <ul className="space-y-2">
                {["Teklif almak ücretsizdir", "KVKK kapsamında veri güvencesi", "15 dk. ortalama dönüş süresi", "Uzman acente danışmanlığı"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {agency.phone && (
              <div className="rounded-2xl p-4 text-white text-center" style={{ backgroundColor: color }}>
                <p className="text-xs opacity-80 mb-1">Yardımcı olmaya hazırız</p>
                <a href={`tel:${agency.phone}`} className="text-lg font-extrabold tracking-tight block hover:opacity-80 transition-opacity">
                  {agency.phone}
                </a>
                <p className="text-[10px] opacity-60 mt-0.5">Hafta içi 09:00–18:00</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-sm">
            <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: color }}>
              {agency.name.slice(0, 1).toUpperCase()}
            </div>
            {agency.name}
          </div>
          <p>© 2026 {agency.name} · Tüm hakları saklıdır.</p>
          <p className="text-[10px] text-gray-300">SigortaOS altyapısıyla çalışmaktadır</p>
        </div>
      </footer>
    </div>
  );
}
