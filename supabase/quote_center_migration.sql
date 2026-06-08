-- ============================================================
-- PolicePilot — Teklif Merkezi Tabloları
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- ─── quote_runs ─────────────────────────────────────────────
create table if not exists public.quote_runs (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid references public.agencies(id) on delete cascade not null,
  customer_id     uuid references public.customers(id) on delete set null,
  request_id      uuid references public.requests(id) on delete set null,

  -- Ürün bilgisi
  product_type    text not null,         -- Trafik, Kasko, İMM, DASK, Konut, TSS, Ferdi Kaza, Özel Sağlık, Seyahat
  product_data    jsonb default '{}',    -- Ürüne göre değişen alanlar (plaka, marka, yaş, vb.)

  -- Müşteri özeti (customer silinse bile saklansın)
  customer_name   text,
  customer_phone  text,
  customer_email  text,
  customer_tc     text,

  -- Akış durumu
  status          text not null default 'Yeni',
  -- Yeni | Teklif Verildi | Müşteri Düşünüyor | Kazanıldı | Kaybedildi

  -- Kazanılan teklif
  won_result_id   uuid,                  -- quote_results.id (FK set after results inserted)

  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── quote_results ──────────────────────────────────────────
create table if not exists public.quote_results (
  id              uuid primary key default gen_random_uuid(),
  quote_run_id    uuid references public.quote_runs(id) on delete cascade not null,
  company_name    text not null,
  price           numeric,
  installment     text,      -- "Peşin", "12 taksit", "3 taksit", vb.
  note            text,
  status          text default 'Aktif',  -- Aktif | Seçildi | Reddedildi
  created_at      timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────────
create index if not exists idx_quote_runs_agency    on public.quote_runs(agency_id);
create index if not exists idx_quote_runs_customer  on public.quote_runs(customer_id);
create index if not exists idx_quote_runs_status    on public.quote_runs(status);
create index if not exists idx_quote_results_run    on public.quote_results(quote_run_id);

-- ─── RLS ────────────────────────────────────────────────────
alter table public.quote_runs    enable row level security;
alter table public.quote_results enable row level security;

-- Kullanıcılar sadece kendi acentelerinin kayıtlarını görebilir
create policy "quote_runs_agency_isolation" on public.quote_runs
  using (
    agency_id = (
      select (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

create policy "quote_results_agency_isolation" on public.quote_results
  using (
    quote_run_id in (
      select id from public.quote_runs
      where agency_id = (
        select (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
      )
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
  );

-- ─── updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quote_runs_updated_at on public.quote_runs;
create trigger trg_quote_runs_updated_at
  before update on public.quote_runs
  for each row execute function public.set_updated_at();
