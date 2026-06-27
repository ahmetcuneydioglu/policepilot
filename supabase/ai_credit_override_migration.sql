-- ============================================================================
-- AI Kredisi limiti — acente bazlı manuel override (Süper Admin)
-- ----------------------------------------------------------------------------
-- agencies.max_ai_credits:
--   • null  → plan_catalog tabanı geçerli (Starter 100 · Pro 1.000 · Enterprise 10.000)
--             + aktif eklentiler. (Mevcut davranış birebir korunur.)
--   • dolu  → bu değer taban olur (+ aktif eklentiler) — legacy max_* gibi authoritative.
--
-- Çalıştırma: Supabase SQL editöründe çalıştırın (idempotent). DEPLOY'dan ÖNCE.
-- ============================================================================

alter table public.agencies
  add column if not exists max_ai_credits int;
