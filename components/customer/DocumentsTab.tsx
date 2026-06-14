"use client";

/**
 * Evraklar Merkezi — müşterinin tüm dokümanları.
 * Her evrak için: Görüntüle (imzalı URL), İndir, WhatsApp Gönder
 * (60 dk geçerli bağlantı müşterinin numarasına mesaj olarak hazırlanır).
 */

import { useState } from "react";
import { FolderOpen, FileText, Eye, Download } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import type { CustomerDocument } from "./types";
import { fmtDateTime, waPhone } from "./types";

const WA_ICON = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function typeEmoji(mime: string | null, name: string): string {
  const n = name.toLocaleLowerCase("tr-TR");
  if (n.includes("ruhsat")) return "🚗";
  if (n.includes("kimlik")) return "🪪";
  if (n.includes("tapu"))   return "🏠";
  if (n.includes("adres"))  return "📍";
  if (mime === "application/pdf") return "📄";
  if (mime?.startsWith("image/")) return "🖼️";
  return "📎";
}

export default function DocumentsTab({
  documents,
  customerPhone,
  customerName,
}: {
  documents: CustomerDocument[];
  customerPhone: string | null;
  customerName: string;
}) {
  const { can } = useAuth();
  const [busy,  setBusy]  = useState<string | null>(null);
  const [error, setError] = useState("");

  async function signedUrl(doc: CustomerDocument, download: boolean): Promise<string> {
    const res  = await fetch(`/api/policy-documents?document_id=${doc.id}${download ? "&download=1" : ""}`);
    const json = await res.json();
    if (!res.ok || !json.url) throw new Error(json.error ?? "Dosya bağlantısı alınamadı.");
    return json.url as string;
  }

  async function act(doc: CustomerDocument, action: "view" | "download" | "whatsapp") {
    setBusy(`${doc.id}:${action}`);
    setError("");
    try {
      if (action === "view") {
        window.open(await signedUrl(doc, false), "_blank");
      } else if (action === "download") {
        window.open(await signedUrl(doc, true), "_blank");
      } else {
        if (!customerPhone) throw new Error("Müşterinin telefon numarası kayıtlı değil.");
        const url = await signedUrl(doc, false);
        const msg =
          `Merhaba ${customerName},\n\n` +
          `"${doc.file_name}" belgenize aşağıdaki bağlantıdan ulaşabilirsiniz ` +
          `(bağlantı 1 saat geçerlidir):\n\n${url}`;
        window.open(`https://wa.me/${waPhone(customerPhone)}?text=${encodeURIComponent(msg)}`, "_blank");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız.");
    } finally {
      setBusy(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">Bu müşteriye ait evrak bulunmuyor</p>
        <p className="text-xs text-slate-300 mt-1">OCR ile yüklenen poliçeler burada listelenir</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠️ {error}</p>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-50 overflow-hidden">
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap hover:bg-blue-50/20 transition-colors">
            <span className="text-xl flex-shrink-0">{typeEmoji(doc.file_type, doc.file_name)}</span>
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
              <p className="text-[11px] text-slate-400">
                {fmtDateTime(doc.created_at)} · {sizeLabel(doc.file_size)}
                {doc.policy_id && " · Poliçeye bağlı"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => act(doc, "view")}
                disabled={busy === `${doc.id}:view`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 text-[11px] font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <Eye className="w-3 h-3" /> Görüntüle
              </button>
              <button
                onClick={() => act(doc, "download")}
                disabled={busy === `${doc.id}:download`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200 text-[11px] font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <Download className="w-3 h-3" /> İndir
              </button>
              {can("whatsapp.send") && (
                <button
                  onClick={() => act(doc, "whatsapp")}
                  disabled={busy === `${doc.id}:whatsapp` || !customerPhone}
                  title={customerPhone ? "Belgeyi WhatsApp ile gönder" : "Telefon numarası kayıtlı değil"}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-colors disabled:opacity-40"
                >
                  {WA_ICON} WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
        <FileText className="w-3 h-3" /> Bağlantılar 60 dakika geçerlidir; WhatsApp gönderiminde belge linki mesaja eklenir.
      </p>
    </div>
  );
}
