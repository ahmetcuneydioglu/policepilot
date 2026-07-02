-- ============================================================================
-- SigortaOS — Görevler (Sprint 4 "Derinlik")
-- "Salı günü Ayşe Hanım'ı ara" tipinde müşteri+tarih+atama görevleri.
-- Erişim: yalnız service-role API (/api/tasks) — client policy YOK
-- (ocr_cache/platform_settings deseni). Idempotent.
-- ============================================================================

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null,
  title        text not null,
  customer_id  uuid,                              -- opsiyonel müşteri bağı
  request_id   uuid,                              -- opsiyonel satış fırsatı bağı
  due_date     date,                              -- vade (TodayStrip bunu okur)
  assigned_to  uuid,                              -- sorumlu (profiles.id)
  created_by   uuid,                              -- oluşturan
  status       text not null default 'open'
               check (status in ('open', 'done')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tasks_agency_due on public.tasks(agency_id, status, due_date);
create index if not exists idx_tasks_assigned   on public.tasks(assigned_to, status);
create index if not exists idx_tasks_customer   on public.tasks(customer_id);

-- updated_at otomatik (fonksiyon sales_opportunities_migration'da tanımlı;
-- idempotent olması için burada da güvenceye alınır)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- RLS: aç ama policy verme → yalnız service-role erişir (API katmanı scope'lar)
alter table public.tasks enable row level security;

comment on table public.tasks is 'Görev/hatırlatma sistemi — müşteri+tarih+atama. Erişim /api/tasks üzerinden (service-role).';
