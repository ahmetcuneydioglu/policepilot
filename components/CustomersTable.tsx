"use client";

import { useState } from "react";
import type { Customer } from "@/lib/database.types";
import CustomerModal from "@/components/CustomerModal";
import WhatsAppModal from "@/components/WhatsAppModal";

const WA_SVG = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Toast shown after WhatsApp modal is opened
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-fade-in-up"
      onAnimationEnd={() => setTimeout(onDone, 2500)}
    >
      <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white text-xs">✓</span>
      {message}
    </div>
  );
}

export default function CustomersTable({ customers }: { customers: Customer[] }) {
  const [selected, setSelected] = useState<Customer | null>(null);
  const [waCustomer, setWaCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.insurance_type.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  function handleWaSent() {
    setToast("WhatsApp mesajı hazırlandı");
  }

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-center">
        <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-500">Henüz müşteri yok</p>
        <p className="text-xs text-gray-400 mt-1">İlk müşteriyi eklemek için butona tıklayın</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Müşteri ara..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        <span className="text-sm text-gray-400">{filtered.length} müşteri</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sigorta Türü</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kayıt</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((customer, i) => (
                <tr
                  key={customer.id}
                  onClick={() => setSelected(customer)}
                  className="hover:bg-blue-50/40 transition-colors group cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                        {customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{customer.name}</p>
                        {customer.note && (
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{customer.note}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{customer.phone}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 font-medium">{customer.insurance_type}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(customer.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setWaCustomer(customer); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-100"
                      >
                        {WA_SVG}
                        WhatsApp
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(customer); }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Detay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <CustomerModal customer={selected} onClose={() => setSelected(null)} />}

      {waCustomer && (
        <WhatsAppModal
          customerName={waCustomer.name}
          phone={waCustomer.phone}
          insuranceType={waCustomer.insurance_type}
          onClose={() => setWaCustomer(null)}
          onSent={handleWaSent}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </>
  );
}
