-- ============================================================
-- SigortaOS — F1: customers / requests / policies Scoped RLS + Trigger
-- (Faz B — fazlı geçiş. Service-role-only DEĞİL; doğrudan client yazma korunur.)
--
-- Supabase SQL Editor'da çalıştırın. IDEMPOTENT (tekrar çalıştırılabilir).
-- ÖNCE: f1_preflight_checks.sql çalıştırın + DB snapshot/PITR alın.
-- ROLLBACK: f1_scoped_rls_rollback.sql
--
-- Model: super_admin tümü; owner/manager kendi acentesinin tümü;
--        sales/operations/viewer YALNIZ kendi created_by'si.
-- requests: kendi agency_id/created_by'si YOK → customer-join ile scope.
--
-- Önemli: Postgres'te BEFORE INSERT trigger, RLS WITH CHECK'TEN ÖNCE çalışır.
-- Yani trigger agency_id/created_by'yi doldurur, sonra with-check dolu değeri görür
-- → client agency_id'yi hiç göndermese bile (mobil) insert geçer.
-- ============================================================

-- ─── 0. RLS açık (idempotent güvence) ───────────────────────────────────────
alter table public.customers enable row level security;
alter table public.requests  enable row level security;
alter table public.policies  enable row level security;

-- ─── 1. BACKFILL — policies.agency_id ← customers.agency_id ──────────────────
-- agency_id NULL poliçeler scoped politikada görünmez kalır; müşteriden doldur.
update public.policies p
set agency_id = c.agency_id
from public.customers c
where p.customer_id = c.id
  and p.agency_id is null
  and c.agency_id is not null;
-- NOT: customers.agency_id NULL kayıtlar türetilemez → preflight raporundan manuel incele.

-- ─── 2. HELPER FONKSİYONLAR (STABLE + SECURITY DEFINER) ─────────────────────
-- profiles tek kez okunur (performans/InitPlan) + politikalar tek kaynaktan.
create or replace function public.auth_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_is_super()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.auth_is_managerial()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select agency_role in ('owner','manager') from public.profiles where id = auth.uid()), false)
$$;

grant execute on function public.auth_agency_id()    to anon, authenticated;
grant execute on function public.auth_is_super()     to anon, authenticated;
grant execute on function public.auth_is_managerial() to anon, authenticated;

-- ─── 3. TRIGGER — created_by/agency_id otomatik doldurma (NULL ise) ─────────
-- COALESCE mantığı: API'nin (service-role) açıkça verdiğini EZMEZ; yalnız boş bırakılanı doldurur.
-- Service-role insert'inde auth.uid() NULL → API'nin verdiği korunur.
create or replace function public.set_row_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.agency_id is null then
    new.agency_id := (select agency_id from public.profiles where id = auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_row_owner_customers on public.customers;
create trigger trg_set_row_owner_customers
  before insert on public.customers
  for each row execute function public.set_row_owner();

drop trigger if exists trg_set_row_owner_policies on public.policies;
create trigger trg_set_row_owner_policies
  before insert on public.policies
  for each row execute function public.set_row_owner();

-- ─── 4. DEFAULT'LAR ─────────────────────────────────────────────────────────
alter table public.customers alter column created_by set default auth.uid();
alter table public.policies  alter column created_by set default auth.uid();
-- owner fail-open: agency_role belirtmeden eklenen profil artık en düşük yetki alır.
alter table public.profiles  alter column agency_role set default 'viewer';

-- ─── 5. INDEX — requests customer-join scope performansı ────────────────────
create index if not exists idx_requests_customer on public.requests(customer_id);

-- ─── 6. RLS POLİTİKALARI ────────────────────────────────────────────────────

-- 6a. customers — açık politikaları kapat; scoped SELECT/INSERT/UPDATE/DELETE.
drop policy if exists "public read customers"   on public.customers;
drop policy if exists "public insert customers" on public.customers;
drop policy if exists "public update customers" on public.customers;
drop policy if exists "public delete customers" on public.customers;
drop policy if exists "scoped read customers"   on public.customers;
drop policy if exists "scoped insert customers" on public.customers;
drop policy if exists "scoped update customers" on public.customers;
drop policy if exists "scoped delete customers" on public.customers;

create policy "scoped read customers" on public.customers for select
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

create policy "scoped insert customers" on public.customers for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );

create policy "scoped update customers" on public.customers for update
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) )
  with check ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

create policy "scoped delete customers" on public.customers for delete
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

-- 6b. policies — aynı desen.
drop policy if exists "public read policies"   on public.policies;
drop policy if exists "public insert policies" on public.policies;
drop policy if exists "public update policies" on public.policies;
drop policy if exists "public delete policies" on public.policies;
drop policy if exists "scoped read policies"   on public.policies;
drop policy if exists "scoped insert policies" on public.policies;
drop policy if exists "scoped update policies" on public.policies;
drop policy if exists "scoped delete policies" on public.policies;

create policy "scoped read policies" on public.policies for select
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

create policy "scoped insert policies" on public.policies for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );

create policy "scoped update policies" on public.policies for update
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) )
  with check ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

create policy "scoped delete policies" on public.policies for delete
  using ( public.auth_is_super()
    or (agency_id = public.auth_agency_id()
        and (public.auth_is_managerial() or created_by = auth.uid())) );

-- 6c. requests — açık politikaları (SELECT dahil) kapat; customer-join scoped.
--     requests'in kendi agency_id/created_by'si yok → bağlı müşteri üzerinden.
drop policy if exists "public read requests"   on public.requests;
drop policy if exists "public insert requests" on public.requests;
drop policy if exists "public update requests" on public.requests;
drop policy if exists "public delete requests" on public.requests;
drop policy if exists "scoped read requests"   on public.requests;
drop policy if exists "scoped insert requests" on public.requests;
drop policy if exists "scoped update requests" on public.requests;
drop policy if exists "scoped delete requests" on public.requests;

create policy "scoped read requests" on public.requests for select
  using ( public.auth_is_super() or exists (
    select 1 from public.customers c
    where c.id = requests.customer_id
      and c.agency_id = public.auth_agency_id()
      and (public.auth_is_managerial() or c.created_by = auth.uid())
  ) );

create policy "scoped insert requests" on public.requests for insert
  with check ( public.auth_is_super() or exists (
    select 1 from public.customers c
    where c.id = requests.customer_id
      and c.agency_id = public.auth_agency_id()
      and (public.auth_is_managerial() or c.created_by = auth.uid())
  ) );

create policy "scoped update requests" on public.requests for update
  using ( public.auth_is_super() or exists (
    select 1 from public.customers c
    where c.id = requests.customer_id
      and c.agency_id = public.auth_agency_id()
      and (public.auth_is_managerial() or c.created_by = auth.uid())
  ) );

create policy "scoped delete requests" on public.requests for delete
  using ( public.auth_is_super() or exists (
    select 1 from public.customers c
    where c.id = requests.customer_id
      and c.agency_id = public.auth_agency_id()
      and (public.auth_is_managerial() or c.created_by = auth.uid())
  ) );

-- ============================================================
-- BİTTİ. Doğrulama: f1_preflight_checks.sql'in 1. sorgusunu tekrar çalıştırın —
-- tüm cmd'ler için "scoped ..." politikaları görünmeli, hiçbiri using(true) olmamalı.
-- Sonra test matrisini (her rol × web/mobil) uygulayın.
-- ============================================================
