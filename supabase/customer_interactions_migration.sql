-- ════════════════════════════════════════════════════════════════════════════
-- SigortaOS — Insurance Relationship Management Faz 1
-- customer_interactions (görüşme/ilişki kaydı) + customers.tags (müşteri analizi)
-- RLS: f1_scoped_rls kalıbı (auth_agency_id / auth_is_super mevcut olmalı).
-- Idempotent: tekrar çalıştırılabilir.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Görüşme / ilişki olayları ─────────────────────────────────────────────
create table if not exists public.customer_interactions (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null,
  customer_id   uuid not null references public.customers(id) on delete cascade,

  -- Kim + ne zaman
  staff_id      uuid,
  staff_name    text,                                  -- denormalize: personel ayrılsa da tarih korunur
  occurred_at   timestamptz not null default now(),

  -- Tür: manuel görüşme mi, sistem olayı mı
  kind          text not null default 'manual',        -- 'manual' | 'auto'
  auto_source   text,                                  -- policy_created | quote_created | document_uploaded
                                                       -- | whatsapp_sent | renewal_reminder | ai_summary

  -- Görüşme detayı (manuel)
  channel       text,                                  -- phone | whatsapp | face_to_face | email | video | sms | other
  location      text,                                  -- office | customer_home | workplace | hospital | cafe | online | other
  location_note text,
  product       text,                                  -- Trafik | Kasko | TSS | Özel Sağlık | DASK | Konut | Seyahat | Ferdi Kaza | Diğer
  outcome       text,                                  -- teklif_bekliyor | dusunuyor | ilgilenmedi | rakip_teklif
                                                       -- | tekrar_ara | policelesti | iptal
  note          text,

  -- Sonraki aksiyon (görev motoruna akar)
  next_action      text,                               -- call | send_quote | whatsapp | visit | reminder
  next_action_date date,
  next_action_done boolean not null default false,

  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists ci_customer_time_idx on public.customer_interactions (customer_id, occurred_at desc);
create index if not exists ci_agency_time_idx   on public.customer_interactions (agency_id, occurred_at desc);
create index if not exists ci_staff_idx         on public.customer_interactions (staff_id);
create index if not exists ci_next_action_idx   on public.customer_interactions (agency_id, next_action_date)
  where next_action is not null and next_action_done = false;

-- ── 2) RLS ──────────────────────────────────────────────────────────────────
alter table public.customer_interactions enable row level security;

drop policy if exists "scoped read interactions"   on public.customer_interactions;
drop policy if exists "scoped insert interactions" on public.customer_interactions;
drop policy if exists "scoped update interactions" on public.customer_interactions;
drop policy if exists "scoped delete interactions" on public.customer_interactions;

create policy "scoped read interactions" on public.customer_interactions for select
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );

create policy "scoped insert interactions" on public.customer_interactions for insert
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );

create policy "scoped update interactions" on public.customer_interactions for update
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() )
  with check ( public.auth_is_super() or agency_id = public.auth_agency_id() );

create policy "scoped delete interactions" on public.customer_interactions for delete
  using ( public.auth_is_super() or agency_id = public.auth_agency_id() );

-- ── 3) Müşteri analizi etiketleri + AI ilişki özeti cache ────────────────────
alter table public.customers add column if not exists tags text[] not null default '{}';
alter table public.customers add column if not exists relationship_summary text;
alter table public.customers add column if not exists relationship_summary_at timestamptz;

create index if not exists customers_tags_idx on public.customers using gin (tags);
