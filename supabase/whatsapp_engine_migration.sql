-- ============================================================
-- PolicePilot — WhatsApp Daily Operations Engine Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- 1. whatsapp_queue     — provider bağımsız gönderim kuyruğu
-- 2. whatsapp_templates — mesaj şablonları (ilk: daily_summary)
-- 3. agency_settings    — acente bazlı WhatsApp ayarları
-- ============================================================

-- ─── 1. whatsapp_queue ───────────────────────────────────────
create table if not exists public.whatsapp_queue (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null,
  phone         text not null,
  message       text not null,
  status        text not null default 'pending',
  -- pending | sent | failed | skipped (test modu)
  attempts      integer not null default 0,
  provider      text,
  -- mock | meta_cloud | twilio | dialog360 | wati
  template_key  text,
  -- Hangi şablondan üretildi (daily_summary, renewal_alert, …)
  dedup_key     text,
  -- Aynı gün aynı özetin iki kez kuyruğa girmesini engeller
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  error_message text
);

create unique index if not exists uq_whatsapp_queue_dedup
  on public.whatsapp_queue(dedup_key) where dedup_key is not null;

create index if not exists idx_whatsapp_queue_agency on public.whatsapp_queue(agency_id);
create index if not exists idx_whatsapp_queue_status on public.whatsapp_queue(status);
create index if not exists idx_whatsapp_queue_created on public.whatsapp_queue(created_at desc);

comment on table  public.whatsapp_queue is 'WhatsApp gönderim kuyruğu — provider bağımsız, tüm otomasyonların merkezi';
comment on column public.whatsapp_queue.status is 'pending | sent | failed | skipped';

-- ─── 2. whatsapp_templates ───────────────────────────────────
create table if not exists public.whatsapp_templates (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  title        text not null,
  content      text not null,
  -- {{placeholder}} sözdizimi: {{date}}, {{today_count}}, {{week_count}},
  -- {{overdue_count}}, {{urgent_list}}, {{app_url}}
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.whatsapp_templates is 'WhatsApp mesaj şablonları — template_key ile çağrılır';

-- İlk şablon: günlük operasyon özeti
insert into public.whatsapp_templates (template_key, title, content)
values (
  'daily_summary',
  'Günlük Operasyon Özeti',
  E'🔔 *PolicePilot Günlük Operasyon Özeti*\n\nTarih: {{date}}\n\nBugün Yenilenecek: *{{today_count}}*\nBu Hafta Yenilenecek: *{{week_count}}*\nGeciken Yenileme: *{{overdue_count}}*\n\n{{urgent_list}}\nPolicePilot''a giriş yap:\n{{app_url}}'
)
on conflict (template_key) do nothing;

-- ─── 3. agency_settings ──────────────────────────────────────
create table if not exists public.agency_settings (
  agency_id              uuid primary key,
  whatsapp_enabled       boolean not null default false,
  whatsapp_phone         text,
  -- Özetin gönderileceği acente numarası (E.164: 9055…)
  whatsapp_provider      text not null default 'mock',
  -- mock | meta_cloud | twilio | dialog360 | wati
  whatsapp_api_key       text,
  daily_summary_enabled  boolean not null default false,
  test_mode              boolean not null default true,
  -- Test modunda gerçek gönderim yapılmaz, kuyruk kaydı oluşur
  updated_at             timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

comment on table  public.agency_settings is 'Acente bazlı entegrasyon ayarları (WhatsApp vb.)';
comment on column public.agency_settings.test_mode is 'true → gerçek gönderim yok, kuyruk skipped işaretlenir';

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.whatsapp_queue     enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.agency_settings    enable row level security;

-- Queue: acente kendi kayıtlarını görür, super_admin hepsini.
-- Yazma yalnız service role (cron/API) — insert/update policy yok.
do $$ begin
  create policy "whatsapp_queue_select_own_agency" on public.whatsapp_queue
    for select using (
      agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    );
exception when duplicate_object then null; end $$;

-- Templates: herkes okuyabilir (içerikte gizli veri yok), yazma service role
do $$ begin
  create policy "whatsapp_templates_select_all" on public.whatsapp_templates
    for select using (true);
exception when duplicate_object then null; end $$;

-- agency_settings: API key içerdiği için client erişimi YOK —
-- okuma/yazma yalnız service role üzerinden (/api/whatsapp/settings).
-- Policy eklenmiyor.
