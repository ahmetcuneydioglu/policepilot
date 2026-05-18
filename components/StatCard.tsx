type StatCardProps = {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: "blue" | "indigo" | "emerald" | "amber";
};

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
};

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
