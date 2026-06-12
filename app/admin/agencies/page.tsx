"use client";

/**
 * Acenteler — kurumsal data grid (TanStack Table).
 * Sıralanabilir kolonlar, arama, satıra tıklayınca yönetim paneli.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper, type SortingState,
} from "@tanstack/react-table";
import { Building2, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  PageHeader, PlanBadge, LoadingGrid, ErrorBox, fmtMoney, fmtNum, fmtDate, timeAgo,
} from "@/components/admin/ui";

type Row = {
  id: string; logo_url: string | null; name: string; slug: string; plan: string;
  is_active: boolean; users: number; customers: number; quotes: number;
  policies: number; whatsapp: number; monthly_revenue: number;
  last_activity: string | null; created_at: string; limit_usage: number;
};

const col = createColumnHelper<Row>();

export default function AdminAgenciesPage() {
  const router = useRouter();
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "monthly_revenue", desc: true }]);
  const [filter,  setFilter]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/agencies");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Acenteler yüklenemedi.");
      setRows(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Acenteler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    col.accessor("name", {
      header: "Acente",
      cell: info => {
        const r = info.row.original;
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden">
              {r.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.logo_url} alt="" className="w-full h-full object-cover" />
                : r.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{r.name}</p>
              <p className="text-[10px] text-slate-400 truncate">/{r.slug}</p>
            </div>
          </div>
        );
      },
    }),
    col.accessor("plan", { header: "Paket", cell: i => <PlanBadge plan={i.getValue()} /> }),
    col.accessor("is_active", {
      header: "Durum",
      cell: i => i.getValue()
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Aktif</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200 text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Pasif</span>,
    }),
    col.accessor("users",     { header: "Kullanıcı", cell: i => <span className="text-sm font-semibold text-slate-700">{fmtNum(i.getValue())}</span> }),
    col.accessor("customers", { header: "Müşteri",   cell: i => <span className="text-sm font-semibold text-slate-700">{fmtNum(i.getValue())}</span> }),
    col.accessor("quotes",    { header: "Teklif",    cell: i => <span className="text-sm font-semibold text-slate-700">{fmtNum(i.getValue())}</span> }),
    col.accessor("policies",  { header: "Poliçe",    cell: i => <span className="text-sm font-semibold text-slate-700">{fmtNum(i.getValue())}</span> }),
    col.accessor("whatsapp",  { header: "WhatsApp",  cell: i => <span className="text-sm font-semibold text-emerald-600">{fmtNum(i.getValue())}</span> }),
    col.accessor("monthly_revenue", {
      header: "Aylık Gelir",
      cell: i => <span className="text-sm font-bold text-indigo-700">{fmtMoney(i.getValue())}</span>,
    }),
    col.accessor("last_activity", {
      header: "Son Aktivite",
      cell: i => <span className="text-[11px] text-slate-500">{timeAgo(i.getValue())}</span>,
    }),
    col.accessor("created_at", {
      header: "Kurulum",
      cell: i => <span className="text-[11px] text-slate-400">{fmtDate(i.getValue())}</span>,
    }),
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) return <LoadingGrid rows={2} cols={4} />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Acenteler"
        subtitle={`${rows.length} acente · ${rows.filter(r => r.is_active).length} aktif`}
        Icon={Building2}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Acente ara…"
                className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 shadow-sm w-56"
              />
            </div>
            <button onClick={load} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 transition-all shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-slate-100 bg-slate-50/70">
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none whitespace-nowrap hover:text-slate-600 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" />
                          : h.column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" />
                          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-50">
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/admin/agencies/${row.original.id}`)}
                  className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.getRowModel().rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Sonuç bulunamadı</p>
        )}
      </div>
    </div>
  );
}
