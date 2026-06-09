-- ============================================================
-- PolicePilot — Poliçeleştirme Akışı Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
-- ============================================================

-- ─── quote_results: Poliçeleştirme alanları ─────────────────
alter table public.quote_results
  add column if not exists company_code      text,
  -- Şirket kısa kodu: ALZ, AXA, AND, HDI vs.
  add column if not exists can_issue_policy  boolean not null default false,
  -- Sadece status='success' olan satırlarda true olur
  add column if not exists expires_at        timestamptz,
  -- Teklifin geçerlilik süresi (demo: +30 gün)
  add column if not exists payment_status    text not null default 'pending',
  -- pending | paid | failed | refunded
  add column if not exists policy_status     text not null default 'pending';
  -- pending | issued | cancelled

comment on column public.quote_results.can_issue_policy is 'Bu satırdan poliçe kesilebilir mi?';
comment on column public.quote_results.expires_at       is 'Teklifin son geçerlilik tarihi';
comment on column public.quote_results.payment_status   is 'pending | paid | failed | refunded';
comment on column public.quote_results.policy_status    is 'pending | issued | cancelled';

-- ─── policies: Teklif & ödeme referans alanları ─────────────
alter table public.policies
  add column if not exists quote_result_id  uuid,
  -- quote_results.id FK (FK constraint ekleme: quote_results tablo oluşturma sırası)
  add column if not exists quote_run_id     uuid,
  -- quote_runs.id — hızlı join için
  add column if not exists transaction_id   text,
  -- Ödeme sağlayıcısından gelen işlem ID (kart bilgisi saklanmaz!)
  add column if not exists payment_method   text,
  -- Ödeme yöntemi: card | bank_transfer | cash
  add column if not exists issued_at        timestamptz,
  -- Poliçenin kesilme zamanı
  add column if not exists source           text not null default 'manual';
  -- manual | quote_flow | api | robot

comment on column public.policies.transaction_id is 'Sadece transaction ID saklanır — kart bilgisi kesinlikle saklanmaz!';
comment on column public.policies.source         is 'manual | quote_flow | api | robot';
comment on column public.policies.issued_at      is 'Poliçenin kesim zamanı';

-- ─── Yeni indexler ──────────────────────────────────────────
create index if not exists idx_quote_results_can_issue  on public.quote_results(can_issue_policy) where can_issue_policy = true;
create index if not exists idx_quote_results_pol_status on public.quote_results(policy_status);
create index if not exists idx_policies_quote_result    on public.policies(quote_result_id);
create index if not exists idx_policies_transaction     on public.policies(transaction_id);

-- ─── Mevcut başarılı teklifleri güncelle ────────────────────
-- Veritabanındaki mevcut 'success' / 'Aktif' / 'Seçildi' satırlarını işaretle
update public.quote_results
  set can_issue_policy = true,
      expires_at = now() + interval '30 days'
  where (status = 'success' or status = 'Aktif' or status = 'Seçildi')
    and can_issue_policy = false
    and price is not null;
