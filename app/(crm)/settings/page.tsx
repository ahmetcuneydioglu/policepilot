export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
        <p className="text-gray-500 mt-0.5 text-sm">Hesap ve uygulama tercihlerinizi yönetin</p>
      </div>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up stagger-1">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Profil Bilgileri</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg">
              AC
            </div>
            <div>
              <p className="font-semibold text-slate-800">Acente Admin</p>
              <p className="text-sm text-gray-500">canahmettt@gmail.com</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Ad Soyad", value: "Acente Admin" },
              { label: "E-posta", value: "canahmettt@gmail.com" },
              { label: "Telefon", value: "0532 000 00 00" },
              { label: "Şirket", value: "PoliçePilot Acente" },
            ].map(({ label, value }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  defaultValue={value}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ))}
          </div>
          <div className="pt-2">
            <button className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Kaydet
            </button>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Bildirimler</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: "Poliçe yenileme hatırlatmaları", desc: "Bitiş tarihi yaklaşan poliçeler için uyarı al", on: true },
            { label: "Yeni teklif talepleri", desc: "Yeni bir teklif talebi geldiğinde bildirim al", on: true },
            { label: "WhatsApp mesaj bildirimleri", desc: "Müşteri mesaj gönderdiğinde bildirim al", on: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <button
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${item.on ? "bg-blue-600" : "bg-gray-200"}`}
                style={{ height: 22, width: 40 }}
              >
                <span
                  className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform ${item.on ? "translate-x-5" : "translate-x-0.5"}`}
                  style={{ width: 18, height: 18, top: 2, transform: item.on ? "translateX(20px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up stagger-3">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-800">Plan & Abonelik</h2>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800">Pro Plan</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Aktif</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Sınırsız müşteri · AI Asistan · Öncelikli destek</p>
          </div>
          <button className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            Planı Yönet
          </button>
        </div>
      </section>
    </div>
  );
}
