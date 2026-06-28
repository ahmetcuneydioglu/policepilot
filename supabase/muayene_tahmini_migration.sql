-- ============================================================================
-- Araç Muayene — "tahmini" bayrağı (Faz 2.5 backfill)
-- ----------------------------------------------------------------------------
-- customers.muayene_tahmini:
--   • true  → muayene_bitis model yılından TAHMİN edildi (geriye dönük backfill).
--             UI "Tahmini" rozeti gösterir; acente müşteriden kesin tarihi almalı.
--   • false → kesin/teyitli (OCR tescil tarihinden hesaplandı VEYA elle girildi).
--
-- Çalıştırma: Supabase SQL editöründe (idempotent). DEPLOY'dan ÖNCE.
-- ============================================================================

alter table public.customers
  add column if not exists muayene_tahmini boolean not null default false;

comment on column public.customers.muayene_tahmini is
  'muayene_bitis tahmini mi (model yılından backfill) — true ise müşteriden kesin tarih alınmalı';
