-- ============================================================
-- PolicePilot — Renewal Notification Engine Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ============================================================

-- ─── renewal_jobs: hangi poliçe için hangi bildirim üretildi ─
-- Dedup garantisi: aynı poliçe + tip + kanal için tek kayıt.
create table if not exists public.renewal_jobs (
  id           uuid primary key default gen_random_uuid(),
  policy_id    uuid not null,
  agency_id    uuid,
  notify_type  text not null default 'renewal_24h',
  -- renewal_24h | renewal_7d | renewal_overdue
  channel      text not null default 'browser',
  -- browser | whatsapp | email | push  (ileride genişler)
  status       text not null default 'pending',
  -- pending | sent | failed
  payload      jsonb,
  -- Kanala özel veri: mesaj metni, telefon, email vs.
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  error_message text
);

-- Aynı poliçe için aynı tip+kanal bildirimi bir kez üretilir
create unique index if not exists uq_renewal_jobs_policy_type_channel
  on public.renewal_jobs(policy_id, notify_type, channel);

create index if not exists idx_renewal_jobs_agency  on public.renewal_jobs(agency_id);
create index if not exists idx_renewal_jobs_status  on public.renewal_jobs(status);

comment on table  public.renewal_jobs is 'Yenileme bildirim işleri — kanal bazlı, dedup korumalı';
comment on column public.renewal_jobs.channel is 'browser | whatsapp | email | push';

-- ─── notifications: genel bildirim akışı ─────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid,
  type       text not null default 'renewal',
  -- renewal | request | system
  title      text not null,
  body       text,
  link       text,
  -- Tıklanınca gidilecek route: /renewals vs.
  ref_id     uuid,
  -- İlişkili kayıt (policy_id vs.)
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_agency  on public.notifications(agency_id);
create index if not exists idx_notifications_unread  on public.notifications(agency_id, is_read) where is_read = false;

comment on table public.notifications is 'Uygulama içi bildirim akışı — realtime ile dağıtılır';

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.renewal_jobs  enable row level security;
alter table public.notifications enable row level security;

do $$ begin
  create policy "notifications_select_own_agency" on public.notifications
    for select using (
      agency_id is null
      or agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notifications_update_own_agency" on public.notifications
    for update using (
      agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    );
exception when duplicate_object then null; end $$;

-- renewal_jobs sadece service role tarafından yazılır/okunur (cron)
-- Kullanıcı erişimi yok — policy eklemiyoruz.

-- ─── Realtime: notifications tablosunu publication'a ekle ────
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
        when undefined_object then null; end $$;
