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
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers(id) on delete cascade,
  policy_type       text not null,
  start_date        date not null,
  end_date          date not null,
  status            text not null default 'Aktif'
                    check (status in ('Aktif', 'Pasif')),
  agency_id         uuid references auth.users(id) on delete set null,
  premium           numeric(12, 2),
  insurance_company text,
  policy_no         text,
  commission        numeric(12, 2),
  note              text,
  created_at        timestamptz not null default now()
);

-- Mevcut tabloya eksik kolonları ekle (ALTER — tablo zaten varsa)
alter table public.policies add column if not exists agency_id         uuid references auth.users(id) on delete set null;
alter table public.policies add column if not exists premium           numeric(12, 2);
alter table public.policies add column if not exists insurance_company text;
alter table public.policies add column if not exists policy_no         text;
alter table public.policies add column if not exists commission        numeric(12, 2);
alter table public.policies add column if not exists note              text;

-- ─── documents ────────────────────────────────────────────────────────────────
-- Müşteri, talep ve poliçelere eklenebilen dosya/evrak kayıtları.
-- Gerçek dosyalar Supabase Storage "documents" bucket'ında tutulur.
-- Hem mobil hem web tarafından kullanılacak ortak tablo.
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid,                          -- acente filtresi (FK yok — agencies tablosuna referans)
  customer_id  uuid references public.customers(id) on delete cascade,
  request_id   uuid references public.requests(id)  on delete cascade,
  policy_id    uuid references public.policies(id)  on delete cascade,
  file_name    text not null,
  file_path    text not null,       -- Storage içindeki yol
  file_type    text not null,       -- MIME tipi
  file_size    bigint,              -- Byte cinsinden boyut
  bucket       text not null default 'documents',
  uploaded_by  uuid,                -- auth.uid()
  created_at   timestamptz not null default now()
);

alter table public.documents enable row level security;

-- Giriş yapmış herkes kendi acentesinin dokümanlarını görebilir
create policy "auth read documents"
  on public.documents for select
  using (auth.uid() is not null);

-- Giriş yapmış herkes ekleyebilir
create policy "auth insert documents"
  on public.documents for insert
  with check (auth.uid() is not null);

-- Yükleyen kullanıcı silebilir
create policy "uploader delete documents"
  on public.documents for delete
  using (auth.uid() = uploaded_by);

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

-- ─── agencies ─────────────────────────────────────────────────────────────────
-- Acente kayıtları. Web panelinde oluşturulur, mobil super_admin tarafından yönetilir.
create table if not exists public.agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  logo_url      text,
  phone         text,
  email         text,
  website       text,
  primary_color text not null default '#2563eb',
  is_active     boolean not null default true,
  plan          text not null default 'starter'
                check (plan in ('starter', 'pro', 'enterprise')),
  expires_at    timestamptz,
  max_users     integer not null default 20,
  max_customers integer not null default 200,
  max_requests  integer not null default 500,
  max_policies  integer not null default 500,
  created_at    timestamptz not null default now()
);

alter table public.agencies enable row level security;

-- super_admin: tüm acenteleri görür / düzenler / siler
-- agency_user: yalnızca kendi acentesini görür
create policy "agencies select"
  on public.agencies for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
    or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and agency_id = agencies.id
    )
  );

create policy "agencies insert"
  on public.agencies for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "agencies update"
  on public.agencies for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

create policy "agencies delete"
  on public.agencies for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- profiles tablosu RLS (kullanıcı yönetimi için)
-- super_admin tüm profilleri görebilir ve agency_id güncelleyebilir
alter table public.profiles enable row level security;

create policy "profiles select"
  on public.profiles for select
  using (
    auth.uid() = id
    or
    exists (
      select 1 from public.profiles p2
      where p2.id = auth.uid() and p2.role = 'super_admin'
    )
  );

create policy "profiles insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles update"
  on public.profiles for update
  using (
    auth.uid() = id
    or
    exists (
      select 1 from public.profiles p2
      where p2.id = auth.uid() and p2.role = 'super_admin'
    )
  );

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
