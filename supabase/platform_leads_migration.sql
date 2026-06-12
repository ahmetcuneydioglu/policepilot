-- ============================================================
-- PolicePilot — Satış Merkezi (Platform Lead Kanban) Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Platforma yeni acente kazanımı için lead takibi (super_admin).
-- Acentelerin kendi müşteri lead'leriyle ilgisi yoktur.
-- ============================================================

create table if not exists public.platform_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Acente / yetkili adı
  company    text,
  phone      text,
  email      text,
  source     text,
  -- referans | web | sosyal medya | soğuk arama | diğer
  status     text not null default 'new'
             check (status in ('new','contacted','demo_planned','demo_done','proposal','won','lost')),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_leads_status on public.platform_leads(status);

comment on table public.platform_leads is 'Platform satış hattı — yeni acente kazanım kanbanı (yalnız super_admin)';

-- RLS: client erişimi yok — yalnız service role (/api/admin/leads)
alter table public.platform_leads enable row level security;
