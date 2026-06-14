-- ============================================================
-- PolicePilot — OCR Dosya Önbelleği Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Aynı dosya (SHA256) tekrar yüklenince OCR'ı tekrar çalıştırmadan
-- önbellekten döner → gereksiz OpenAI token tüketimi önlenir.
--
-- Gizlilik: önbellek ACENTE bazlıdır (agency_id + file_hash). Bir acentenin
-- OCR sonucu başka acenteye dönmez.
-- ============================================================

create table if not exists public.ocr_cache (
  agency_id  uuid not null,
  file_hash  text not null,          -- dosya içeriğinin SHA256'sı (hex)
  fields     jsonb not null,         -- OCR sonucu (PolicyOcrFields) aynen
  provider   text,
  mode       text,
  created_at timestamptz not null default now(),
  primary key (agency_id, file_hash)
);

comment on table public.ocr_cache is 'OCR dosya önbelleği — aynı dosya tekrar OCR yapılmadan döner (token tasarrufu)';

-- RLS: client erişimi yok — yalnız service role (OCR endpoint) okur/yazar
alter table public.ocr_cache enable row level security;
