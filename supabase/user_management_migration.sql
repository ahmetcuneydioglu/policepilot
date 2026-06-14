-- ============================================================
-- PolicePilot — Kullanıcı Yönetimi & Yetkilendirme Migration (Faz 1)
-- Supabase SQL Editor'da çalıştırın (idempotent — birden çok kez çalışabilir)
--
--   1. profiles: SaaS rolü (agency_role), durum, iletişim, yetki override, son giriş
--   2. created_by izleri: customers, policies, quote_runs
--   3. activity_log tablosu + index + RLS (yalnız service role)
--
-- KRİTİK: sistem rolü `role` ('super_admin' | 'agency_user') OLDUĞU GİBİ KALIR.
-- resolveCaller / requireSuperAdmin / schema.sql RLS politikaları bu kolonu okur.
-- Acente içi SaaS rolü için AYRI `agency_role` kolonu eklenir → %100 geriye uyumlu.
-- ============================================================

-- ─── 1. profiles ek kolonları ───────────────────────────────
alter table public.profiles
  add column if not exists email         text,
  add column if not exists phone         text,
  add column if not exists status        text not null default 'active',
  add column if not exists last_login_at timestamptz,
  add column if not exists agency_role   text not null default 'owner',
  add column if not exists permissions   jsonb;

comment on column public.profiles.agency_role is
  'Acente içi SaaS rolü (owner|manager|sales|operations|viewer). Sistem rolü `role` ile karıştırılmaz.';
comment on column public.profiles.permissions is
  'Yetki override haritası (yalnız rol şablonundan farklı anahtarlar). null = rol şablonu kullan.';

-- check constraint'leri ayrı/idempotent ekle (kolon varsa tekrar eklemeyi atla)
do $$ begin
  alter table public.profiles
    add constraint profiles_status_chk
    check (status in ('active','suspended','invited'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_agency_role_chk
    check (agency_role in ('owner','manager','sales','operations','viewer'));
exception when duplicate_object then null; end $$;

create index if not exists idx_profiles_agency on public.profiles(agency_id);

-- ─── 2. created_by izleri ───────────────────────────────────
-- NOT: auth.users'a FK kullanmıyoruz (silinen kullanıcıda kayıt korunsun).
-- Nullable → eski insert kod yolları NULL ile geçer, hiçbir insert kırılmaz.
alter table public.customers   add column if not exists created_by uuid;
alter table public.policies    add column if not exists created_by uuid;
alter table public.quote_runs  add column if not exists created_by uuid;
-- documents.uploaded_by zaten var (schema.sql).

create index if not exists idx_customers_created_by  on public.customers(created_by);
create index if not exists idx_policies_created_by   on public.policies(created_by);
create index if not exists idx_quote_runs_created_by on public.quote_runs(created_by);

-- ─── 3. activity_log ────────────────────────────────────────
-- Merkezi etkinlik/denetim kaydı — kişi bazlı performans + audit temeli.
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid,                  -- FK yok; super_admin işlemlerinde null olabilir
  actor_id    uuid,                  -- işlemi yapan kullanıcı (auth.users.id)
  actor_name  text,                  -- snapshot — kullanıcı silinse de okunur kalır
  action      text not null,         -- 'create' | 'update' | 'delete' | 'upload' | 'send' | ...
  entity_type text not null,         -- 'customer' | 'policy' | 'quote_run' | 'document' | 'whatsapp' | 'user'
  entity_id   uuid,                  -- ilgili kaydın id'si
  summary     text,                  -- insan-okunur özet (TR)
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is
  'Merkezi etkinlik/denetim kaydı — kişi bazlı performans ve audit temeli (Faz 1).';

create index if not exists idx_activity_agency_time
  on public.activity_log(agency_id, created_at desc);
create index if not exists idx_activity_actor_time
  on public.activity_log(actor_id, created_at desc);
create index if not exists idx_activity_entity
  on public.activity_log(entity_type, entity_id);

-- RLS: client erişimi YOK — yalnız service role yazar/okur (ocr_cache deseni).
-- Politika tanımlanmaz → anon/auth erişemez; service role RLS'i bypass eder.
alter table public.activity_log enable row level security;
