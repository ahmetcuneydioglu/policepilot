-- ============================================================
-- PolicePilot — Documents Tablosu Uyum Migration'ı
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Kanonik şema: schema.sql'deki public.documents
-- (file_name, file_path, file_type, file_size, bucket, uploaded_by).
-- Bu migration tablo yoksa kanonik şekliyle oluşturur; varsa API'nin
-- kullandığı kolonların mevcut olduğunu garanti eder.
--
-- Not: Geçmişte farklı kolon adlarıyla (doc_type/mime_type/size_bytes)
-- ikinci bir şema denenmişti — "Could not find the 'doc_type' column"
-- hatasının kaynağı buydu. Kod artık yalnız kanonik kolonları kullanır:
-- app/api/policy-documents/route.ts → insertDocumentMetadata
-- ============================================================

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid,
  customer_id  uuid references public.customers(id) on delete cascade,
  request_id   uuid references public.requests(id)  on delete cascade,
  policy_id    uuid references public.policies(id)  on delete cascade,
  file_name    text not null,
  file_path    text not null,
  file_type    text not null,
  file_size    bigint,
  bucket       text not null default 'documents',
  uploaded_by  uuid,
  created_at   timestamptz not null default now()
);

-- Tablo eski/farklı bir şemayla oluşmuşsa API'nin yazdığı kolonları tamamla
alter table public.documents
  add column if not exists file_type   text,
  add column if not exists file_size   bigint,
  add column if not exists bucket      text default 'documents',
  add column if not exists uploaded_by uuid,
  add column if not exists request_id  uuid;

create index if not exists idx_documents_agency   on public.documents(agency_id);
create index if not exists idx_documents_customer on public.documents(customer_id);
create index if not exists idx_documents_policy   on public.documents(policy_id);

alter table public.documents enable row level security;

do $$ begin
  create policy "auth read documents"
    on public.documents for select
    using (auth.uid() is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth insert documents"
    on public.documents for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;
