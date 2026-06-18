-- ============================================================
-- SigortaOS — F1 ROLLBACK (acil geri alma)
-- f1_scoped_rls_migration.sql'i önceki AÇIK duruma döndürür.
-- UYARI: Bu, kapatılan multi-tenant deliğini yeniden AÇAR. Yalnız acil durumda.
--
-- Backfill'ler (policies.agency_id) GERİ ALINMAZ — ileri-güvenli, zararsız.
-- ============================================================

-- ─── 1. RLS: scoped politikaları kaldır, eski açık politikaları geri getir ──
-- customers
drop policy if exists "scoped read customers"   on public.customers;
drop policy if exists "scoped insert customers" on public.customers;
drop policy if exists "scoped update customers" on public.customers;
drop policy if exists "scoped delete customers" on public.customers;
create policy "public read customers"   on public.customers for select using (true);
create policy "public insert customers" on public.customers for insert with check (true);
create policy "public update customers" on public.customers for update using (true);
create policy "public delete customers" on public.customers for delete using (true);

-- policies
drop policy if exists "scoped read policies"   on public.policies;
drop policy if exists "scoped insert policies" on public.policies;
drop policy if exists "scoped update policies" on public.policies;
drop policy if exists "scoped delete policies" on public.policies;
create policy "public read policies"   on public.policies for select using (true);
create policy "public insert policies" on public.policies for insert with check (true);
create policy "public update policies" on public.policies for update using (true);
create policy "public delete policies" on public.policies for delete using (true);

-- requests
drop policy if exists "scoped read requests"   on public.requests;
drop policy if exists "scoped insert requests" on public.requests;
drop policy if exists "scoped update requests" on public.requests;
drop policy if exists "scoped delete requests" on public.requests;
create policy "public read requests"   on public.requests for select using (true);
create policy "public insert requests" on public.requests for insert with check (true);
create policy "public update requests" on public.requests for update using (true);
create policy "public delete requests" on public.requests for delete using (true);

-- ─── 2. Trigger + default'ları geri al ──────────────────────────────────────
drop trigger if exists trg_set_row_owner_customers on public.customers;
drop trigger if exists trg_set_row_owner_policies  on public.policies;
drop function if exists public.set_row_owner();

alter table public.customers alter column created_by drop default;
alter table public.policies  alter column created_by drop default;
alter table public.profiles  alter column agency_role set default 'owner';

-- ─── 3. Helper fonksiyonları kaldır (politikalar artık onları kullanmıyor) ──
drop function if exists public.auth_is_managerial();
drop function if exists public.auth_is_super();
drop function if exists public.auth_agency_id();

-- NOT: idx_requests_customer index'i zararsızdır, bırakılır.
--      İstenirse: drop index if exists public.idx_requests_customer;
