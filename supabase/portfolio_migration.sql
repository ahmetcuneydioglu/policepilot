-- ════════════════════════════════════════════════════════════════════════════
-- SigortaOS — PORTFÖY Faz 1 (İki Dünya mimarisi, uzun satış döngüsü)
-- accounts (kurumsal hesaplar) + deals (Satış Hattı) + deal_stage_events
-- + customers.account_id/title + customer_interactions.deal_id
-- RLS: f1_scoped_rls kalıbı (auth_agency_id / auth_is_super mevcut olmalı).
-- Idempotent: tekrar çalıştırılabilir.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Kurumsal hesaplar (Acıbadem, X Fabrikası…) ────────────────────────────
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null,
  name        text not null,
  kind        text not null default 'sirket',   -- hastane | fabrika | sirket | okul | diger
  city        text,
  phone       text,
  note        text,
  owner_id    uuid,                              -- sorumlu personel
  owner_name  text,                              -- denormalize: personel ayrılsa da rapor bozulmaz
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists accounts_agency_idx on public.accounts (agency_id, name);

alter table public.accounts enable row level security;

drop policy if exists "scoped read accounts"   on public.accounts;
drop policy if exists "scoped insert accounts" on public.accounts;
drop policy if exists "scoped update accounts" on public.accounts;
drop policy if exists "scoped delete accounts" on public.accounts;

create policy "scoped read accounts" on public.accounts for select
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped insert accounts" on public.accounts for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped update accounts" on public.accounts for update
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() )
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped delete accounts" on public.accounts for delete
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );

-- ── 2) Kişi → hesap bağı (Dr. Mehmet Kaya → Acıbadem) ────────────────────────
alter table public.customers add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.customers add column if not exists title text;   -- "Başhekim", "İK Müdürü"…

create index if not exists customers_account_idx on public.customers (account_id) where account_id is not null;

-- ── 3) Satış Hattı işleri (deals) ────────────────────────────────────────────
-- Aşamalar (stage): lead | ilk_gorusme | ihtiyac_analizi | teklif_hazirlaniyor
--   | teklif_gonderildi | takip | pazarlik | onay_bekliyor | policelesti | referans_kazanildi
-- status: open | lost  (Kaybedildi kolon değil, çıkıştır; kazanım = policelesti aşaması)
create table if not exists public.deals (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null,
  account_id        uuid references public.accounts(id)  on delete set null,
  customer_id       uuid references public.customers(id) on delete set null,
  title             text not null,
  product_interest  text not null default 'Diğer',   -- Hayat | BES | Kurumsal Sağlık | Grup Hayat | Diğer
  stage             text not null default 'lead',
  status            text not null default 'open',    -- open | lost
  owner_id          uuid,
  owner_name        text,                            -- denormalize
  expected_premium  numeric,
  currency          text not null default 'TRY',
  source            text,                            -- Referans | Soğuk Ziyaret | Telefon | Mevcut Müşteri | Diğer
  note              text,
  lost_reason       text,                            -- fiyat | rakip | vazgecti | ulasilamadi | diger
  policy_id         uuid,                            -- Poliçeleşti'de bağlanır
  stage_changed_at  timestamptz not null default now(),
  closed_at         timestamptz,
  updated_by        uuid,                            -- API (admin client) çağrılarında caller'ı taşır
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists deals_agency_stage_idx on public.deals (agency_id, status, stage);
create index if not exists deals_owner_idx        on public.deals (agency_id, owner_id);
create index if not exists deals_customer_idx     on public.deals (customer_id) where customer_id is not null;
create index if not exists deals_account_idx      on public.deals (account_id)  where account_id is not null;

alter table public.deals enable row level security;

drop policy if exists "scoped read deals"   on public.deals;
drop policy if exists "scoped insert deals" on public.deals;
drop policy if exists "scoped update deals" on public.deals;
drop policy if exists "scoped delete deals" on public.deals;

create policy "scoped read deals" on public.deals for select
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped insert deals" on public.deals for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped update deals" on public.deals for update
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() )
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );
create policy "scoped delete deals" on public.deals for delete
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );

-- ── 4) Aşama geçiş geçmişi (yönetici metriklerinin hammaddesi) ───────────────
-- Yalnız trigger yazar (SECURITY DEFINER); client'a insert policy'si YOK.
create table if not exists public.deal_stage_events (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null,
  deal_id     uuid not null references public.deals(id) on delete cascade,
  from_stage  text,
  to_stage    text not null,                     -- aşama anahtarı ya da 'kaybedildi'
  by_user_id  uuid,
  by_name     text,
  at          timestamptz not null default now()
);

create index if not exists dse_agency_time_idx on public.deal_stage_events (agency_id, at desc);
create index if not exists dse_deal_idx        on public.deal_stage_events (deal_id, at desc);

alter table public.deal_stage_events enable row level security;

drop policy if exists "scoped read deal events" on public.deal_stage_events;
create policy "scoped read deal events" on public.deal_stage_events for select
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );

-- ── 5) Trigger: aşama/kayıp geçişlerini otomatik logla ───────────────────────
create or replace function public.deal_stage_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_name text;
begin
  v_uid := coalesce(new.updated_by, auth.uid());
  if v_uid is not null then
    begin
      select full_name into v_name from public.profiles where id = v_uid;
    exception when others then v_name := null;
    end;
  end if;

  if tg_op = 'INSERT' then
    begin
      insert into public.deal_stage_events (agency_id, deal_id, from_stage, to_stage, by_user_id, by_name)
      values (new.agency_id, new.id, null, new.stage, coalesce(v_uid, new.created_by), v_name);
    exception when others then null;  -- log hatası işi asla düşürmesin
    end;
    return new;
  end if;

  -- UPDATE
  new.updated_at := now();

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'policelesti' then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
    begin
      insert into public.deal_stage_events (agency_id, deal_id, from_stage, to_stage, by_user_id, by_name)
      values (new.agency_id, new.id, old.stage, new.stage, v_uid, v_name);
    exception when others then null;
    end;
  end if;

  if new.status = 'lost' and old.status is distinct from 'lost' then
    new.closed_at := coalesce(new.closed_at, now());
    begin
      insert into public.deal_stage_events (agency_id, deal_id, from_stage, to_stage, by_user_id, by_name)
      values (new.agency_id, new.id, old.stage, 'kaybedildi', v_uid, v_name);
    exception when others then null;
    end;
  end if;

  -- Kayıptan geri açılırsa (yanlış tıklama telafisi) kapanışı temizle
  if new.status = 'open' and old.status = 'lost' then
    new.lost_reason := null;
    if new.stage <> 'policelesti' then new.closed_at := null; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deal_stage_log on public.deals;
create trigger trg_deal_stage_log
  before insert or update on public.deals
  for each row execute function public.deal_stage_log();

-- ── 6) Görüşme → iş bağı (İlişki omurgası TEK kalır) ─────────────────────────
alter table public.customer_interactions add column if not exists deal_id uuid references public.deals(id) on delete set null;

create index if not exists ci_deal_idx on public.customer_interactions (deal_id, occurred_at desc) where deal_id is not null;
