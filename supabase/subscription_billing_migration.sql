-- ============================================================
-- PolicePilot — SaaS Abonelik & Lisanslama (Faz 1) Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Faz 1 kapsamı: kullanım takibi + eklenti-farkında limit motoru altyapısı.
-- Satın alım / faturalandırma / admin plan yönetimi Faz 2'de gelir.
--
-- Çekirdek strateji: agencies.max_* kolonlari SILINMEZ — legacy 4 metrik
-- (users/customers/requests/policies) icin AUTHORITATIVE per-acente limit olarak
-- kalir (admin override). Yeni 3 metrik (ai_credits/wa_monthly/storage_mb)
-- plan_catalog'tan gelir. Etkin limit = bunlar + aktif eklentiler (agency_addons).
--
-- RLS desenleri:
--   plan_catalog/addon_catalog → SELECT using(true) (fiyat zaten panelde), yazim service-role
--   agency_addons/usage_counters → SELECT kendi acente + super_admin, yazim service-role
--   billing_events → policy YOK (yalniz service-role — platform_settings deseni)
-- ============================================================

-- ─── plan_catalog: plan tabani (fiyat + 7 limit; super_admin Faz 2'de duzenler) ──
create table if not exists public.plan_catalog (
  plan            text primary key check (plan in ('starter','pro','enterprise')),
  label           text not null,
  monthly_price   integer not null default 0,
  base_users      integer not null default 20,
  base_customers  integer not null default 200,
  base_requests   integer not null default 500,
  base_policies   integer not null default 500,
  base_storage_mb integer not null default 10240,
  base_ai_credits integer not null default 100,
  base_wa_monthly integer not null default 1000,
  modules         jsonb   not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);
comment on table public.plan_catalog is 'Plan tabanlari — limit/fiyat tek DB kaynagi (kod hardcoded degil).';

-- Seed (kullanici spec'i). monthly_price lib/planPricing.ts ile hizali.
-- Legacy 4 metrik (users/customers/requests/policies) Faz 1'de agencies.max_*'tan
-- cozulur; buradaki degerler sablon + yeni-acente referansidir.
insert into public.plan_catalog (plan, label, monthly_price, base_users, base_customers, base_requests, base_policies, base_storage_mb, base_ai_credits, base_wa_monthly) values
  ('starter',    'Starter',     0,    5,     500,    500,    500,    10240,    100,   1000),
  ('pro',        'Growth',      1490, 15,    5000,   5000,   5000,   102400,   1000,  10000),
  ('enterprise', 'Enterprise',  4990, 100,   100000, 100000, 100000, 1048576,  10000, 100000)
on conflict (plan) do nothing;

-- ─── addon_catalog: satilabilir eklenti katalogu (super_admin Faz 2'de fiyatlar) ──
create table if not exists public.addon_catalog (
  key            text primary key,
  label          text not null,
  unit_label     text not null,
  unit_price     integer not null default 0,
  grants_metric  text not null,          -- 'users'|'ai_credits'|'wa_monthly'|'storage_mb' | entitlement key
  grant_per_unit integer not null default 1,
  is_entitlement boolean not null default false,  -- true → limit yerine modul/lisans verir
  is_active      boolean not null default true,
  sort_order     integer not null default 0
);
comment on table public.addon_catalog is 'Satilabilir eklenti katalogu — adet bazli etkin-limit girdisi.';

insert into public.addon_catalog (key, label, unit_label, unit_price, grants_metric, grant_per_unit, sort_order) values
  ('addon_users',   'Ek Kullanıcı',       '+1 kullanıcı',  99, 'users',       1,    1),
  ('addon_ai',      'Ek AI Kredisi',      '+100 kredi',    49, 'ai_credits',  100,  2),
  ('addon_wa',      'Ek WhatsApp Paketi', '+1000 mesaj',   99, 'wa_monthly',  1000, 3),
  ('addon_storage', 'Ek Depolama',        '+50 GB',        49, 'storage_mb',  51200,4)
on conflict (key) do nothing;

-- ─── agency_addons: acentenin aktif eklentileri (Faz 1'de bos; Faz 2 doldurur) ──
create table if not exists public.agency_addons (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null,
  addon_key           text not null references public.addon_catalog(key),
  quantity            integer not null default 1 check (quantity > 0),
  status              text not null default 'active' check (status in ('active','canceled')),
  unit_price_snapshot integer not null default 0,
  activated_at        timestamptz not null default now(),
  canceled_at         timestamptz
);
create unique index if not exists uq_agency_addon_active
  on public.agency_addons(agency_id, addon_key) where status = 'active';
create index if not exists idx_agency_addons_agency on public.agency_addons(agency_id);

-- ─── usage_counters: DONEMSEL akis sayaclari (ai_credits, wa_sent) ───────────────
-- Anlik metrikler (users/customers/storage) BURAYA YAZILMAZ — canli sayilir.
-- Donem-anahtarli: yeni ay = yeni satir → otomatik sifirlama (cron'suz).
create table if not exists public.usage_counters (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null,
  metric       text not null,           -- 'ai_credits' | 'wa_sent'
  period_start date not null,           -- TR ayin 1'i (Europe/Istanbul)
  used         integer not null default 0,
  updated_at   timestamptz not null default now()
);
create unique index if not exists uq_usage_counter
  on public.usage_counters(agency_id, metric, period_start);

-- Atomik artirma RPC (security definer — service-role disindan da cagrilabilir guvenle)
create or replace function public.increment_usage(
  p_agency uuid, p_metric text, p_period date, p_delta integer
) returns integer
language plpgsql security definer
set search_path = public
as $$
declare new_used integer;
begin
  insert into public.usage_counters (agency_id, metric, period_start, used)
  values (p_agency, p_metric, p_period, p_delta)
  on conflict (agency_id, metric, period_start)
  do update set used = public.usage_counters.used + excluded.used, updated_at = now()
  returning used into new_used;
  return new_used;
end $$;

-- ─── billing_events: denetim izi + (Faz 2+) provider webhook log ─────────────────
create table if not exists public.billing_events (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid,
  type        text not null,            -- 'plan_change'|'status_change'|'addon_purchase'|...
  actor_id    uuid,
  amount      integer,                  -- ilgili tutar (varsa)
  status      text,                     -- 'pending_payment'|'paid'|'logged'|...
  source      text not null default 'manual',  -- 'manual'|'simulation'|'stripe'|'iyzico'|'system'
  external_ref text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_billing_events_agency on public.billing_events(agency_id, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────────
alter table public.plan_catalog   enable row level security;
alter table public.addon_catalog  enable row level security;
alter table public.agency_addons  enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_events enable row level security;

-- Kataloglar: herkes okur (fiyat panelde gosterilecek), yazim service-role
do $$ begin
  create policy "read plan_catalog"  on public.plan_catalog  for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read addon_catalog" on public.addon_catalog for select using (true);
exception when duplicate_object then null; end $$;

-- agency_addons / usage_counters: kendi acente + super_admin okur (agencies deseni)
do $$ begin
  create policy "read own agency_addons" on public.agency_addons for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.agency_id = agency_addons.agency_id)
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "read own usage_counters" on public.usage_counters for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.agency_id = usage_counters.agency_id)
  );
exception when duplicate_object then null; end $$;

-- billing_events: client politikasi YOK → yalniz service-role (platform_settings deseni)
