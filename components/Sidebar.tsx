"use client";

/**
 * Sidebar — SigortaOS navigasyonu (Insurance Operating System).
 *
 * Tasarım ilkeleri (Monday'in UX yaklaşımından uyarlandı, kopya değil):
 *  • Tek ikon dili: lucide, 18px, 1.75 stroke — optik hizalı.
 *  • Gruplu bilgi mimarisi: Satış / Operasyon / İletişim / Yönetim (+ Süper Admin).
 *  • Gruplar açılır-kapanır, tercih localStorage'da kalıcı.
 *  • Aktif durum: sol accent çizgisi + hafif zemin (yalnız renk değişimi değil).
 *  • Hover: yumuşak zemin + 150ms geçiş. Badge: mavi, minimal (kırmızı yok).
 *  • Collapse: yalnız ikon + tooltip. Taşma yok: truncate + min-w-0 her yerde.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { isManagerial } from "@/lib/tenant";
import { useNotifications } from "@/lib/NotificationContext";
import { FEATURES } from "@/lib/features";
import {
  LayoutDashboard, Users, Filter, ShieldCheck, RefreshCw, Car,
  MessageCircle, UserCog, Bot, Settings, Building2, Radar, Gauge,
  Zap, LogOut, Search, Plus, ChevronsLeft, ChevronsRight, ChevronDown,
  UserPlus, Target, FilePlus2, ListTodo, Send, Sparkles, Menu, X,
  KanbanSquare, Landmark,
  type LucideIcon,
} from "lucide-react";

/* ─── Sabitler ──────────────────────────────────────────────────────────────── */
const ICON = "w-[18px] h-[18px]";           // tek ikon boyutu
const STROKE = 1.75;                         // tek stroke kalınlığı
const GROUPS_KEY = "sigortaos_sb_groups";    // kapalı gruplar (localStorage)

/* ─── Tooltip (collapsed mod) ───────────────────────────────────────────────── */
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

/* ─── NavItem ───────────────────────────────────────────────────────────────── */
function NavItem({
  href, label, Icon, isActive, collapsed, badge, dot, onClick,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  badge?: React.ReactNode;
  dot?: boolean;           // collapsed modda badge yerine küçük nokta
  onClick: () => void;
}) {
  const inner = (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex items-center rounded-lg transition-colors duration-150
        ${collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-2.5 px-2.5 h-9"}
        ${isActive ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
    >
      {/* Sol accent çizgisi (aktif) */}
      {isActive && (
        <span className={`absolute left-0 w-[3px] rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-500
          ${collapsed ? "h-5 top-1/2 -translate-y-1/2" : "h-4 top-1/2 -translate-y-1/2"}`} />
      )}
      <span className={`relative flex-shrink-0 ${isActive ? "text-blue-300" : ""}`}>
        <Icon className={ICON} strokeWidth={STROKE} />
        {collapsed && dot && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 ring-2 ring-[#0f172a]" />
        )}
      </span>
      {!collapsed && <span className="truncate text-[13px] font-medium min-w-0">{label}</span>}
      {!collapsed && badge && <span className="ml-auto flex-shrink-0">{badge}</span>}
    </Link>
  );
  return collapsed ? <SideTooltip label={label}>{inner}</SideTooltip> : inner;
}

/* ─── Grup başlığı (açılır-kapanır) ─────────────────────────────────────────── */
function GroupHeader({
  label, collapsed, open, onToggle,
}: { label: string; collapsed: boolean; open: boolean; onToggle: () => void }) {
  if (collapsed) return <div className="mx-2 my-2.5 h-px bg-white/[0.06]" />;
  return (
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-2.5 pt-4 pb-1.5 group/gh"
      aria-expanded={open}>
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-500 group-hover/gh:text-slate-400 transition-colors">
        {label}
      </span>
      <ChevronDown className={`w-3 h-3 text-slate-600 group-hover/gh:text-slate-400 transition-all duration-200 ${open ? "" : "-rotate-90"}`} strokeWidth={2} />
    </button>
  );
}

/* ─── Ana Sidebar ───────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const { user, profile, role, roleSource, profileError, agencyId, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  /* Tercihler (yalnız client) */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem("pp_sidebar_collapsed") === "true") setCollapsed(true);
    try {
      const g = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (g && typeof g === "object") setClosed(g);
    } catch { /* yok say */ }
  }, []);

  const toggleCollapse = () => setCollapsed((p) => {
    localStorage.setItem("pp_sidebar_collapsed", String(!p));
    return !p;
  });
  const toggleGroup = (key: string) => setClosed((p) => {
    const next = { ...p, [key]: !p[key] };
    localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    return next;
  });

  const displayName = profile?.full_name || user?.email || "Kullanıcı";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = role === "super_admin" ? "Süper Admin" : role === "agency_user" ? "Acente" : "—";
  const subLabel = profile?.full_name && user?.email ? user.email : roleLabel;

  const closeMobile = () => setMobileOpen(false);
  const openPalette = () => { closeMobile(); window.dispatchEvent(new Event("sigortaos:palette")); };
  const managerial = isManagerial(profile?.agency_role);

  /* Badge: bekleyen yeni lead — mavi, minimal (kırmızı değil) */
  const leadBadge = unreadCount > 0 ? (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold tabular-nums">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  ) : undefined;

  const quoteCenterActive = pathname === "/quote-center" || pathname.startsWith("/quote-center/") || pathname.startsWith("/policies/issue/");

  /* "+ Yeni" menü öğeleri — her operasyon tek tık */
  const NEW_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
    { href: "/customers?new=1", label: "Yeni Müşteri", Icon: UserPlus },
    { href: "/firsatlar?new=1", label: "Yeni Satış Fırsatı", Icon: Target },
    { href: "/portfoy?new=1", label: "Yeni Portföy İşi", Icon: KanbanSquare },
    { href: "/policies?new=1", label: "Yeni Poliçe", Icon: FilePlus2 },
    { href: "/dashboard?task=1", label: "Yeni Görev", Icon: ListTodo },
    { href: "/whatsapp-queue", label: "WhatsApp Gönder", Icon: Send },
    { href: "/ai-assistant", label: "AI Asistan", Icon: Sparkles },
  ];

  /* Gruplu bilgi mimarisi — yalnız var olan modüller (ölü link yok) */
  type Item = { href: string; label: string; Icon: LucideIcon; active: boolean; badge?: React.ReactNode; dot?: boolean; show?: boolean };
  const groups: { key: string; label: string; items: Item[] }[] = [
    {
      key: "satis", label: "Satış",
      items: [
        { href: "/firsatlar", label: "Satış Fırsatları", Icon: Filter, active: pathname.startsWith("/firsatlar"), badge: leadBadge, dot: unreadCount > 0 },
        { href: "/customers", label: "Müşteriler", Icon: Users, active: pathname.startsWith("/customers") },
      ],
    },
    {
      // İki Dünya: uzun satış döngüsü (Hayat/BES/kurumsal) — kısa döngü Satış'ta kalır
      key: "portfoy", label: "Portföy",
      items: [
        { href: "/portfoy", label: "Satış Hattı", Icon: KanbanSquare, active: pathname.startsWith("/portfoy") },
        { href: "/hesaplar", label: "Hesaplar", Icon: Landmark, active: pathname.startsWith("/hesaplar") },
      ],
    },
    {
      key: "operasyon", label: "Operasyon",
      items: [
        { href: "/policies", label: "Poliçeler", Icon: ShieldCheck, active: pathname.startsWith("/policies") && !pathname.startsWith("/policies/issue") },
        { href: "/renewals", label: "Yenilemeler", Icon: RefreshCw, active: pathname.startsWith("/renewals") },
        { href: "/muayene", label: "Araç Muayeneleri", Icon: Car, active: pathname.startsWith("/muayene") },
      ],
    },
    {
      key: "iletisim", label: "İletişim",
      items: [
        { href: "/whatsapp-queue", label: "WhatsApp Merkezi", Icon: MessageCircle, active: pathname.startsWith("/whatsapp-queue"), show: managerial },
      ],
    },
    {
      key: "yonetim", label: "Yönetim",
      items: [
        { href: "/team", label: "Ekip & Performans", Icon: UserCog, active: pathname.startsWith("/team"), show: managerial },
        { href: "/ai-assistant", label: "AI Asistan", Icon: Bot, active: pathname.startsWith("/ai-assistant") },
        { href: "/settings", label: "Ayarlar", Icon: Settings, active: pathname === "/settings" },
      ],
    },
  ];

  const sidebarInner = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Marka + collapse ─────────────────────────────────────────────── */}
      <div className={`flex items-center flex-shrink-0 pt-5 pb-3
        ${collapsed ? "flex-col gap-3 px-2" : "justify-between pl-4 pr-3"}`}>
        <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-[15px] leading-none tracking-tight truncate">
                Sigorta<span className="text-blue-400">OS</span>
              </p>
              <p className="text-slate-500 text-[10px] mt-1 font-medium tracking-wide truncate">Insurance Operating System</p>
            </div>
          )}
        </Link>
        <button onClick={toggleCollapse}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-colors flex-shrink-0"
          title={collapsed ? "Genişlet" : "Daralt"} aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}>
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2} />}
        </button>
      </div>

      {/* ── + Yeni (birincil aksiyon) ────────────────────────────────────── */}
      <div className={`flex-shrink-0 ${collapsed ? "px-2" : "px-3"} relative`}>
        {collapsed ? (
          <SideTooltip label="Yeni oluştur">
            <button onClick={() => setNewOpen((o) => !o)}
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/40"
              aria-label="Yeni oluştur">
              <Plus className={ICON} strokeWidth={2.25} />
            </button>
          </SideTooltip>
        ) : (
          <button onClick={() => setNewOpen((o) => !o)}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/40">
            <Plus className="w-4 h-4" strokeWidth={2.25} /> Yeni
            <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-150 ${newOpen ? "rotate-180" : ""}`} strokeWidth={2} />
          </button>
        )}
        {newOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setNewOpen(false)} />
            <div className={`absolute z-50 w-52 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-1.5
              ${collapsed ? "left-full ml-2 top-0" : "left-3 right-3 w-auto top-full mt-1.5"}`}>
              {NEW_ITEMS.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => { setNewOpen(false); closeMobile(); }}
                  className="flex items-center gap-2.5 px-3 h-9 text-[13px] font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                  <it.Icon className="w-4 h-4 text-slate-500 flex-shrink-0" strokeWidth={STROKE} />
                  <span className="truncate">{it.label}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Hızlı arama (⌘K) ─────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 ${collapsed ? "px-2" : "px-3"} mt-2 mb-1`}>
        {collapsed ? (
          <SideTooltip label="Ara — müşteri, TC, plaka, poliçe (⌘K)">
            <button onClick={openPalette}
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
              aria-label="Ara">
              <Search className={ICON} strokeWidth={STROKE} />
            </button>
          </SideTooltip>
        ) : (
          <button onClick={openPalette}
            className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-500 hover:text-slate-300 hover:bg-white/[0.07] transition-colors"
            title="Müşteri, TC, plaka, telefon, poliçe ara">
            <Search className="w-4 h-4 flex-shrink-0" strokeWidth={STROKE} />
            <span className="flex-1 text-left text-[13px] truncate">Ara…</span>
            <kbd className="text-[9px] font-bold text-slate-500 bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0.5 flex-shrink-0">⌘K</kbd>
          </button>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"} overflow-y-auto overflow-x-hidden pb-2`}>

        <div className="mt-1.5 space-y-0.5">
          <NavItem href="/dashboard" label="Dashboard" Icon={LayoutDashboard}
            isActive={pathname === "/dashboard"} collapsed={collapsed} onClick={closeMobile} />
          {/* Teklif Merkezi — spotlight. FEATURES.quoteCenter=false: demo veri +
              gerçek API yok → gizli. Aktive edilirken adı "Fiyat Çalışması" olacak. */}
          {FEATURES.quoteCenter && (collapsed ? (
            <SideTooltip label="Teklif Merkezi">
              <Link href="/quote-center" onClick={closeMobile}
                className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors duration-150
                  ${quoteCenterActive ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "bg-violet-600/10 text-violet-400 hover:bg-violet-600/25 hover:text-violet-200"}`}>
                <Zap className={ICON} strokeWidth={STROKE} />
              </Link>
            </SideTooltip>
          ) : (
            <Link href="/quote-center" onClick={closeMobile}
              className={`relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors duration-150
                ${quoteCenterActive ? "bg-violet-600/20 text-violet-100" : "text-violet-300/90 hover:bg-violet-600/10 hover:text-violet-200"}`}>
              {quoteCenterActive && <span className="absolute left-0 w-[3px] h-4 top-1/2 -translate-y-1/2 rounded-r-full bg-violet-400" />}
              <Zap className={`${ICON} flex-shrink-0 text-violet-400`} strokeWidth={STROKE} />
              <span className="truncate">Teklif Merkezi</span>
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 flex-shrink-0">BETA</span>
            </Link>
          ))}
        </div>

        {groups.map((g) => {
          const items = g.items.filter((it) => it.show !== false);
          if (items.length === 0) return null;
          const open = !closed[g.key];
          return (
            <div key={g.key}>
              <GroupHeader label={g.label} collapsed={collapsed} open={open} onToggle={() => toggleGroup(g.key)} />
              {(open || collapsed) && (
                <div className="space-y-0.5">
                  {items.map((it) => (
                    <NavItem key={it.href} href={it.href} label={it.label} Icon={it.Icon}
                      isActive={it.active} collapsed={collapsed} badge={it.badge} dot={it.dot} onClick={closeMobile} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Süper Admin */}
        {role === "super_admin" && (
          <div>
            <GroupHeader label="Süper Admin" collapsed={collapsed} open={!closed.admin} onToggle={() => toggleGroup("admin")} />
            {(!closed.admin || collapsed) && (
              <div className="space-y-0.5">
                <NavItem href="/admin" label="Command Center" Icon={Gauge}
                  isActive={pathname.startsWith("/admin")} collapsed={collapsed} onClick={closeMobile} />
                <NavItem href="/agencies" label="Acenteler" Icon={Building2}
                  isActive={pathname.startsWith("/agencies")} collapsed={collapsed} onClick={closeMobile} />
                <NavItem href="/leads" label="Satış Leadleri" Icon={Radar}
                  isActive={pathname === "/leads"} collapsed={collapsed} onClick={closeMobile}
                  badge={<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">İÇ</span>} />
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Alt: kullanıcı kartı ─────────────────────────────────────────── */}
      <div className={`${collapsed ? "px-2" : "px-3"} pb-3 pt-2 flex-shrink-0 border-t border-white/[0.06]`}>
        {/* Dev-only tanılama */}
        {process.env.NODE_ENV === "development" && !collapsed && (
          <div className="px-2.5 py-1 mb-1">
            <p className="text-[9px] text-slate-600 truncate">
              {role ?? "rol yok"}{roleSource ? ` · ${roleSource === "profile" ? "DB" : "JWT"}` : ""}{agencyId ? ` · ${agencyId.slice(0, 8)}` : ""}
            </p>
            {profileError && <p className="text-[9px] text-red-400/80 truncate">⚠ {profileError}</p>}
          </div>
        )}
        <button
          onClick={signOut}
          title="Çıkış Yap"
          className={`w-full flex items-center rounded-lg hover:bg-white/[0.04] transition-colors group/user
            ${collapsed ? "justify-center h-10" : "gap-2.5 px-2 h-11"}`}
        >
          {collapsed ? (
            <SideTooltip label={`Çıkış — ${displayName}`}>
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-bold ring-1 ring-white/10">
                {initials}
              </span>
            </SideTooltip>
          ) : (
            <>
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1 ring-white/10">
                {initials}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-slate-200 text-[12px] font-medium truncate leading-tight">{displayName}</span>
                <span className="block text-slate-500 text-[10px] truncate leading-tight mt-0.5">{subLabel}</span>
              </span>
              <LogOut className="w-4 h-4 text-slate-600 group-hover/user:text-slate-300 flex-shrink-0 transition-colors" strokeWidth={STROKE} />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobil üst bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f172a] border-b border-white/[0.06] flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Sigorta<span className="text-blue-400">OS</span></span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)}
          className="text-slate-400 p-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}>
          {mobileOpen ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
        </button>
      </div>

      {/* Mobil overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={closeMobile} />
      )}

      {/* Mobil drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-[264px] z-20 bg-[#0f172a] transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarInner}
      </aside>

      {/* Masaüstü sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col flex-shrink-0 bg-[#0f172a] min-h-screen border-r border-white/[0.06] transition-[width] duration-200 overflow-hidden"
        style={{ width: collapsed ? 68 : 248 }}
      >
        {sidebarInner}
      </aside>
    </>
  );
}
