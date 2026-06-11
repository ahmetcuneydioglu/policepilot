-- ============================================================
-- PolicePilot — Documents (Evrak) Tablosu Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Yüklenen tüm evrakların merkezi kaydı. İlk kullanım: poliçe PDF'leri.
-- İleride: ruhsat, kimlik, hasar evrakı vb. aynı tabloya girer.
-- Dosyanın kendisi Storage'da (policy-documents bucket), bu tablo metadata.
-- ============================================================

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid,
  customer_id uuid,
  policy_id   uuid,
  doc_type    text not null default 'policy',
  -- policy | license | identity | claim | other
  file_path   text not null,
  -- Storage yolu (policy-documents bucket)
  file_name   text not null,
  mime_type   text,
  size_bytes  bigint,
  source      text not null default 'upload',
  -- upload | ocr_upload (OCR ile okunarak yüklendi)
  created_at  timestamptz not null default now()
);

create index if not exists idx_documents_agency   on public.documents(agency_id);
create index if not exists idx_documents_customer on public.documents(customer_id);
create index if not exists idx_documents_policy   on public.documents(policy_id);

comment on table public.documents is 'Evrak metadata kaydı — dosyalar Storage''da, kayıtlar burada';

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.documents enable row level security;

do $$ begin
  create policy "documents_select_own_agency" on public.documents
    for select using (
      agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    );
exception when duplicate_object then null; end $$;

-- Yazma yalnız service role (API) üzerinden — insert/update policy yok.
