"use client";

/**
 * Skeleton — yüklenme iskeleti standardı (spinner yerine).
 * ListSkeleton: KPI şeridi + satırlar (liste sayfalarının ortak yüklenme hali).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded-2xl animate-pulse ${className}`} />;
}

export function ListSkeleton({ kpis = 0, rows = 6 }: { kpis?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      {kpis > 0 && (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(kpis, 7)}, minmax(0,1fr))` }}>
          {Array.from({ length: kpis }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3 rounded-md" />
              <Skeleton className="h-2.5 w-1/5 rounded-md" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
