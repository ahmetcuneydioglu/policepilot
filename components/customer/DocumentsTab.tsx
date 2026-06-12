"use client";

import { useState } from "react";
import { FolderOpen, FileText, ExternalLink } from "lucide-react";
import type { CustomerDocument } from "./types";
import { fmtDateTime } from "./types";

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function typeEmoji(mime: string | null): string {
  if (mime === "application/pdf") return "📄";
  if (mime?.startsWith("image/")) return "🖼️";
  return "📎";
}

export default function DocumentsTab({ documents }: { documents: CustomerDocument[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  async function openDocument(doc: CustomerDocument) {
    setOpening(doc.id);
    setError("");
    try {
      const res  = await fetch(`/api/policy-documents?document_id=${doc.id}`);
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Dosya açılamadı.");
      window.open(json.url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya açılamadı.");
    } finally {
      setOpening(null);
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
          <button
            key={doc.id}
            onClick={() => openDocument(doc)}
            disabled={opening === doc.id}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-blue-50/30 transition-colors disabled:opacity-60"
          >
            <span className="text-xl flex-shrink-0">{typeEmoji(doc.file_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
              <p className="text-[11px] text-slate-400">
                {fmtDateTime(doc.created_at)} · {sizeLabel(doc.file_size)}
                {doc.policy_id && " · Poliçeye bağlı"}
              </p>
            </div>
            {opening === doc.id ? (
              <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
            ) : (
              <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
        <FileText className="w-3 h-3" /> Dosyalar 60 dakika geçerli imzalı bağlantıyla açılır.
      </p>
    </div>
  );
}
