"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  dashboard:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  customers:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  requests:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  policies:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  renewals:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  ai:          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  settings:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  agencies:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  leads:       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.75}/><circle cx="12" cy="12" r="6" strokeWidth={1.75}/><circle cx="12" cy="12" r="2" strokeWidth={1.75}/></svg>,
  team:        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  whatsapp:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  signout:     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  quoteCenter: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  collapseL:   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>,
  expandR:     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
};

// ─── Tooltip (for icon-only collapsed mode) ───────────────────────────────────
function SideTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip flex items-center justify-center">
      {children}
      <div className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap
        bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl
        opacity-0 translate-x-1 group-hover/tip:opacity-100 group-hover/tip:translate-x-0
        transition-all duration-150 border border-white/10">
        {label}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
      </div>
    </div>
  );
}

// ─── NavLink (hoisted outside Sidebar to avoid component-during-render error) ─
interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  collapsed: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}

function NavLink({ href, label, icon, isActive, collapsed, badge, onClick }: NavLinkProps) {
  const inner = (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150
        ${collapsed ? "justify-center w-10 h-10 mx-auto p-0" : "px-3 py-2.5"}
        ${isActive
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }
      `}
    >
      <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-500"}`}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge && <span className="ml-auto flex-shrink-0">{badge}</span>}
      {!collapsed && !badge && isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}
    </Link>
  );
  if (collapsed) return <SideTooltip label={label}>{inner}</SideTooltip>;
  return inner;
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);

  const { user, profile, role, roleSource, profileError, agencyId, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  // Persist collapse preference (client-side only — localStorage unavailable on SSR)
  useEffect(() => {
    const saved = localStorage.getItem("pp_sidebar_collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("pp_sidebar_collapsed", String(next));
      return next;
    });
  }

  const displayName = profile?.full_name || user?.email || "Kullanıcı";
  const initials    = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel   = role === "super_admin" ? "Süper Admin" : role === "agency_user" ? "Acente" : "—";

  const closeMobile = () => setMobileOpen(false);

  const quoteCenterActive = pathname === "/quote-center" || pathname.startsWith("/quote-center/")
    || pathname.startsWith("/policies/issue/");

  // Badge for requests
  const requestsBadge = unreadCount > 0 ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-extrabold">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  ) : undefined;

  // ── Teklif Merkezi special button ─────────────────────────────────────────
  const quoteCenterBtn = collapsed ? (
    <SideTooltip label="Teklif Merkezi ⚡">
      <Link
        href="/quote-center"
        onClick={closeMobile}
        className={`flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-150
          ${quoteCenterActive
            ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
            : "bg-violet-600/15 text-violet-400 border border-violet-500/20 hover:bg-violet-600/30 hover:text-white"
          }`}
      >
        {Icon.quoteCenter}
      </Link>
    </SideTooltip>
  ) : (
    <Link
      href="/quote-center"
      onClick={closeMobile}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all duration-150 w-full
        ${quoteCenterActive
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
          : "bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-violet-300 border border-violet-500/20 hover:from-violet-600/25 hover:to-indigo-600/20 hover:text-white hover:shadow-md"
        }`}
    >
      <span className={quoteCenterActive ? "text-white" : "text-violet-400"}>{Icon.quoteCenter}</span>
      <span>Teklif Merkezi</span>
      <span className="ml-auto text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-violet-500/30 text-violet-200 border border-violet-400/30">
        ⚡
      </span>
    </Link>
  );

  // ── Inner sidebar JSX (not a sub-component, to avoid hooks rules violation) ─
  const sidebarInner = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo + collapse toggle */}
      <div className={`flex items-center pt-5 pb-4 flex-shrink-0
        ${collapsed ? "flex-col gap-3 px-2" : "justify-between px-4"}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="text-white font-bold text-sm leading-none">PoliçePilot</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Sigorta CRM</p>
            </div>
          )}
        </div>
        {/* Desktop collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all flex-shrink-0"
          title={collapsed ? "Genişlet" : "Daralt"}
        >
          {collapsed ? Icon.expandR : Icon.collapseL}
        </button>
      </div>

      {/* Teklif Merkezi — special spotlight item */}
      <div className={`flex-shrink-0 ${collapsed ? "px-2" : "px-3"} mb-1`}>
        {quoteCenterBtn}
      </div>
      <div className={`flex-shrink-0 ${collapsed ? "mx-2" : "mx-3"} h-px bg-white/5 mb-1`} />

      {/* Main nav */}
      <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"} space-y-0.5 overflow-y-auto py-1`}>
        <NavLink href="/dashboard"    label="Dashboard"        icon={Icon.dashboard}  isActive={pathname === "/dashboard"} collapsed={collapsed} onClick={closeMobile} />
        <NavLink href="/customers"    label="Müşteriler"       icon={Icon.customers}  isActive={pathname.startsWith("/customers")} collapsed={collapsed} onClick={closeMobile} />
        <NavLink href="/requests"     label="Teklif Talepleri" icon={Icon.requests}   isActive={pathname.startsWith("/requests")} collapsed={collapsed} badge={requestsBadge} onClick={closeMobile} />
        <NavLink href="/policies"     label="Poliçeler"        icon={Icon.policies}   isActive={pathname.startsWith("/policies") && !pathname.startsWith("/policies/issue")} collapsed={collapsed} onClick={closeMobile} />
        <NavLink href="/renewals"     label="Yenilemeler"      icon={Icon.renewals}   isActive={pathname.startsWith("/renewals")} collapsed={collapsed} onClick={closeMobile} />
        <NavLink href="/ai-assistant" label="AI Asistan"       icon={Icon.ai}         isActive={pathname.startsWith("/ai-assistant")} collapsed={collapsed} onClick={closeMobile} />
        <NavLink href="/whatsapp-queue" label="WhatsApp Kuyruğu" icon={Icon.whatsapp} isActive={pathname.startsWith("/whatsapp-queue")} collapsed={collapsed} onClick={closeMobile} />

        {role === "agency_user" && (
          <NavLink href="/team" label="Ekip Üyeleri" icon={Icon.team}
            isActive={pathname === "/team"} collapsed={collapsed} onClick={closeMobile} />
        )}

        {role === "super_admin" && (
          <>
            <div className="pt-3 pb-1">
              <div className="h-px bg-white/5 mb-2" />
              {!collapsed && (
                <p className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest">Yönetim</p>
              )}
            </div>
            <NavLink href="/admin" label="⚡ Command Center" icon={Icon.dashboard}
              isActive={false} collapsed={collapsed} onClick={closeMobile} />
            <div>
            </div>
            <NavLink href="/agencies" label="Acenteler" icon={Icon.agencies}
              isActive={pathname.startsWith("/agencies")} collapsed={collapsed} onClick={closeMobile} />
            <NavLink href="/leads" label="Satış Leadleri" icon={Icon.leads}
              isActive={pathname === "/leads"} collapsed={collapsed} onClick={closeMobile}
              badge={!collapsed ? (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold
                  ${pathname === "/leads"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-violet-900/30 text-violet-500 border border-violet-800/30"}`}>İÇ</span>
              ) : undefined}
            />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className={`${collapsed ? "px-2" : "px-3"} pb-4 space-y-0.5 flex-shrink-0`}>
        <div className="h-px bg-white/5 mb-2" />
        <NavLink href="/settings" label="Ayarlar" icon={Icon.settings}
          isActive={pathname === "/settings"} collapsed={collapsed} onClick={closeMobile} />

        {/* Role debug */}
        {!collapsed && (
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-slate-600 uppercase tracking-widest">Role</span>
              {role ? (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  role === "super_admin"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-slate-500/20 text-slate-400 border border-slate-600/30"
                }`}>{role}</span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">yok</span>
              )}
              {roleSource && <span className="text-[8px] text-slate-700 italic">({roleSource === "profile" ? "DB" : "JWT"})</span>}
            </div>
            {agencyId && <p className="text-[9px] text-slate-600 truncate mt-0.5">acente: {agencyId.slice(0, 8)}…</p>}
            {profileError && <p className="text-[9px] text-red-400 leading-tight break-all mt-0.5">⚠ {profileError}</p>}
          </div>
        )}

        {/* User / sign-out */}
        <div
          onClick={signOut}
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-3"} py-2 mt-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group`}
          title="Çıkış Yap"
        >
          {collapsed ? (
            <SideTooltip label={`Çıkış — ${displayName}`}>
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold">
                {initials}
              </div>
            </SideTooltip>
          ) : (
            <>
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-medium truncate">{displayName}</p>
                <p className="text-slate-500 text-[10px] truncate">{roleLabel}</p>
              </div>
              <span className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors">{Icon.signout}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f172a] border-b border-white/5 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm">PoliçePilot</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400 p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors">
          {mobileOpen
            ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          }
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={closeMobile} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 z-20 bg-[#0f172a] transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarInner}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 bg-[#0f172a] min-h-screen border-r border-white/5 transition-all duration-200 overflow-hidden"
        style={{ width: collapsed ? 68 : 240 }}
      >
        {sidebarInner}
      </aside>
    </>
  );
}
