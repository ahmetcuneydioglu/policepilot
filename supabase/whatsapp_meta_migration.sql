-- ============================================================
-- PolicePilot — Meta WhatsApp Cloud API Alanları Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Ayrım netleştirildi:
--   whatsapp_phone      → ALICI: özetlerin gittiği acente numarası
--   whatsapp_sender_id  → GÖNDEREN: Meta Phone Number ID (Cloud API hattı)
--   whatsapp_api_key    → Meta Access Token (kalıcı token önerilir)
--   whatsapp_business_account_id → WABA ID (bilgi/ileride şablon yönetimi)
-- ============================================================

alter table public.agency_settings
  add column if not exists whatsapp_sender_id           text,
  add column if not exists whatsapp_business_account_id text;

comment on column public.agency_settings.whatsapp_sender_id           is 'Meta Cloud API Phone Number ID (gönderen hat)';
comment on column public.agency_settings.whatsapp_business_account_id is 'Meta WhatsApp Business Account ID (WABA)';
