-- ============================================================
-- PolicePilot — OCR Results Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- OCR sağlayıcı çıktısını hata ayıklama ve kalite ölçümü için saklar.
-- Dosyanın kendisi Storage'da; bu tabloda provider, mode, raw_response
-- ve normalize edilen alanlar tutulur.
-- ============================================================

create table if not exists public.ocr_results (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid,
  customer_id     uuid,
  policy_id       uuid,
  document_path   text,
  provider        text not null,
  mode            text not null default 'real',
  normalized_data jsonb not null default '{}'::jsonb,
  raw_response    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ocr_results_agency on public.ocr_results(agency_id);
create index if not exists idx_ocr_results_policy on public.ocr_results(policy_id);
create index if not exists idx_ocr_results_created on public.ocr_results(created_at desc);

alter table public.ocr_results enable row level security;

do $$ begin
  create policy "ocr_results_select_own_agency" on public.ocr_results
    for select using (
      agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    );
exception when duplicate_object then null; end $$;

-- Yazma yalnız service role API üzerinden.
