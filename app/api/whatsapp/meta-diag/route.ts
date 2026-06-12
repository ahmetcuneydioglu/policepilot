/**
 * GET /api/whatsapp/meta-diag — Meta Cloud API yapılandırma tanısı
 *
 * Token'ı ifşa etmeden, sunucudaki yapılandırmayla üç kontrol yapar:
 *   1. token  → GET /me               (token geçerli mi, hangi kimlik?)
 *   2. phone  → GET /{phone_number_id} (ID token'ın app'ine ait mi?)
 *   3. ?send=1 → hello_world ŞABLONU gönderir (24 saat penceresi gerektirmez;
 *      serbest metin başarısızken şablon çalışıyorsa sorun oturum penceresidir)
 *
 * Yalnız giriş yapmış kullanıcı çağırabilir. Tarayıcıdan açılabilir.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAgencySettings } from "@/services/whatsapp/queueService";
import { resolveCaller } from "../_lib/auth";

const V = "v21.0";

async function graph(path: string, token: string, init?: RequestInit) {
  try {
    const res  = await fetch(`https://graph.facebook.com/${V}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = await res.json();
    return { http: res.status, ok: res.ok, body: json };
  } catch (err) {
    return { http: 0, ok: false, body: { error: String(err) } };
  }
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) return NextResponse.json({ error: "Oturum açılmamış." }, { status: 401 });

    const settings = caller.agencyId ? await getAgencySettings(caller.agencyId) : null;

    const token   = settings?.whatsapp_api_key  || process.env.META_ACCESS_TOKEN    || null;
    const phoneId = settings?.whatsapp_sender_id || process.env.META_PHONE_NUMBER_ID || null;
    const tokenSource = settings?.whatsapp_api_key ? "agency_settings" : process.env.META_ACCESS_TOKEN ? "env" : "yok";
    const phoneSource = settings?.whatsapp_sender_id ? "agency_settings" : process.env.META_PHONE_NUMBER_ID ? "env" : "yok";

    if (!token || !phoneId) {
      return NextResponse.json({
        error: "Yapılandırma eksik.",
        token_source: tokenSource,
        phone_id_source: phoneSource,
      }, { status: 400 });
    }

    // 1. Token kontrolü
    const me = await graph("me", token);

    // 2. Phone Number ID kontrolü
    const phone = await graph(
      `${phoneId}?fields=display_phone_number,verified_name,quality_rating`,
      token
    );

    // 3. Opsiyonel: hello_world şablonu gönder (?send=1)
    const { searchParams } = new URL(request.url);
    let templateSend: unknown = "atlandı (?send=1 ile dene)";
    if (searchParams.get("send") === "1") {
      const to = (searchParams.get("to") || settings?.whatsapp_phone || "").replace(/\D/g, "");
      if (!to) {
        templateSend = { error: "Alıcı yok — ayarlardaki whatsapp_phone boş, ?to=90... ekleyin" };
      } else {
        templateSend = await graph(`${phoneId}/messages`, token, {
          method: "POST",
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: { name: "hello_world", language: { code: "en_US" } },
          }),
        });
      }
    }

    return NextResponse.json({
      config: {
        token_source:    tokenSource,
        token_preview:   `${token.slice(0, 6)}…${token.slice(-4)} (${token.length} kr)`,
        phone_number_id: phoneId,
        phone_id_source: phoneSource,
      },
      token_check:    me,
      phone_check:    phone,
      template_send:  templateSend,
      yorum: !me.ok
        ? "Token geçersiz/dolmuş — Vercel'deki META_ACCESS_TOKEN'ı yenileyin."
        : !phone.ok
          ? "Token geçerli ama Phone Number ID bu token'ın app'ine ait değil — ID'yi veya app'i kontrol edin."
          : "Token ve Phone Number ID uyumlu. Serbest metin hâlâ başarısızsa ?send=1 ile şablon deneyin (24 saat penceresi sorunu).",
    });
  } catch (err) {
    console.error("[api/whatsapp/meta-diag]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
