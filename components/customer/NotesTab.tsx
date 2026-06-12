"use client";

import { useState } from "react";
import { StickyNote, CheckCircle2 } from "lucide-react";

export default function NotesTab({
  customerId,
  initialNote,
  onSaved,
}: {
  customerId: string;
  initialNote: string | null;
  onSaved: (note: string) => void;
}) {
  const [note,   setNote]   = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res  = await fetch(`/api/customers/${customerId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Not kaydedilemedi.");
      setSaved(true);
      onSaved(note);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <StickyNote className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">CRM Notları</p>
          <p className="text-[11px] text-slate-400">Müşteriyle ilgili özel notlar — yalnız acente içinde görünür</p>
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        rows={8}
        placeholder="Müşteri tercihler, görüşme notları, hatırlatmalar…"
        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50/50 resize-none leading-relaxed"
      />

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : saved ? <><CheckCircle2 className="w-4 h-4" /> Kaydedildi</> : "Notu Kaydet"}
        </button>
      </div>
    </div>
  );
}
