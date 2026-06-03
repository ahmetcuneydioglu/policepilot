"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { needsOnboarding } from "@/lib/tenant";

type Member = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type AgencyInfo = {
  name: string;
  slug: string;
  plan: string | null;
  max_users: number | null;
  is_active: boolean | null;
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        copied
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {copied ? (
        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Kopyalandı!</>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label}</>
      )}
    </button>
  );
}

export default function TeamPage() {
  const { agencyId, loading: authLoading, role } = useAuth();
  const [members, setMembers]   = useState<Member[]>([]);
  const [agency, setAgency]     = useState<AgencyInfo | null>(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);

    const [{ data: ag }, { data: mb }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("agencies") as any)
        .select("name, slug, plan, max_users, is_active")
        .eq("id", agencyId)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("profiles") as any)
        .select("id, full_name, role, created_at")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: true }),
    ]);

    if (ag) setAgency(ag as AgencyInfo);
    if (mb) setMembers(mb as Member[]);
    setLoading(false);
  }, [agencyId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (needsOnboarding(role, agencyId, authLoading)) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-sm">Acenteye bağlı değilsiniz.</p>
      </div>
    );
  }

  const maxUsers    = agency?.max_users ?? 10;
  const currentCount = members.length;
  const atLimit     = currentCount >= maxUsers;
  const pct         = Math.min((currentCount / maxUsers) * 100, 100);
  const planLabel   = PLAN_LABELS[agency?.plan ?? "starter"] ?? "Starter";
  const origin      = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl   = agency?.slug ? `${origin}/register?invite=${agency.slug}` : "";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ekip Üyeleri</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          {agency?.name ?? "Acenteniz"} — ekip yönetimi
        </p>
      </div>

      {/* Usage card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Plan Kullanımı</p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-extrabold ${atLimit ? "text-red-600" : "text-slate-900"}`}>
                {currentCount}
              </span>
              <span className="text-gray-400 text-sm font-medium">/ {maxUsers} kullanıcı</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {planLabel}
              </span>
            </div>
          </div>
          {atLimit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-red-700 font-semibold">Paket limitine ulaşıldı</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400">
          {atLimit
            ? "Yeni üye eklemek için plan limitini artırmanız gerekiyor. Destek için yöneticinizle iletişime geçin."
            : `${maxUsers - currentCount} kullanıcı ekleyebilirsiniz.`}
        </p>
      </div>

      {/* Team members list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Mevcut Üyeler</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {members.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Henüz ekip üyesi yok.
            </div>
          ) : (
            members.map((m, i) => (
              <div key={m.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(m.full_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.full_name ?? "İsimsiz"}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{m.role === "agency_user" ? "Acente Kullanıcısı" : m.role}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {i === 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      Owner
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {new Date(m.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Ekip Üyesi Davet Et</h2>
        <p className="text-xs text-gray-500 mb-4">
          Davet linkini ekibinizle paylaşın. Linki alan kişi kayıt olduğunda otomatik olarak acentenize eklenir.
        </p>

        {atLimit ? (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Paket limitine ulaşıldı</p>
              <p className="text-xs text-red-600 mt-0.5">
                Mevcut planınızda maksimum <strong>{maxUsers} kullanıcı</strong> hakkınız bulunmaktadır.
                Daha fazla kullanıcı eklemek için plan yükseltmesi gereklidir.
                Destek için yöneticinizle iletişime geçin.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Link preview */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-gray-200 rounded-xl">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="flex-1 text-xs font-mono text-slate-700 truncate">{inviteUrl}</span>
              <CopyButton text={inviteUrl} label="Linki Kopyala" />
            </div>

            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`PoliçePilot ekibimize katılmak için bu linki kullan: ${inviteUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp ile Paylaş
            </a>

            <p className="text-[11px] text-gray-400">
              💡 Link geçersiz kılmak için yöneticinizle iletişime geçin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
