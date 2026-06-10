-- ============================================================
-- PolicePilot — Yenileme Tamamlanma Düzeltmesi Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- 1. policies.status check constraint'ine 'Yenilendi' eklenir
-- 2. Geçmişte poliçeleştirildiği halde "quoted"da takılı kalan
--    yenileme kayıtları backfill edilir (ör. Murat Sakallı senaryosu)
-- ============================================================

-- ─── 1. status constraint: 'Yenilendi' değerine izin ver ─────
alter table public.policies
  drop constraint if exists policies_status_check;

alter table public.policies
  add constraint policies_status_check
  check (status in ('Aktif', 'Pasif', 'Yenilendi'));

-- ─── 2a. Yeni poliçelere renewed_from_policy_id backfill ─────
-- Bug nedeniyle quote_runs.renewal_of_policy_id dolu olduğu halde
-- yeni poliçeye renewed_from_policy_id yazılmamıştı.
update public.policies p_new
set renewed_from_policy_id = qr.renewal_of_policy_id
from public.quote_runs qr
where p_new.quote_run_id = qr.id
  and qr.renewal_of_policy_id is not null
  and p_new.renewed_from_policy_id is null;

-- ─── 2b. Eski poliçeleri kapat ───────────────────────────────
-- Yenilemesi poliçeleşmiş ama hâlâ completed olmayan eski kayıtlar
update public.policies p_old
set renewal_status = 'completed',
    status         = 'Yenilendi',
    renewed_at     = coalesce(p_new.issued_at, now())
from public.policies p_new
where p_new.renewed_from_policy_id = p_old.id
  and p_old.renewal_status is distinct from 'completed';
