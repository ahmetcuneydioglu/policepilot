-- ============================================================
-- PolicePilot — Yenileme Tamamlandı Mantığı Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ============================================================

-- ─── policies: yenileme durumu + ilişki alanları ─────────────
alter table public.policies
  add column if not exists renewal_status          text not null default 'pending',
  -- pending  → yenileme bekliyor (varsayılan)
  -- quoted   → yenileme için teklif çalışıldı
  -- completed→ teklif poliçeleştirildi, yenileme tamamlandı
  add column if not exists renewed_from_policy_id  uuid,
  -- Bu poliçe hangi eski poliçenin yenilemesi? (yeni poliçeye yazılır)
  add column if not exists renewed_at              timestamptz;
  -- Eski poliçenin yenilenme zamanı (completed olduğunda set edilir)

comment on column public.policies.renewal_status         is 'pending | quoted | completed';
comment on column public.policies.renewed_from_policy_id is 'Yeni poliçenin yenilediği eski poliçe id';
comment on column public.policies.renewed_at             is 'Eski poliçenin yenilenme tarihi';

-- ─── quote_runs: yenileme kaynağı ilişkisi ───────────────────
alter table public.quote_runs
  add column if not exists renewal_of_policy_id uuid;
  -- Bu teklif çalışması hangi poliçenin yenilemesi için açıldı?

comment on column public.quote_runs.renewal_of_policy_id is 'Yenileme akışından açıldıysa kaynak poliçe id';

-- ─── Indexler ────────────────────────────────────────────────
create index if not exists idx_policies_renewal_status on public.policies(renewal_status);
create index if not exists idx_policies_renewed_from   on public.policies(renewed_from_policy_id);
create index if not exists idx_quote_runs_renewal_of   on public.quote_runs(renewal_of_policy_id);

-- ─── Mevcut kayıtları backfill et ────────────────────────────
update public.policies set renewal_status = 'pending' where renewal_status is null;
