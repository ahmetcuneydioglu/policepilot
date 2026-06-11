-- ============================================================
-- PolicePilot — Müşteri Ek Alanları + Poliçe Dokümanı Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- 1. customers: form alanlarının kolon karşılıkları
--    (email, TC/VKN, plaka, poliçe bitiş, dinamik ek veri)
-- 2. policies: doküman alanları (Storage referansı)
-- 3. Storage: policy-documents bucket'ı (private)
-- ============================================================

-- ─── 1. customers ek kolonları ───────────────────────────────
alter table public.customers
  add column if not exists email           text,
  add column if not exists identity_no     text,
  -- TC Kimlik No veya Vergi Kimlik No
  add column if not exists vehicle_plate   text,
  add column if not exists policy_end_date date,
  add column if not exists extra_data      jsonb not null default '{}'::jsonb,
  -- Sigorta türüne göre dinamik alanlar: araç (motor/şasi no), sağlık, konut…
  add column if not exists agency_id       uuid;

comment on column public.customers.identity_no is 'TC Kimlik No veya VKN';
comment on column public.customers.extra_data  is 'Türe özel alanlar: vehicle_plate, engine_no, chassis_no, city, address…';

create index if not exists idx_customers_agency on public.customers(agency_id);

-- ─── 2. policies doküman alanları ────────────────────────────
alter table public.policies
  add column if not exists document_path text,
  -- Storage yolu: {agency_id}/{policy_id}/{timestamp}-{dosya}
  add column if not exists document_name text;
  -- Orijinal dosya adı (UI'da gösterim için)

comment on column public.policies.document_path is 'policy-documents bucket içindeki dosya yolu';

-- ─── 3. Storage bucket: policy-documents (private) ───────────
-- Yükleme ve okuma yalnız service role API üzerinden yapılır
-- (/api/policy-documents) — client'a storage policy gerekmez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-documents',
  'policy-documents',
  false,
  8388608,  -- 8MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;
