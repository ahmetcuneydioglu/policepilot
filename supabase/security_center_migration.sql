-- ============================================================================
-- Security Center — Faz 1 (Telefon OTP) migration
-- ----------------------------------------------------------------------------
-- Genişleyebilir güvenlik modülünün temeli. İlk sürümde yalnız telefon OTP
-- aktif; tablolar/kolonlar gelecekteki 2FA / passkey / push / trusted-device
-- özelliklerini ŞEMA DEĞİŞİKLİĞİ GEREKTİRMEDEN taşıyacak şekilde generic.
--
-- Yazma yalnız service-role iledir (API). RLS: kullanıcı yalnız KENDİ kaydını
-- okur; super_admin tümünü okur (gelecek admin paneli). Insert/Update/Delete
-- policy YOK → client doğrudan yazamaz (fail-closed).
--
-- Çalıştırma: Supabase SQL editöründe bu dosyayı çalıştırın (idempotent).
-- ============================================================================

-- ─── 1) profiles: doğrulama durumu ──────────────────────────────────────────
alter table public.profiles
  add column if not exists verified_phone   boolean not null default false,
  add column if not exists phone_verified_at timestamptz;

-- Mevcut kullanıcılar kilitlenmesin: bu migration'dan ÖNCE oluşanları doğrulanmış say.
update public.profiles
   set verified_phone = true
 where verified_phone = false
   and created_at < now();

-- ─── 2) otp_requests — tek-kullanımlık, hash'li, süreli kodlar ───────────────
create table if not exists public.otp_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  phone        text not null,
  channel      text not null default 'sms',          -- sms | (gelecek: whatsapp, call)
  purpose      text not null default 'phone_verify',  -- phone_verify | (gelecek: login_2fa, sensitive_action)
  code_hash    text not null,                          -- HMAC-SHA256(code+salt+pepper) — PLAIN KOD ASLA
  code_salt    text not null,
  expires_at   timestamptz not null,
  attempts     int  not null default 0,
  max_attempts int  not null default 5,
  consumed_at  timestamptz,                            -- doğrulanınca/iptal olunca dolar (tek kullanım)
  created_at   timestamptz not null default now()
);
create index if not exists idx_otp_requests_user    on public.otp_requests(user_id);
create index if not exists idx_otp_requests_expires on public.otp_requests(expires_at);
create index if not exists idx_otp_requests_active   on public.otp_requests(user_id, purpose, consumed_at);

-- ─── 3) phone_verifications — doğrulama olay audit'i ────────────────────────
create table if not exists public.phone_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  phone       text not null,
  method      text not null default 'phone_otp',       -- gelecek: totp, passkey…
  verified_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_phone_verifications_user on public.phone_verifications(user_id);

-- ─── 4) trusted_devices — yalnız ŞEMA (henüz wire edilmedi) ──────────────────
create table if not exists public.trusted_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  device_id     text not null,                          -- istemci üretir (stabil)
  platform      text,                                   -- ios | android | web
  ip            text,
  user_agent    text,
  trusted       boolean not null default false,         -- gelecek: yeni-cihaz onayı
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, device_id)
);
create index if not exists idx_trusted_devices_user on public.trusted_devices(user_id);

-- ─── 5) security_logs — append-only güvenlik audit'i (yöntem-bağımsız) ───────
create table if not exists public.security_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  agency_id  uuid,
  event      text not null,        -- OTP_SENT | PHONE_VERIFIED | OTP_FAILED | NEW_DEVICE | PASSWORD_CHANGED | LOGOUT | SUSPICIOUS_LOGIN …
  channel    text,                 -- sms | app | web …
  ip         text,
  user_agent text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_security_logs_user    on public.security_logs(user_id);
create index if not exists idx_security_logs_event   on public.security_logs(event);
create index if not exists idx_security_logs_created on public.security_logs(created_at desc);

-- ─── 6) RLS — yalnız okuma (kendi kaydı) + super_admin tümü; yazma service-role ─
alter table public.otp_requests        enable row level security;
alter table public.phone_verifications enable row level security;
alter table public.trusted_devices     enable row level security;
alter table public.security_logs       enable row level security;

-- Tekrar çalıştırılabilir olsun diye önce düşür
drop policy if exists "otp_requests: read own"        on public.otp_requests;
drop policy if exists "otp_requests: super only"      on public.otp_requests;
drop policy if exists "phone_verifications: read own" on public.phone_verifications;
drop policy if exists "trusted_devices: read own"     on public.trusted_devices;
drop policy if exists "security_logs: read own"       on public.security_logs;

-- otp_requests code_hash/code_salt taşır → client'a hiç okutma, yalnız super_admin
-- (uygulama OTP'yi yalnız API üzerinden işler; doğrudan okumaya ihtiyaç yok).
create policy "otp_requests: super only" on public.otp_requests for select
  using ( coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false) );

create policy "phone_verifications: read own" on public.phone_verifications for select
  using ( user_id = auth.uid()
          or coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false) );

create policy "trusted_devices: read own" on public.trusted_devices for select
  using ( user_id = auth.uid()
          or coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false) );

create policy "security_logs: read own" on public.security_logs for select
  using ( user_id = auth.uid()
          or coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false) );

-- NOT: insert/update/delete policy bilinçli olarak YOK → client yazamaz.
-- Tüm yazmalar API'de getSupabaseAdmin() (service-role) ile yapılır (RLS bypass).
