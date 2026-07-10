-- ════════════════════════════════════════════════════════════════════════════
-- SigortaOS — Poliçe Yönetimi dönüşümü (Poliçe Kes → Poliçe Kaydet)
-- Statü sözlüğü genişletme + kaynak (source) standardizasyonu.
-- Idempotent: tekrar çalıştırılabilir.
--
-- Statü modeli:
--   Kayıtlı: Taslak | Teklif Hazırlanıyor | Şirkette Kesildi | Aktif | İptal
--   Legacy : Pasif (eski kayıtlar), Yenilendi (renewal akışı)
--   Türetilmiş (DB'de YOK): "Süresi Doldu" = Aktif + end_date < bugün (UI hesaplar)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) status CHECK constraint'ini genişlet ──────────────────────────────────
-- (schema.sql'deki inline check → otomatik ad policies_status_check)
alter table public.policies drop constraint if exists policies_status_check;
alter table public.policies add constraint policies_status_check
  check (status in ('Taslak','Teklif Hazırlanıyor','Şirkette Kesildi','Aktif','Pasif','İptal','Yenilendi'));

-- ── 2) source standardizasyonu: manual | ocr | api (+ legacy quote_flow/demo) ─
update public.policies set source = 'ocr' where source = 'ocr_upload';
alter table public.policies alter column source set default 'manual';

comment on column public.policies.source is
  'Poliçenin oluşturulma kaynağı: manual (elle kayıt) | ocr (PDF/görsel OCR) | api (ileride şirket API entegrasyonu) | legacy: demo/quote_flow/robot';
comment on column public.policies.status is
  'Taslak | Teklif Hazırlanıyor | Şirkette Kesildi | Aktif | İptal (+legacy Pasif/Yenilendi). "Süresi Doldu" saklanmaz — Aktif+end_date<bugün olarak türetilir.';
