"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

// ─── Product links shown in the "quick links" section ─────────────────────────
const QUICK_PRODUCTS = [
  { slug: "trafik",  label: "Trafik Sigortası",  icon: "🚗" },
  { slug: "kasko",   label: "Kasko",              icon: "🛡️" },
  { slug: "dask",    label: "DASK",               icon: "🏠" },
];

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
        copied
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
      }`}
    >
      {copied ? (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Kopyalandı!</>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label}</>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, profile, role, agencyId } = useAuth();

  const [agencySlug,  setAgencySlug]  = useState<string | null>(null);
  const [agencyName,  setAgencyName]  = useState<string | null>(null);
  const [agencyPhone, setAgencyPhone] = useState<string | null>(null);
  const [agencyColor, setAgencyColor] = useState<string>("#2563eb");
  const [agencyLoading, setAgencyLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!agencyId) return;
    setAgencyLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("agencies") as any)
      .select("name, slug, phone, primary_color")
      .eq("id", agencyId)
      .maybeSingle()
      .then(({ data }: { data: { name: string; slug: string; phone: string | null; primary_color: string } | null }) => {
        if (data) {
          setAgencyName(data.name);
          setAgencySlug(data.slug);
          setAgencyPhone(data.phone);
          setAgencyColor(data.primary_color ?? "#2563eb");
        }
        setAgencyLoading(false);
      });
  }, [agencyId]);

  const displayName = profile?.full_name ?? user?.email ?? "—";
  const email       = user?.email ?? "—";
  const initials    = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel   = role === "super_admin" ? "Süper Admin" : role === "agency_user" ? "Acente Kullanıcısı" : "—";

  const baseLink = agencySlug ? `${origin}/a/${agencySlug}/teklif-al` : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Hesap ve uygulama tercihlerinizi yönetin</p>
      </div>

      {/* ── Teklif Linkleri (agency_user only) ──────────────────────────── */}
      {role === "agency_user" && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-800">Acente Teklif Linkleri</h2>
          </div>

          {agencyLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}
            </div>
          ) : !agencySlug ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-400">Acenteniz henüz oluşturulmamış. Yöneticinizle iletişime geçin.</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Main teklif link */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Ana Teklif Linki
                </p>
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: agencyColor }}
                  >
                    {agencyName?.slice(0, 1).toUpperCase() ?? "A"}
                  </div>
                  <span className="flex-1 text-xs font-mono text-blue-900 truncate">{baseLink}</span>
                  <CopyButton text={baseLink!} label="Kopyala" />
                  <a
                    href={baseLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center p-1.5 rounded-lg bg-white border border-blue-100 text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Önizle"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Quick product links */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Ürüne Özel Linkler
                </p>
                <div className="space-y-2">
                  {QUICK_PRODUCTS.map((prod) => {
                    const url = `${origin}/a/${agencySlug}/teklif-al/${prod.slug}`;
                    return (
                      <div key={prod.slug} className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <span className="text-lg flex-shrink-0">{prod.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700">{prod.label}</p>
                          <p className="text-[10px] font-mono text-gray-400 truncate">{url}</p>
                        </div>
                        <CopyButton text={url} />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                          title="Önizle"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Share tip */}
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Bu linkleri müşterilerinizle WhatsApp, Instagram veya web sitenizde paylaşabilirsiniz.
                  Doldurulan her form doğrudan size iletilir.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Profil ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up stagger-1">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Profil Bilgileri</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {initials || "—"}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{displayName}</p>
              <p className="text-sm text-gray-500">{email}</p>
              <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ad Soyad</label>
              <input
                defaultValue={profile?.full_name ?? ""}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-posta</label>
              <input
                defaultValue={user?.email ?? ""}
                disabled
                className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed"
              />
            </div>
            {agencyName && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Acente</label>
                <input
                  defaultValue={agencyName}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
            )}
            {agencyPhone && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Acente Telefonu</label>
                <input
                  defaultValue={agencyPhone}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Bildirimler ──────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Bildirimler</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: "Poliçe yenileme hatırlatmaları", desc: "Bitiş tarihi yaklaşan poliçeler için uyarı al", on: true },
            { label: "Yeni teklif talepleri",           desc: "Yeni bir teklif talebi geldiğinde bildirim al",  on: true },
            { label: "WhatsApp mesaj bildirimleri",     desc: "Müşteri mesaj gönderdiğinde bildirim al",        on: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <button
                className={`relative rounded-full transition-colors flex-shrink-0 ${item.on ? "bg-blue-600" : "bg-gray-200"}`}
                style={{ height: 22, width: 40 }}
              >
                <span
                  className="absolute bg-white rounded-full shadow-sm transition-transform"
                  style={{ width: 18, height: 18, top: 2, transform: item.on ? "translateX(20px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up stagger-3">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Plan & Abonelik</h2>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800">Pro Plan</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Aktif</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Sınırsız müşteri · AI Asistan · Öncelikli destek</p>
          </div>
          <button className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            Planı Yönet
          </button>
        </div>
      </section>
    </div>
  );
}
