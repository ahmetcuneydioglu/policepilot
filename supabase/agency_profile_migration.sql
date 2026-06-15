-- ============================================================
-- PolicePilot — Acente Şirket Profili Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Ayarlar Merkezi "Şirket Bilgileri" bölümü için eksik profil kolonları.
-- agencies'te name/slug/phone/email/website/logo_url/primary_color zaten var;
-- bu migration vergi no, adres ve şehri ekler.
-- ============================================================

alter table public.agencies
  add column if not exists tax_no  text,
  add column if not exists address text,
  add column if not exists city    text;

comment on column public.agencies.tax_no  is 'Vergi numarası (şirket profili)';
comment on column public.agencies.address is 'Açık adres (şirket profili)';
comment on column public.agencies.city    is 'Şehir (şirket profili)';
