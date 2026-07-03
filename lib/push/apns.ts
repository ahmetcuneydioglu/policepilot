import "server-only";

/**
 * APNs istemcisi — Apple Push Notification service'e DOĞRUDAN gönderim.
 * Üçüncü parti servis yok: ES256 JWT (node:crypto) + HTTP/2 (node:http2).
 *
 * ENV (Vercel): APNS_KEY_P8 (p8 içeriği, çok satırlı ya da \n kaçışlı),
 *               APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (ops., varsayılan bundle).
 *
 * Not: dev (Xcode) build'leri sandbox APNs'e, TestFlight/App Store production'a
 * kayıtlıdır. Önce production denenir; BadDeviceToken gelirse sandbox'a düşülür.
 */

import crypto from "node:crypto";
import http2 from "node:http2";

const BUNDLE_ID = process.env.APNS_BUNDLE_ID ?? "com.canahmettt.policepilot";
const HOST_PROD = "https://api.push.apple.com";
const HOST_SANDBOX = "https://api.sandbox.push.apple.com";

export type PushResult = {
  ok: boolean;
  status: number;
  /** APNs reason (ör. BadDeviceToken, Unregistered) — token temizliği için */
  reason?: string;
  /** true ise token ölü: push_tokens'tan silinmeli */
  gone?: boolean;
};

// ── ES256 JWT (20-60 dk geçerli olmalı; 50 dk cache'leriz) ────────────────────
let jwtCache: { token: string; iat: number } | null = null;

function apnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && now - jwtCache.iat < 50 * 60) return jwtCache.token;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const p8raw = process.env.APNS_KEY_P8;
  if (!keyId || !teamId || !p8raw) {
    throw new Error("APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY_P8 env eksik");
  }
  const p8 = p8raw.includes("BEGIN") ? p8raw.replace(/\\n/g, "\n") : Buffer.from(p8raw, "base64").toString("utf8");

  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${b64url({ alg: "ES256", kid: keyId })}.${b64url({ iss: teamId, iat: now })}`;
  const signature = crypto
    .sign("sha256", Buffer.from(unsigned), {
      key: crypto.createPrivateKey(p8),
      dsaEncoding: "ieee-p1363", // JWT (JOSE) imza formatı — DER değil
    })
    .toString("base64url");

  const token = `${unsigned}.${signature}`;
  jwtCache = { token, iat: now };
  return token;
}

// ── Tek HTTP/2 isteği ─────────────────────────────────────────────────────────
function h2Post(host: string, path: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const client = http2.connect(host);
    client.on("error", reject);
    const req = client.request({
      ":method": "POST",
      ":path": path,
      "content-type": "application/json",
      ...headers,
    });
    let data = "";
    let status = 0;
    req.on("response", (h) => { status = Number(h[":status"] ?? 0); });
    req.on("data", (c) => { data += c; });
    req.on("end", () => { client.close(); resolve({ status, body: data }); });
    req.on("error", (e) => { client.close(); reject(e); });
    req.setTimeout(10_000, () => { req.close(); client.close(); reject(new Error("APNs timeout")); });
    req.end(body);
  });
}

export type PushMessage = {
  title: string;
  body: string;
  badge?: number;
  data?: Record<string, string>;
};

/** Tek cihaza push. Prod → BadDeviceToken ise sandbox (dev build) denenir. */
export async function sendApnsPush(deviceToken: string, msg: PushMessage): Promise<PushResult> {
  const payload = JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: "default",
      ...(msg.badge != null ? { badge: msg.badge } : {}),
    },
    ...(msg.data ?? {}),
  });
  const headers = {
    authorization: `bearer ${apnsJwt()}`,
    "apns-topic": BUNDLE_ID,
    "apns-push-type": "alert",
    "apns-priority": "10",
  };
  const path = `/3/device/${deviceToken}`;

  const attempt = async (host: string): Promise<PushResult> => {
    const res = await h2Post(host, path, headers, payload);
    if (res.status === 200) return { ok: true, status: 200 };
    let reason = "";
    try { reason = JSON.parse(res.body)?.reason ?? ""; } catch {}
    return {
      ok: false,
      status: res.status,
      reason,
      gone: res.status === 410 || reason === "Unregistered",
    };
  };

  const prod = await attempt(HOST_PROD);
  if (prod.ok || prod.reason !== "BadDeviceToken") return prod;
  return attempt(HOST_SANDBOX); // dev (Xcode) build token'ı
}
