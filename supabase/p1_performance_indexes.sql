-- ============================================================
-- SigortaOS — P1: Performans index paketi
-- Audit'te tespit edilen eksik index'ler (dashboard/liste/yenileme cron full-scan).
-- IDEMPOTENT (create index if not exists). Supabase SQL Editor'da çalıştırın.
-- Not: Büyük tablolarda kilitlenmeyi önlemek için ileride CREATE INDEX CONCURRENTLY
--      tercih edilebilir; mevcut veri hacminde düz create anlık tamamlanır.
-- ============================================================

-- ── policies — en sık filtrelenen kolonlar (şu an indexsiz) ─────────────────
-- agency_id: her dashboard/liste/cron bununla filtreler.
create index if not exists idx_policies_agency   on public.policies(agency_id);
-- customer_id: müşteri detay sayfası + müşteri silme (cascade) bununla join/filtre.
create index if not exists idx_policies_customer  on public.policies(customer_id);
-- (status, end_date): yenileme cron'unun kalbi — status='Aktif' AND end_date BETWEEN.
create index if not exists idx_policies_status_enddate on public.policies(status, end_date);

-- ── customers — mükerrer tespiti / arama (from-policy eşleştirmesi) ──────────
create index if not exists idx_customers_phone        on public.customers(phone);
create index if not exists idx_customers_identity_no  on public.customers(identity_no)
  where identity_no is not null;

-- ── requests — agency_id prod'da DRIFT olarak var (F2); kolon varsa index ekle ──
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'requests' and column_name = 'agency_id'
  ) then
    create index if not exists idx_requests_agency on public.requests(agency_id);
  end if;
end $$;

-- ── Doğrulama: yeni index'leri listele ──────────────────────────────────────
-- select indexname from pg_indexes
-- where schemaname='public' and tablename in ('policies','customers','requests')
-- order by tablename, indexname;
