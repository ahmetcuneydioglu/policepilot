"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/insurance-products";

// Per-category active tab color
const TAB_ACTIVE: Record<string, string> = {
  blue:    "bg-blue-600 text-white border-blue-600",
  emerald: "bg-emerald-600 text-white border-emerald-600",
  amber:   "bg-amber-500 text-white border-amber-500",
  purple:  "bg-purple-600 text-white border-purple-600",
};

// Static advantage tags per product slug
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

export default function TeklifAlPage() {
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);
  const active = CATEGORIES.find((c) => c.id === activeId)!;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">

      {/* ── Demo banner ─────────────────────────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-start sm:items-center gap-2 text-xs sm:text-sm text-amber-800">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <span className="font-semibold">Demo formu:</span> Bu sayfa genel tanıtım amaçlıdır. Gerçek acente teklif akışı{" "}
            <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">/a/[acente-linki]/teklif-al</code>
            {" "}üzerinden çalışır.
          </span>
        </div>
      </div>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 text-base">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            SigortaOS
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ana Sayfa
            </Link>
            <a
              href="tel:08500000000"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              0850 000 00 00
            </a>
          </div>
        </div>
      </header>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1.5">
            Hangi Sigorta İçin Teklif Alacaksınız?
          </h1>
          <p className="text-gray-500 text-sm">
            Kategoriyi seçin, ürünü belirleyin — acentemiz WhatsApp&apos;tan dönüş yapsın.
          </p>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left: categories + products */}
          <div className="flex-1 min-w-0">

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => {
                const isActive = cat.id === activeId;
                const activeClass = TAB_ACTIVE[cat.color] ?? TAB_ACTIVE.blue;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveId(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      isActive
                        ? activeClass
                        : "bg-white text-slate-600 border-gray-200 hover:border-gray-300 hover:text-slate-800"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                    <span className={`text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                      isActive ? "bg-white/20" : "bg-gray-100 text-gray-500"
                    }`}>
                      {cat.products.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Category info row */}
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <span className="text-lg">{active.icon}</span>
              <span>{active.description}</span>
            </div>

            {/* Product grid — same card style as homepage */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {active.products.map((product) => {
                const tags = PRODUCT_TAGS[product.slug] ?? [];
                return (
                  <Link
                    key={product.slug}
                    href={`/teklif-al/${product.slug}`}
                    className="group relative flex flex-col items-center justify-center gap-2.5 bg-white border border-gray-100 rounded-2xl px-3 py-6 text-center hover:border-blue-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {/* Advantage tag */}
                    {tags[0] && (
                      <span className="absolute top-2.5 right-2.5 bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-blue-100">
                        {tags[0]}
                      </span>
                    )}
                    <span className="text-3xl">{product.icon}</span>
                    <span className="text-xs font-semibold text-slate-700 leading-tight group-hover:text-blue-700 transition-colors">
                      {product.label}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
                      Teklif Al →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0 space-y-4">

            {/* How it works */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 lg:sticky lg:top-20">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Nasıl Çalışır?</h3>
              <ol className="space-y-4">
                {[
                  { n: "1", t: "Ürünü seç",              d: "İhtiyacınıza uygun sigorta türünü seçin." },
                  { n: "2", t: "Formu doldur",            d: "Bilgilerinizi girin, 2 dakika yeter." },
                  { n: "3", t: "Talebin acenteye düşsün", d: "Formunuz anında uzman acentemize iletilir." },
                  { n: "4", t: "WhatsApp&apos;tan al",         d: "15 dk. içinde size dönüş yapılır." },
                ].map((step, i, arr) => (
                  <li key={step.n} className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {step.n}
                      </div>
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-blue-50 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="font-semibold text-slate-800 text-xs" dangerouslySetInnerHTML={{ __html: step.t }} />
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <a
                href="https://wa.me/905551234567"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Direkt WhatsApp&apos;tan Yaz
              </a>
            </div>

            {/* Mini trust */}
            <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Güvenceler</p>
              <ul className="space-y-2">
                {[
                  "Teklif almak ücretsizdir",
                  "KVKK kapsamında veri güvencesi",
                  "15 dk. ortalama dönüş süresi",
                  "Uzman acente danışmanlığı",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Phone */}
            <div className="bg-blue-700 rounded-2xl p-4 text-white text-center">
              <p className="text-xs text-blue-200 mb-1">Yardımcı olmaya hazırız</p>
              <a href="tel:08500000000" className="text-lg font-extrabold tracking-tight block hover:text-blue-100 transition-colors">
                0850 000 00 00
              </a>
              <p className="text-[10px] text-blue-300 mt-0.5">Hafta içi 09:00–18:00</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer strip ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-sm">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            SigortaOS
          </div>
          <p>© 2026 SigortaOS · Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600 transition-colors">KVKK</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Gizlilik</a>
            <Link href="/" className="hover:text-slate-600 transition-colors">Ana Sayfa</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
