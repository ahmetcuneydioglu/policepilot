"use client";

const weeklyChart = [
  { day: "Pzt", calls: 5, quotes: 3 },
  { day: "Sal", calls: 8, quotes: 5 },
  { day: "Çar", calls: 6, quotes: 4 },
  { day: "Per", calls: 11, quotes: 7 },
  { day: "Cum", calls: 9, quotes: 6 },
  { day: "Cmt", calls: 3, quotes: 2 },
  { day: "Paz", calls: 4, quotes: 3 },
];

export default function WeeklyChart() {
  const maxCalls = Math.max(...weeklyChart.map((d) => d.calls));
  const chartH = 80;
  const barW = 28;
  const gap = 12;
  const totalW = weeklyChart.length * (barW + gap) - gap;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Bu Hafta Aktivite</h3>
          <p className="text-xs text-gray-400 mt-0.5">Arama & teklif sayısı</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
            Arama
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-300 inline-block" />
            Teklif
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${totalW} ${chartH + 24}`} className="w-full" style={{ height: chartH + 28 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#c7d2fe" />
          </linearGradient>
        </defs>
        {weeklyChart.map((d, i) => {
          const x = i * (barW + gap);
          const callH = (d.calls / maxCalls) * chartH;
          const quoteH = (d.quotes / maxCalls) * chartH;
          return (
            <g key={d.day}>
              <rect x={x} y={chartH - callH} width={barW} height={callH} rx={5} fill="url(#barGrad)" opacity={0.9} />
              <rect x={x + 4} y={chartH - quoteH} width={barW - 8} height={quoteH} rx={3} fill="url(#barGrad2)" opacity={0.7} />
              <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="system-ui">
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
