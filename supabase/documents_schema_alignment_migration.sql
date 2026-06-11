-- ============================================================
-- PolicePilot — Documents Schema Alignment Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Amaç:
-- Eski canlı şema file_type/file_size/bucket kullanıyor.
-- Daha yeni OCR migration denemesi doc_type/mime_type/size_bytes/source
-- kolonlarını bekliyordu. Bu migration iki şekli de aynı tabloda güvenli
-- biçimde destekler.
-- ============================================================

alter table public.documents add column if not exists request_id uuid;
alter table public.documents add column if not exists file_type text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists bucket text not null default 'policy-documents';
alter table public.documents add column if not exists uploaded_by uuid;

alter table public.documents add column if not exists doc_type text not null default 'policy';
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists size_bytes bigint;
alter table public.documents add column if not exists source text not null default 'upload';

update public.documents
set mime_type = coalesce(mime_type, file_type)
where mime_type is null and file_type is not null;

update public.documents
set size_bytes = coalesce(size_bytes, file_size)
where size_bytes is null and file_size is not null;

update public.documents
set file_type = coalesce(file_type, mime_type, 'application/octet-stream')
where file_type is null;

update public.documents
set file_size = coalesce(file_size, size_bytes)
where file_size is null and size_bytes is not null;

create index if not exists idx_documents_agency on public.documents(agency_id);
create index if not exists idx_documents_customer on public.documents(customer_id);
create index if not exists idx_documents_policy on public.documents(policy_id);
