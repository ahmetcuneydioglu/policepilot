"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";

// ─── Nav item type ────────────────────────────────────────────────────────────
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
};

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = {
  dashboard:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  quoteCenter:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  customers: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  requests:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  policies:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  ai:        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  settings:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  agencies:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  leads:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.75} /><circle cx="12" cy="12" r="6" strokeWidth={1.75} /><circle cx="12" cy="12" r="2" strokeWidth={1.75} /><line x1="12" y1="2" x2="12" y2="6" strokeWidth={1.75} strokeLinecap="round" /><line x1="12" y1="18" x2="12" y2="22" strokeWidth={1.75} strokeLinecap="round" /><line x1="2" y1="12" x2="6" y2="12" strokeWidth={1.75} strokeLinecap="round" /><line x1="18" y1="12" x2="22" y2="12" strokeWidth={1.75} strokeLinecap="round" /></svg>,
  team:      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  signout:   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
};

// ─── Shared nav items (badge added dynamically in component) ─────────────────
const BASE_NAV = [
  { href: "/dashboard",     label: "Dashboard",        icon: Icon.dashboard,   badgeKey: "" },
  { href: "/customers",     label: "Müşteriler",        icon: Icon.customers,   badgeKey: "" },
  { href: "/requests",      label: "Teklif Talepleri",  icon: Icon.requests,    badgeKey: "requests" },
  { href: "/quote-center",  label: "Teklif Merkezi",    icon: Icon.quoteCenter, badgeKey: "" },
  { href: "/policies",      label: "Poliçeler",         icon: Icon.policies,    badgeKey: "" },
  { href: "/ai-assistant",  label: "AI Asistan",        icon: Icon.ai,          badgeKey: "" },
];

const BOTTOM_ITEM: NavItem = { href: "/settings", label: "Ayarlar", icon: Icon.settings };

// ─── NavLink ─────────────────────────────────────────────────────────────────
function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <span className={active ? "text-white" : "text-slate-500"}>{item.icon}</span>
      {item.label}
      {item.badge && <span className="ml-auto">{item.badge}</span>}
      {!item.badge && active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}
    </Link>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, role, roleSource, profileError, agencyId, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  // Build nav items with live badge counts (agency-scoped via NotificationContext)
  const COMMON_ITEMS: NavItem[] = BASE_NAV.map((item) => ({
    href:  item.href,
    label: item.label,
    icon:  item.icon,
    badge: item.badgeKey === "requests" && unreadCount > 0
      ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex-shrink-0">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )
      : undefined,
  }));

  // Avatar initials
  const displayName = profile?.full_name || user?.email || "Kullanıcı";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel =
    role === "super_admin" ? "Süper Admin" : role === "agency_user" ? "Acente" : "—";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">PoliçePilot</p>
            <p className="text-slate-500 text-[10px] mt-0.5">Sigorta CRM</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {COMMON_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onClick={() => setMobileOpen(false)}
          />
        ))}

        {/* ── agency_user: Ekip Üyeleri ── */}
        {role === "agency_user" && (
          <NavLink
            item={{ href: "/team", label: "Ekip Üyeleri", icon: Icon.team }}
            active={pathname === "/team"}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── super_admin-only section ── */}
        {role === "super_admin" && (
          <>
            <div className="mt-4 mb-1">
              <div className="h-px bg-white/5 mb-3" />
              <p className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                Yönetim
              </p>
            </div>

            {/* Agencies */}
            <NavLink
              item={{
                href: "/agencies",
                label: "Acenteler",
                icon: Icon.agencies,
              }}
              active={pathname.startsWith("/agencies")}
              onClick={() => setMobileOpen(false)}
            />

            {/* Sales Leads */}
            <NavLink
              item={{
                href: "/leads",
                label: "Satış Leadleri",
                icon: Icon.leads,
                badge: (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                      pathname === "/leads"
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : "bg-violet-900/30 text-violet-500 border border-violet-800/30"
                    }`}
                  >
                    İÇ
                  </span>
                ),
              }}
              active={pathname === "/leads"}
              onClick={() => setMobileOpen(false)}
            />
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-0.5">
        <div className="h-px bg-white/5 mb-3" />
        <NavLink
          item={BOTTOM_ITEM}
          active={pathname === BOTTOM_ITEM.href}
          onClick={() => setMobileOpen(false)}
        />

        {/* ── Role debug badge ── */}
        <div className="px-3 py-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-slate-600 uppercase tracking-widest">Role</span>
            {role ? (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  role === "super_admin"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-slate-500/20 text-slate-400 border border-slate-600/30"
                }`}
              >
                {role}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                yok
              </span>
            )}
            {roleSource && (
              <span className="text-[8px] text-slate-700 italic">
                ({roleSource === "profile" ? "DB" : "JWT"})
              </span>
            )}
          </div>
          {agencyId && (
            <p className="text-[9px] text-slate-600 truncate">
              acente: {agencyId.slice(0, 8)}…
            </p>
          )}
          {profileError && (
            <p className="text-[9px] text-red-400 leading-tight break-all">
              ⚠ {profileError}
            </p>
          )}
        </div>

        {/* User row + sign-out */}
        <div
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 mt-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
          title="Çıkış Yap"
        >
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{displayName}</p>
            <p className="text-slate-500 text-[10px] truncate">{roleLabel}</p>
          </div>
          <span className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors">
            {Icon.signout}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f172a] border-b border-white/5 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">PoliçePilot</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-slate-400 p-1 rounded hover:text-white transition-colors"
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-60 z-20 bg-[#0f172a] transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-[#0f172a] min-h-screen border-r border-white/5">
        <SidebarContent />
      </aside>
    </>
  );
}
