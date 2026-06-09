-- ============================================================
-- PolicePilot — Quote Engine V2 Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ============================================================

-- ─── quote_runs: Engine tracking alanları ───────────────────
alter table public.quote_runs
  add column if not exists provider_type   text not null default 'demo',
  -- demo | manual | api | robot | gateway
  add column if not exists run_started_at  timestamptz,
  add column if not exists run_finished_at timestamptz,
  add column if not exists error_count     integer not null default 0,
  add column if not exists success_count   integer not null default 0;

comment on column public.quote_runs.provider_type   is 'demo | manual | api | robot | gateway';
comment on column public.quote_runs.error_count     is 'Hatalı sonuç sayısı';
comment on column public.quote_runs.success_count   is 'Başarılı teklif sayısı';

-- ─── quote_results: Kaynak & hata alanları ──────────────────
alter table public.quote_results
  add column if not exists source_type    text not null default 'demo',
  -- demo | manual | api | robot | gateway
  add column if not exists provider_name  text,
  -- InsurGateway | Allianz API | InsureBot | Manual | Demo
  add column if not exists error_source   text,
  -- SBM | COMPANY | SYSTEM | TIMEOUT
  add column if not exists error_code     text,
  -- BRV-OVM-POLICE-00358
  add column if not exists error_message  text,
  add column if not exists action_hint    text,
  add column if not exists raw_response   jsonb not null default '{}';

-- Status sütunu: eski değerleri koru, yeni semantiği belgele
-- Eski: Aktif | Seçildi | Teklif Yok
-- Yeni (engine): pending | running | success | no_offer | company_error | sbm_error | timeout | cancelled
comment on column public.quote_results.status is
  'pending | running | success | no_offer | company_error | sbm_error | timeout | cancelled | Aktif | Seçildi | Teklif Yok';
comment on column public.quote_results.source_type   is 'demo | manual | api | robot | gateway';
comment on column public.quote_results.provider_name is 'InsurGateway, Allianz API, InsureBot, Manual, Demo';
comment on column public.quote_results.error_source  is 'SBM | COMPANY | SYSTEM | TIMEOUT';
comment on column public.quote_results.error_code    is 'Şirket/SBM hata kodu, örn: BRV-OVM-POLICE-00358';
comment on column public.quote_results.action_hint   is 'Operatöre gösterilecek öneri';

-- ─── Yeni indexler ──────────────────────────────────────────
create index if not exists idx_quote_results_status      on public.quote_results(status);
create index if not exists idx_quote_results_source_type on public.quote_results(source_type);
create index if not exists idx_quote_runs_provider_type  on public.quote_runs(provider_type);
