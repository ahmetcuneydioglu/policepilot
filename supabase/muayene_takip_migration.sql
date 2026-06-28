-- ============================================================================
-- Araç Muayene Takibi — Faz 1
-- ----------------------------------------------------------------------------
-- customers.muayene_bitis: aracın TÜVTÜRK muayene geçerlilik bitiş tarihi.
--   • Muayene ARACA/MÜŞTERİYE aittir (poliçeye değil) → customers tablosunda,
--     policy_end_date deseniyle özel kolon.
--   • NULL = muayene tarihi bilinmiyor (motor dışı sigortalarda doğal).
--   • Hatırlatma motoru bu kolonu tarih penceresiyle sorgular (yenileme gibi).
--
-- Çalıştırma: Supabase SQL editöründe (idempotent). DEPLOY'dan ÖNCE.
-- ============================================================================

alter table public.customers
  add column if not exists muayene_bitis date;

comment on column public.customers.muayene_bitis is
  'Araç muayene (TÜVTÜRK) geçerlilik bitiş tarihi — hatırlatma için (NULL = bilinmiyor)';

create index if not exists idx_customers_muayene_bitis
  on public.customers(muayene_bitis);
