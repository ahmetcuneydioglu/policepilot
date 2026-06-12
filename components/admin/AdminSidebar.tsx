"use client";

/**
 * PolicePilot — Executive Command Center sol menüsü (yalnız super_admin).
 * Acente CRM menüsünden tamamen bağımsız; platform yönetimi odaklı.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Building2, Wallet, TrendingUp, MessageCircle,
  Target, Bot, ServerCog, Settings, LogOut, ArrowLeftRight,
} from "lucide-react";

const NAV = [
  { href: "/admin",          label: "Operasyon Merkezi", Icon: LayoutDashboard, exact: true },
  { href: "/admin/agencies", label: "Acenteler",          Icon: Building2 },
  { href: "/admin/revenue",  label: "Gelir Merkezi",      Icon: Wallet },
  { href: "/admin/analytics",label: "Analitik",           Icon: TrendingUp },
  { href: "/admin/whatsapp", label: "WhatsApp Merkezi",   Icon: MessageCircle },
  { href: "/admin/leads",    label: "Satış Merkezi",      Icon: Target },
  { href: "/admin/ai",       label: "AI Merkezi",         Icon: Bot },
  { href: "/admin/system",   label: "Sistem Merkezi",     Icon: ServerCog },
  { href: "/admin/settings", label: "Platform Ayarları",  Icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-[#0a0f1e] border-r border-white/5">

      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <span className="text-white font-black text-sm">P</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">PolicePilot</p>
          <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Command Center</p>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/5 mb-2" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-1">
        {NAV.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 ${
                active
                  ? "bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-900/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Alt blok */}
      <div className="flex-shrink-0 px-3 pb-4 space-y-1">
        <div className="mx-1 h-px bg-white/5 mb-2" />
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          title="Acente CRM görünümüne geç"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> CRM Görünümü
        </Link>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {(profile?.full_name ?? "SA").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{profile?.full_name ?? "Super Admin"}</p>
              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Platform Sahibi</p>
            </div>
          </div>
          <button onClick={signOut} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all" title="Çıkış">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
