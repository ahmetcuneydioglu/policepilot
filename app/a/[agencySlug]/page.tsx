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
  primary_color: string;
};

// Top-highlighted products shown on the landing page
const FEATURED_SLUGS = ["trafik", "kasko", "dask", "tamamlayici-saglik", "konut", "ozel-saglik"];

function getAllProducts() {
  return CATEGORIES.flatMap((c) => c.products.map((p) => ({ ...p, categoryLabel: c.label, categoryIcon: c.icon })));
}

export default function AgencyLandingPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = use(params);
  const [agency, setAgency]   = useState<Agency | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("id, name, slug, logo_url, phone, email, primary_color")
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

  if (!agency) notFound();

  const color   = agency.primary_color ?? "#2563eb";
  const allProds = getAllProducts();
  const featured = FEATURED_SLUGS.map((slug) => allProds.find((p) => p.slug === slug)).filter(Boolean) as typeof allProds;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo / Name */}
          <div className="flex items-center gap-2.5">
            {agency.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency.logo_url} alt={agency.name} className="h-8 w-auto object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {agency.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-bold text-slate-900">{agency.name}</span>
          </div>

          {/* Phone */}
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
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}08 0%, ${color}18 100%)`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border"
            style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Yetkili Sigorta Acentesi
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
            {agency.name} ile<br />
            <span style={{ color }}>Sigorta Teklifi Alın</span>
          </h1>
          <p className="text-gray-500 text-base sm:text-lg mb-8 max-w-md mx-auto">
            Hızlı, kolay ve güvenilir. Formu doldurun, 15 dakikada WhatsApp&apos;tan dönüş yapalım.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/a/${agencySlug}/teklif-al`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-base shadow-lg hover:opacity-90 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: color, boxShadow: `0 8px 24px ${color}40` }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Teklif Almak İstiyorum
            </Link>
            {agency.phone && (
              <a
                href={`tel:${agency.phone}`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-base border-2 text-slate-700 hover:bg-slate-50 transition-colors"
                style={{ borderColor: `${color}30` }}
              >
                <svg className="w-4.5 h-4.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {agency.phone}
              </a>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
            {[
              { icon: "⚡", label: "15 dk. dönüş" },
              { icon: "🔒", label: "KVKK güvenceli" },
              { icon: "💰", label: "Ücretsiz teklif" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <span>{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Products ────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Popüler Sigorta Ürünleri</h2>
          <p className="text-gray-500 text-sm">Hızlı teklif almak için bir ürün seçin</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {featured.map((product) => (
            <Link
              key={product.slug}
              href={`/a/${agencySlug}/teklif-al/${product.slug}`}
              className="group relative flex flex-col items-center justify-center gap-2 bg-white border border-gray-100 rounded-2xl px-3 py-6 text-center hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: "transparent", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}40`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
            >
              <span className="text-3xl">{product.icon}</span>
              <span className="text-xs font-semibold text-slate-700 leading-tight group-hover:text-slate-900 transition-colors">
                {product.label}
              </span>
              <span
                className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color }}
              >
                Teklif Al →
              </span>
            </Link>
          ))}
        </div>

        {/* See all button */}
        <div className="text-center">
          <Link
            href={`/a/${agencySlug}/teklif-al`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all hover:opacity-80"
            style={{ borderColor: `${color}50`, color }}
          >
            Tüm Sigorta Ürünleri
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl font-bold text-slate-900 text-center mb-8">Nasıl Çalışır?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { n: "1", icon: "📋", title: "Ürünü seç",             desc: "İhtiyacınıza uygun sigorta türünü seçin" },
              { n: "2", icon: "✍️", title: "Formu doldur",           desc: "Bilgilerinizi girin, 2 dakika yeter" },
              { n: "3", icon: "📤", title: "Talebin düşsün",         desc: "Formunuz anında acentemize iletilir" },
              { n: "4", icon: "💬", title: "WhatsApp'tan dönüş al", desc: "15 dk. içinde size dönüş yapılır" },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                  style={{ backgroundColor: `${color}15` }}
                >
                  {step.icon}
                </div>
                <p className="font-semibold text-slate-800 text-sm mb-1">{step.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Hemen başlayın</h2>
          <p className="text-gray-500 text-sm mb-6">
            {agency.name} — sigorta uzmanlarımız size yardımcı olmaya hazır.
          </p>
          <Link
            href={`/a/${agencySlug}/teklif-al`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-base shadow-lg hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: color, boxShadow: `0 8px 24px ${color}40` }}
          >
            Teklif Al
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
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
