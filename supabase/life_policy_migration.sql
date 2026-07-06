-- ════════════════════════════════════════════════════════════════════════════
-- SigortaOS — Hayat Sigortası modülü
-- 1) policies.details (jsonb): ürün-özel alanlar (sigortalı, lehtarlar, teminatlar…)
-- 2) policy_payments: prim ödeme takvimi (satır bazlı durum takibi)
-- RLS: f1 kalıbı. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.policies add column if not exists details jsonb;

create table if not exists public.policy_payments (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null,
  policy_id  uuid not null references public.policies(id) on delete cascade,
  seq        integer not null,            -- 1. Prim, 2. Prim…
  due_date   date not null,
  amount     numeric,
  currency   text not null default 'TRY',
  paid_at    timestamptz,                 -- null = ödenmedi (durum due_date ile türetilir)
  created_at timestamptz not null default now()
);

create index if not exists pp_policy_idx on public.policy_payments (policy_id, seq);
create index if not exists pp_agency_due_idx on public.policy_payments (agency_id, due_date)
  where paid_at is null;                  -- geciken/bekleyen prim sorguları

alter table public.policy_payments enable row level security;

drop policy if exists "scoped read payments"   on public.policy_payments;
drop policy if exists "scoped insert payments" on public.policy_payments;
drop policy if exists "scoped update payments" on public.policy_payments;
drop policy if exists "scoped delete payments" on public.policy_payments;

create policy "scoped read payments" on public.policy_payments for select
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped insert payments" on public.policy_payments for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped update payments" on public.policy_payments for update
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() )
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped delete payments" on public.policy_payments for delete
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );
