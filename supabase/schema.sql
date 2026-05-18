-- PoliçePilot — Supabase Schema
-- Supabase SQL Editor'da çalıştırın

-- ─── customers ────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  insurance_type text not null,
  note          text,
  created_at    timestamptz not null default now()
);

-- ─── requests ─────────────────────────────────────────────────────────────────
create table if not exists public.requests (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  request_type  text not null,
  status        text not null default 'Yeni'
                check (status in ('Yeni', 'İşlemde', 'Tamamlandı', 'İptal')),
  price_offer   numeric(12, 2),
  created_at    timestamptz not null default now()
);

-- ─── policies ─────────────────────────────────────────────────────────────────
create table if not exists public.policies (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  policy_type   text not null,
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'Aktif'
                check (status in ('Aktif', 'Pasif')),
  created_at    timestamptz not null default now()
);

-- ─── RLS — demo için açık politikalar ─────────────────────────────────────────
-- Üretimde auth.uid() bazlı kısıtlamalar ekleyin.

alter table public.customers enable row level security;
alter table public.requests  enable row level security;
alter table public.policies  enable row level security;

create policy "public read customers"  on public.customers for select using (true);
create policy "public insert customers" on public.customers for insert with check (true);
create policy "public update customers" on public.customers for update using (true);
create policy "public delete customers" on public.customers for delete using (true);

create policy "public read requests"   on public.requests  for select using (true);
create policy "public insert requests"  on public.requests  for insert with check (true);
create policy "public update requests"  on public.requests  for update using (true);
create policy "public delete requests"  on public.requests  for delete using (true);

create policy "public read policies"   on public.policies  for select using (true);
create policy "public insert policies"  on public.policies  for insert with check (true);
create policy "public update policies"  on public.policies  for update using (true);
create policy "public delete policies"  on public.policies  for delete using (true);

-- ─── Örnek seed verisi ────────────────────────────────────────────────────────
insert into public.customers (name, phone, insurance_type, note) values
  ('Ahmet Yılmaz',  '0532 123 45 67', 'Kasko',  'Haziran başında yenileme istiyor.'),
  ('Fatma Kaya',    '0541 234 56 78', 'Konut',  null),
  ('Mehmet Demir',  '0555 345 67 89', 'Sağlık', 'Aile poliçesi düşünüyor.'),
  ('Ayşe Çelik',   '0506 456 78 90', 'Trafik', null),
  ('Mustafa Şahin', '0533 567 89 01', 'Kasko',  null);

insert into public.requests (customer_id, request_type, status, price_offer)
select id, 'Kasko', 'Yeni', 4850.00 from public.customers where name = 'Ahmet Yılmaz'
union all
select id, 'Konut', 'İşlemde', 2200.00 from public.customers where name = 'Fatma Kaya'
union all
select id, 'Sağlık', 'Tamamlandı', 8600.00 from public.customers where name = 'Mehmet Demir'
union all
select id, 'Kasko', 'Yeni', null from public.customers where name = 'Mustafa Şahin';

insert into public.policies (customer_id, policy_type, start_date, end_date, status)
select id, 'Kasko', DATE '2025-05-20', DATE '2026-05-20', 'Aktif' from public.customers where name = 'Ahmet Yılmaz'
union all
select id, 'Konut', DATE '2025-06-01', DATE '2026-06-01', 'Aktif' from public.customers where name = 'Fatma Kaya'
union all
select id, 'Trafik', DATE '2025-05-18', DATE '2026-05-18', 'Aktif' from public.customers where name = 'Ayşe Çelik'
union all
select id, 'Kasko', DATE '2025-07-10', DATE '2026-07-10', 'Aktif' from public.customers where name = 'Mustafa Şahin';
