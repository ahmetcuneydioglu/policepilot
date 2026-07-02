/**
 * GET /api/search?q= — alan-farkında global arama (⌘K paleti).
 *
 * Girdinin ŞEKLİNDEN niyeti anlar: 11 hane → TC, 0/+90'lı 10-11 hane → telefon,
 * "34 ABC 123" deseni → plaka, harf+rakam karışık → poliçe no, düz metin → isim.
 * Niyet yalnız SIRALAMAYI önceliklendirir; her tür yine de aranır (yanlış tahmin
 * sonuç kaçırmasın). Scope: yönetici acente geneli; diğerleri kendi kayıtları.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveCaller } from "../whatsapp/_lib/auth";
import { isManagerial } from "@/lib/tenant";

type Intent = "tc" | "phone" | "plate" | "policy_no" | "name";

function detectIntent(q: string): Intent {
  const digits = q.replace(/\D/g, "");
  if (/^\d{11}$/.test(digits) && !digits.startsWith("0")) return "tc";
  if ((digits.length === 10 || digits.length === 11 || digits.length === 12) &&
      (q.startsWith("0") || q.startsWith("+") || digits.startsWith("90") || digits.startsWith("5"))) return "phone";
  if (/^\d{1,2}\s?[a-zçğıöşü]{1,3}\s?\d{2,5}$/i.test(q.trim())) return "plate";
  if (/\d/.test(q) && /[a-zçğıöşü]/i.test(q)) return "policy_no";
  if (/^\d{4,}$/.test(digits)) return "policy_no"; // uzun düz sayı → poliçe no olabilir
  return "name";
}

const esc = (s: string) => s.replace(/[%,()]/g, " ").trim();

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const raw = new URL(request.url).searchParams.get("q") ?? "";
    const q = esc(raw);
    if (q.length < 2) return NextResponse.json({ intent: "name", customers: [], policies: [], opportunities: [] });

    const agencyId = caller.agencyId;
    if (!agencyId && caller.role !== "super_admin") {
      return NextResponse.json({ intent: "name", customers: [], policies: [], opportunities: [] });
    }

    const admin = getSupabaseAdmin();
    const managerial = caller.role === "super_admin" || isManagerial(caller.agencyRole);
    const intent = detectIntent(q);
    const digits = q.replace(/\D/g, "");
    const like = `%${q}%`;

    // ── Müşteriler: isim + telefon + TC + not (plaka çoğu zaman notta) ────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let custQ = (admin.from("customers") as any)
      .select("id, name, phone, identity_no, insurance_type")
      .or([
        `name.ilike.${like}`,
        digits.length >= 7 ? `phone.ilike.%${digits}%` : null,
        digits.length >= 5 ? `identity_no.ilike.%${digits}%` : null,
        `note.ilike.${like}`,
      ].filter(Boolean).join(","))
      .limit(8);
    if (agencyId) custQ = custQ.eq("agency_id", agencyId);
    if (!managerial) custQ = custQ.eq("created_by", caller.userId);

    // ── Poliçeler: poliçe no + şirket + not (plaka) — müşteri adıyla ──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let polQ = (admin.from("policies") as any)
      .select("id, policy_no, policy_type, status, end_date, customer_id, customers(name)")
      .or(`policy_no.ilike.${like},insurance_company.ilike.${like},note.ilike.${like}`)
      .limit(8);
    if (agencyId) polQ = polQ.eq("agency_id", agencyId);
    if (!managerial) polQ = polQ.eq("created_by", caller.userId);

    // ── Fırsatlar: müşteri adı üzerinden ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let oppQ = (admin.from("requests") as any)
      .select("id, request_type, status, customer_id, customers!inner(name)")
      .ilike("customers.name", like)
      .limit(6);
    if (agencyId) oppQ = oppQ.eq("agency_id", agencyId);
    if (!managerial) oppQ = oppQ.eq("assigned_to", caller.userId);

    const [c, p, o] = await Promise.all([custQ, polQ, oppQ]);

    return NextResponse.json({
      intent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customers: (c.data ?? []).map((r: any) => ({ id: r.id, name: r.name, phone: r.phone, identity_no: r.identity_no, insurance_type: r.insurance_type })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      policies: (p.data ?? []).map((r: any) => ({ id: r.id, policy_no: r.policy_no, policy_type: r.policy_type, status: r.status, end_date: r.end_date, customer_id: r.customer_id, customer_name: r.customers?.name ?? null })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opportunities: (o.data ?? []).map((r: any) => ({ id: r.id, request_type: r.request_type, status: r.status, customer_id: r.customer_id, customer_name: r.customers?.name ?? null })),
    });
  } catch (err) {
    console.error("[api/search]", err);
    return NextResponse.json({ error: "Arama başarısız." }, { status: 500 });
  }
}
