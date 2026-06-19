-- ============================================================================
-- SigortaOS — Satış Fırsatları (Sales Opportunities)
-- "requests" tablosu CRM satış-fırsatı modeline evrilir. TABLO ADI DEĞİŞMEZ
-- (POST/public-submit/quote_runs.request_id/RLS/limits/dashboard hepsi bağlı).
-- Yalnız: yeni kolonlar + statü remap + CHECK + index + updated_at trigger.
--
-- Idempotent — Supabase SQL Editor'da güvenle TEKRAR çalıştırılabilir.
-- ============================================================================

-- ── 1) Yeni kolonlar ────────────────────────────────────────────────────────
alter table public.requests add column if not exists agency_id           uuid;
alter table public.requests add column if not exists created_by          uuid;   -- fırsatı giren
alter table public.requests add column if not exists assigned_to         uuid;   -- SORUMLU personel (performans atfı)
alter table public.requests add column if not exists next_follow_up_date date;   -- sonraki takip tarihi
alter table public.requests add column if not exists notes               text;   -- serbest not
alter table public.requests add column if not exists policy_id           uuid;   -- "Poliçeye Dönüştür" sonucu bağlanan poliçe
alter table public.requests add column if not exists updated_at          timestamptz not null default now();

-- ── 2) Backfill — müşteriden agency_id/created_by, sonra assigned_to=created_by ──
update public.requests r
set agency_id = c.agency_id
from public.customers c
where r.customer_id = c.id and r.agency_id is null;

update public.requests r
set created_by = c.created_by
from public.customers c
where r.customer_id = c.id and r.created_by is null;

update public.requests r
set assigned_to = r.created_by
where r.assigned_to is null and r.created_by is not null;

-- ── 3) Eski statü CHECK'ini kaldır (Yeni/İşlemde/Tamamlandı/İptal) ───────────
alter table public.requests drop constraint if exists requests_status_check;

-- ── 4) Mevcut veriyi yeni satış aşamalarına eşle ────────────────────────────
update public.requests set status = 'Yeni Lead'          where status = 'Yeni';
update public.requests set status = 'İletişime Geçildi'  where status = 'İşlemde';
update public.requests set status = 'Kazanıldı'          where status = 'Tamamlandı';
update public.requests set status = 'Kaybedildi'         where status = 'İptal';

-- ── 5) Default + yeni CHECK (6 satış aşaması) ───────────────────────────────
alter table public.requests alter column status set default 'Yeni Lead';
alter table public.requests add constraint requests_status_check
  check (status in (
    'Yeni Lead', 'İletişime Geçildi', 'Teklif Hazırlanıyor',
    'Takip Ediliyor', 'Kazanıldı', 'Kaybedildi'
  ));

-- ── 6) Indexler ─────────────────────────────────────────────────────────────
create index if not exists idx_requests_agency      on public.requests(agency_id);
create index if not exists idx_requests_assigned_to on public.requests(assigned_to);
create index if not exists idx_requests_status      on public.requests(status);
create index if not exists idx_requests_created_by  on public.requests(created_by);

-- ── 7) updated_at otomatik güncelleme ───────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_requests_touch on public.requests;
create trigger trg_requests_touch
  before update on public.requests
  for each row execute function public.touch_updated_at();

-- ── Notlar ──────────────────────────────────────────────────────────────────
comment on column public.requests.assigned_to  is 'Sorumlu personel (profiles.id) — satış fırsatı performans atfı';
comment on column public.requests.policy_id    is 'Poliçeye Dönüştür ile bağlanan poliçe (policies.id)';
comment on column public.requests.status       is 'Satış aşaması: Yeni Lead | İletişime Geçildi | Teklif Hazırlanıyor | Takip Ediliyor | Kazanıldı | Kaybedildi';
comment on table  public.requests              is 'Satış Fırsatları (Sales Opportunities) — CRM satış hattı. UI ''Satış Fırsatı'' der; tablo adı geriye-uyum için requests kalmıştır.';
