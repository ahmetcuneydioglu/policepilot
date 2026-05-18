type Status = "Aktif" | "Pasif" | "Beklemede" | "Yeni" | "İşlemde" | "Tamamlandı" | "İptal";

const styles: Record<Status, string> = {
  Aktif: "bg-emerald-100 text-emerald-700",
  Pasif: "bg-gray-100 text-gray-600",
  Beklemede: "bg-amber-100 text-amber-700",
  Yeni: "bg-blue-100 text-blue-700",
  İşlemde: "bg-indigo-100 text-indigo-700",
  Tamamlandı: "bg-emerald-100 text-emerald-700",
  İptal: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
