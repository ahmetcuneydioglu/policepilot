-- ============================================================
-- PolicePilot — WhatsApp Kuyruğu Şablon Kolonları Migration
-- Supabase SQL Editor'da çalıştırın (idempotent)
--
-- Meta onaylı şablon (template) gönderimi için: 24 saat penceresi
-- gerektirmeden günlük özet gönderilebilmesi. Şablon yoksa kod düz
-- metne (mevcut davranış) düşer.
-- ============================================================

alter table public.whatsapp_queue
  add column if not exists template_name   text,
  add column if not exists template_params jsonb;

comment on column public.whatsapp_queue.template_name   is 'Meta onaylı şablon adı (ör. policepilot_daily_summary)';
comment on column public.whatsapp_queue.template_params is 'Şablon parametreleri: { languageCode, bodyParams[] }';
