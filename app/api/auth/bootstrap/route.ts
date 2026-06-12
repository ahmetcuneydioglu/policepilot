/**
 * POST /api/auth/bootstrap — oturum sonrası kendini onaran kurulum
 *
 * Her girişte AuthContext tarafından bir kez çağrılır (idempotent):
 *  1. agencies.phone boşsa signup metadata'sındaki agency_phone'u yazar
 *  2. agency_settings satırı yoksa varsayılanlarla oluşturur:
 *     whatsapp_enabled=true, daily_summary_enabled=true, test_mode=true,
 *     whatsapp_phone = acente telefonu (Operasyon Bildirim Numarası)
 *
 * Amaç: yeni kayıt olan acente HİÇBİR ek ayar yapmadan ertesi sabah
 * 09:00'da günlük operasyon özetini almaya başlasın. Mevcut acenteler de
 * bir sonraki girişlerinde otomatik dahil olur.
 *
 * Var olan agency_settings satırına ASLA dokunulmaz — acentenin elle
 * yaptığı değişiklikler (kapatma, numara değiştirme) korunur.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** TR numarasını E.164 benzeri biçime çevirir: 0532… → 90532… */
function normalizeTrPhone(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("90") && d.length === 12) return d;
  if (d.startsWith("0")  && d.length === 11) return `9${d}`;
  if (d.length === 10) return `90${d}`;
  return d.length >= 10 ? d : null;
}

export async function POST(request: NextRequest) {
  try {
    // ── Oturum + metadata ────────────────────────────────────────────────
    const cookieHeader = request.headers.get("cookie") ?? "";
    const session = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieHeader.split(";").map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const admin = getSupabaseAdmin();

    // ── Profil → acente ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (admin.from("profiles") as any)
      .select("agency_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const agencyId: string | null = prof?.agency_id ?? null;
    if (!agencyId) {
      // super_admin veya profili henüz oluşmamış kullanıcı — yapılacak iş yok
      return NextResponse.json({ ok: true, skipped: "no_agency" });
    }

    const metaPhone = (user.user_metadata as Record<string, string> | undefined)?.agency_phone ?? null;

    // ── 1. agencies.phone garanti ────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agency } = await (admin.from("agencies") as any)
      .select("id, phone")
      .eq("id", agencyId)
      .maybeSingle();

    let agencyPhone: string | null = agency?.phone ?? null;
    if (!agencyPhone && metaPhone) {
      agencyPhone = metaPhone;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: phoneErr } = await (admin.from("agencies") as any)
        .update({ phone: metaPhone })
        .eq("id", agencyId);
      if (phoneErr) console.error("[auth/bootstrap] agencies.phone update:", phoneErr.message);
    }

    // ── 2. agency_settings yoksa varsayılanlarla oluştur ─────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (admin.from("agency_settings") as any)
      .select("agency_id, whatsapp_phone")
      .eq("agency_id", agencyId)
      .maybeSingle();

    let settingsCreated = false;
    const operationPhone = normalizeTrPhone(agencyPhone ?? metaPhone);

    if (!settings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (admin.from("agency_settings") as any).insert({
        agency_id:             agencyId,
        whatsapp_enabled:      true,
        daily_summary_enabled: true,
        // Gönderim modu/sağlayıcı platform seviyesinde yönetilir (platform_settings)
        whatsapp_phone:        operationPhone,
      });
      if (insErr) console.error("[auth/bootstrap] agency_settings insert:", insErr.message);
      else settingsCreated = true;
    } else if (!settings.whatsapp_phone && operationPhone) {
      // Satır var ama numara boş — sadece numarayı tamamla, tercihlere dokunma
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (admin.from("agency_settings") as any)
        .update({ whatsapp_phone: operationPhone, updated_at: new Date().toISOString() })
        .eq("agency_id", agencyId);
      if (updErr) console.error("[auth/bootstrap] whatsapp_phone update:", updErr.message);
    }

    return NextResponse.json({
      ok: true,
      agency_phone_set: Boolean(agencyPhone),
      settings_created: settingsCreated,
    });
  } catch (err) {
    console.error("[auth/bootstrap]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
