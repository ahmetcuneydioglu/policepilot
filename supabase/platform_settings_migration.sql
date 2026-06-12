-- ============================================================
-- PolicePilot — Platform WhatsApp Yapılandırması Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Meta kimlik bilgileri ACENTE seviyesinden PLATFORM seviyesine taşınır.
-- WhatsApp hattının sahibi platformdur; acenteler yalnız alıcıdır.
-- Bu tabloyu yalnız super_admin yönetir (API: /api/whatsapp/platform-settings).
-- ============================================================

create table if not exists public.platform_settings (
  id                   int primary key default 1 check (id = 1),
  whatsapp_provider    text not null default 'meta_cloud',
  -- mock | meta_cloud
  meta_access_token    text,
  -- Boşsa env META_ACCESS_TOKEN yedeği kullanılır
  meta_phone_number_id text,
  -- Boşsa env META_PHONE_NUMBER_ID yedeği kullanılır
  meta_waba_id         text,
  test_mode            boolean not null default true,
  -- Platform geneli: true → gerçek gönderim yok, kuyruk "Test" işaretlenir
  updated_at           timestamptz not null default now()
);

comment on table public.platform_settings is 'Platform geneli WhatsApp/Meta yapılandırması — yalnız super_admin yönetir, yalnız service role okur';

-- Tek satır garantisi
insert into public.platform_settings (id) values (1) on conflict do nothing;

-- Mevcut acente kaydındaki sender_id'yi platforma taşı (idempotent)
update public.platform_settings
set meta_phone_number_id = coalesce(
  meta_phone_number_id,
  (select whatsapp_sender_id from public.agency_settings where whatsapp_sender_id is not null limit 1)
)
where id = 1;

-- Test modunu mevcut Meta acentesinin modundan devral (varsa)
update public.platform_settings
set test_mode = coalesce(
  (select test_mode from public.agency_settings where whatsapp_provider = 'meta_cloud' limit 1),
  test_mode
)
where id = 1;

-- ─── RLS: client erişimi YOK — yalnız service role ───────────
alter table public.platform_settings enable row level security;
-- Policy bilinçli olarak eklenmiyor: token client'a asla açılmaz.
