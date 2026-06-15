-- ============================================================
-- PolicePilot — Kişi-Bazlı Veri Kapsamı RLS Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Model: super_admin tümü; owner/manager kendi acentesinin tümü;
--        sales/operations/viewer YALNIZ kendi oluşturduğu (created_by).
--
-- Açık ("using(true)") SELECT politikaları kaldırılır; scoped politika eklenir.
-- INSERT/UPDATE/DELETE politikalarına DOKUNULMAZ (yazımlar service-role API'den
-- RLS bypass eder; public teklif-al insert'i açık kalır).
--
-- Desen: agencies tablosunun mevcut RLS deseniyle aynı (schema.sql).
-- created_by NULL eski satırlar non-managerial kullanıcıya görünmez (kabul).
-- ============================================================

-- ─── customers ──────────────────────────────────────────────
drop policy if exists "public read customers" on public.customers;
drop policy if exists "scoped read customers" on public.customers;
create policy "scoped read customers" on public.customers for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = customers.agency_id
      and (coalesce(p.agency_role, 'owner') in ('owner','manager') or customers.created_by = auth.uid())
  )
);

-- ─── policies ───────────────────────────────────────────────
drop policy if exists "public read policies" on public.policies;
drop policy if exists "scoped read policies" on public.policies;
create policy "scoped read policies" on public.policies for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = policies.agency_id
      and (coalesce(p.agency_role, 'owner') in ('owner','manager') or policies.created_by = auth.uid())
  )
);

-- ─── quote_runs (savunma; okuma API service-role'den ama belt-and-suspenders) ──
alter table public.quote_runs enable row level security;
drop policy if exists "public read quote_runs" on public.quote_runs;
drop policy if exists "scoped read quote_runs" on public.quote_runs;
create policy "scoped read quote_runs" on public.quote_runs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.agency_id = quote_runs.agency_id
      and (coalesce(p.agency_role, 'owner') in ('owner','manager') or quote_runs.created_by = auth.uid())
  )
);
-- quote_runs yazımları service-role API'den (RLS bypass). Yine de client insert/update
-- gerekmiyorsa kapalı kalması güvenli; mevcut akış API üzerinden çalışır.
do $$ begin
  create policy "service insert quote_runs" on public.quote_runs for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update quote_runs" on public.quote_runs for update using (true);
exception when duplicate_object then null; end $$;

-- NOT: requests (gelen lead) tablosu acente-geneli paylaşımlı kalır — değiştirilmez.
