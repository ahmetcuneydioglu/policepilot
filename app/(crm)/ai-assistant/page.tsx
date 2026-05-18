"use client";

import { useState } from "react";

type MessageType = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  generate: (name: string, type: string) => string;
};

const messageTypes: MessageType[] = [
  {
    id: "yenileme",
    label: "Yenileme Hatırlatma",
    description: "Poliçe bitimine yakın müşterilere",
    color: "border-blue-200 bg-blue-50 text-blue-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    generate: (name, type) =>
      `Sayın ${name || "Değerli Müşterimiz"}, ${type || "sigorta"} poliçenizin yenileme zamanı yaklaşıyor. 🛡️\n\nSizi en iyi teklif ve kapsamlı güvenceyle desteklemek için buradayız. Yenileme işleminizi hızlıca tamamlamak için bizimle iletişime geçebilirsiniz.\n\nSizi bekliyoruz. İyi günler dileriz.`,
  },
  {
    id: "teklif",
    label: "Teklif Sunumu",
    description: "Yeni teklif sunmak için",
    color: "border-indigo-200 bg-indigo-50 text-indigo-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    generate: (name, type) =>
      `Merhaba ${name || "Değerli Müşterimiz"} 👋\n\n${type || "Sigorta"} ihtiyacınız için size özel bir teklif hazırladık. Rakipsiz fiyatlarımız ve geniş teminat kapsamımızla sizi ve değerlerinizi güvence altına almak istiyoruz.\n\nDetayları görüşmek için uygun bir zaman belirleyebilir miyiz?`,
  },
  {
    id: "ikna",
    label: "Müşteri İkna Mesajı",
    description: "Karar aşamasındaki müşteriler için",
    color: "border-violet-200 bg-violet-50 text-violet-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    generate: (name, type) =>
      `Sayın ${name || "Değerli Müşterimiz"}, biliyorum doğru kararı vermek zaman alıyor. 😊\n\n${type || "Sigorta"} güvencesi, beklenmedik anlarda en büyük destekçinizdir. Bugün aldığınız bu karar, yarın sizi ve ailenizi koruyacak. \n\nÖzel fiyatımız sadece bu hafta geçerli — sizin için bir dakikanız var mı?`,
  },
  {
    id: "gecikme",
    label: "Ödeme Hatırlatma",
    description: "Geciken ödemeler için nazik uyarı",
    color: "border-amber-200 bg-amber-50 text-amber-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    generate: (name, type) =>
      `Sayın ${name || "Değerli Müşterimiz"}, ${type || "sigorta"} poliçenize ait prim ödemesinde kısa bir gecikme olduğunu fark ettik.\n\nGüvencenizin kesintisiz devam etmesi için ödemenizi en kısa sürede gerçekleştirmenizi rica ederiz. Herhangi bir sorununuz varsa yardımcı olmaktan memnuniyet duyarız. 🙏`,
  },
];

const insuranceTypes = ["Kasko", "Trafik", "Konut", "Sağlık", "Hayat", "DASK", "Ferdi Kaza"];

const exampleCards = [
  {
    type: "Yenileme Hatırlatma",
    customer: "Ahmet Bey",
    preview: "Sayın Ahmet Bey, Kasko poliçenizin yenileme zamanı yaklaşıyor. 🛡️ Sizi en iyi teklif ile...",
    color: "border-l-blue-500",
  },
  {
    type: "Müşteri İkna",
    customer: "Fatma Hanım",
    preview: "Sayın Fatma Hanım, biliyorum doğru kararı vermek zaman alıyor. 😊 Konut güvencesi...",
    color: "border-l-violet-500",
  },
  {
    type: "Teklif Sunumu",
    customer: "Mehmet Bey",
    preview: "Merhaba Mehmet Bey 👋 Sağlık sigortası ihtiyacınız için size özel bir teklif hazırladık...",
    color: "border-l-indigo-500",
  },
];

export default function AIAssistantPage() {
  const [selectedType, setSelectedType] = useState<MessageType>(messageTypes[0]);
  const [customerName, setCustomerName] = useState("");
  const [insuranceType, setInsuranceType] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setOutput("");
    await new Promise((res) => setTimeout(res, 1600));
    setOutput(selectedType.generate(customerName, insuranceType));
    setLoading(false);
    setCopied(false);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Asistan</h1>
            <p className="text-blue-300 text-xs">GPT destekli mesaj üreticisi</p>
          </div>
        </div>
        <p className="text-blue-200 text-sm mt-3 leading-relaxed">
          Müşterilerinize özel, ikna edici ve profesyonel mesajlar saniyeler içinde oluşturun. WhatsApp veya e-posta ile doğrudan gönderin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: form */}
        <div className="lg:col-span-3 space-y-4 animate-fade-in-up stagger-1">
          {/* Message type grid */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Mesaj Türü Seçin</p>
            <div className="grid grid-cols-2 gap-2">
              {messageTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t)}
                  className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                    selectedType.id === t.id
                      ? `${t.color} border-current shadow-sm`
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0">{t.icon}</span>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{t.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Müşteri Adı</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Sigorta Türü</label>
              <select
                value={insuranceType}
                onChange={(e) => setInsuranceType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-shadow"
              >
                <option value="">Sigorta türü seçin</option>
                {insuranceTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="typing-dot w-2 h-2 rounded-full bg-white inline-block" />
                    <span className="typing-dot w-2 h-2 rounded-full bg-white inline-block" />
                    <span className="typing-dot w-2 h-2 rounded-full bg-white inline-block" />
                  </div>
                  Mesaj üretiliyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Otomatik Mesaj Üret
                </>
              )}
            </button>
          </div>

          {/* Output */}
          {loading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="shimmer h-4 rounded mb-3 w-3/4" />
              <div className="shimmer h-4 rounded mb-3 w-full" />
              <div className="shimmer h-4 rounded mb-3 w-5/6" />
              <div className="shimmer h-4 rounded w-2/3" />
            </div>
          )}

          {!loading && output && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-gray-500">{selectedType.label}</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? (
                    <><svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Kopyalandı</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Kopyala</>
                  )}
                </button>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{output}</p>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(output)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp ile Gönder
              </a>
            </div>
          )}
        </div>

        {/* Right: example cards */}
        <div className="lg:col-span-2 space-y-3 animate-fade-in-up stagger-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Örnek Çıktılar</p>
          {exampleCards.map((card, i) => (
            <div
              key={i}
              className={`bg-white rounded-xl border border-l-4 ${card.color} border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">{card.type}</span>
                <span className="text-xs text-gray-400">{card.customer}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{card.preview}</p>
            </div>
          ))}

          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-4 text-white mt-4">
            <p className="text-xs font-bold mb-1">İpucu 💡</p>
            <p className="text-xs text-blue-100 leading-relaxed">
              Müşteri adı ve sigorta türü girerek daha kişisel ve etkili mesajlar oluşturabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
