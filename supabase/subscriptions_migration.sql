-- ============================================================
-- PolicePilot — Abonelik Durum Makinesi (Faz 2) Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ÖN KOŞUL: subscription_billing_migration.sql (Faz 1) önce çalışmalı.
--
-- subscriptions: 1 acente = 1 abonelik. status tek otorite; agencies.is_active
-- transition() ile senkronlanır (getEffectiveLimits agencies.is_active okur).
-- period_end = agencies.expires_at ile hizalanır (K3 — tek süre kaynağı).
-- ============================================================

create table if not exists public.subscriptions (
  agency_id                uuid primary key,
  status                   text not null default 'active'
                             check (status in ('trialing','active','past_due','canceled','paused')),
  period_start             date,
  period_end               date,
  cancel_at_period_end     boolean not null default false,
  provider                 text not null default 'manual',  -- 'manual'|'stripe'|'iyzico'
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.subscriptions is 'Acente aboneliği — durum makinesi + dönem. status tek otorite (agencies.is_active senkron).';

alter table public.subscriptions enable row level security;

-- SELECT: kendi acente + super_admin (agencies deseni). Yazım yalnız service-role.
do $$ begin
  create policy "read own subscription" on public.subscriptions for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.agency_id = subscriptions.agency_id)
  );
exception when duplicate_object then null; end $$;

-- ─── Backfill: mevcut acenteler için abonelik satırı (idempotent) ────────────────
-- status: is_active ? 'active' : 'paused'. period_end = expires_at (varsa).
-- period_start: created_at; yoksa bugün.
insert into public.subscriptions (agency_id, status, period_start, period_end)
select a.id,
       case when coalesce(a.is_active, true) then 'active' else 'paused' end,
       coalesce(a.created_at::date, current_date),
       a.expires_at::date
from public.agencies a
where not exists (select 1 from public.subscriptions s where s.agency_id = a.id);
