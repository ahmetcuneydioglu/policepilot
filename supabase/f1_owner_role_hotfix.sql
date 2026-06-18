-- ============================================================
-- SigortaOS — F1 HOTFIX: yeni acente sahibi 'viewer' kalma bug'ı
-- F1 migration agency_role default'unu yanlışlıkla 'viewer' yapmıştı →
-- yeni acente sahibi müşteri/poliçe ekleyemiyordu. Geri alıyoruz + mevcut
-- kırılan sahipleri düzeltiyoruz. Supabase SQL Editor'da çalıştırın.
-- ============================================================

-- 1) Default'u geri 'owner' yap (yeni acente sahibi profili buna dayanır).
alter table public.profiles alter column agency_role set default 'owner';

-- 2) ÖNCE BAK — kimler etkilenmiş? (tek kullanıcılı acentenin 'viewer' kullanıcısı = kırılan sahip)
select a.id as agency_id, a.name as acente, p.id as profile_id, p.full_name, p.agency_role,
       (select count(*) from public.profiles pp where pp.agency_id = a.id) as acente_kullanici_sayisi
from public.agencies a
join public.profiles p on p.agency_id = a.id
where p.agency_role = 'viewer'
order by a.name;

-- 3) Yukarıdaki listede SADECE kırılan yeni sahip(ler) görünüyorsa düzelt:
--    (tek kullanıcılı acentenin viewer'ı = sahip; gerçek sub-user viewer'lara dokunmaz)
update public.profiles p
set agency_role = 'owner'
where p.agency_role = 'viewer'
  and (select count(*) from public.profiles pp where pp.agency_id = p.agency_id) = 1;

-- Doğrulama: artık 'viewer' kalan tek-kullanıcılı acente olmamalı.
