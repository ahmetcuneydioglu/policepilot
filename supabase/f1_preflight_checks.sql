-- ============================================================
-- SigortaOS — F1 PRE-FLIGHT TEŞHİS (yalnız SELECT, hiçbir şey değiştirmez)
-- F1 migration'ından ÖNCE çalıştırın; çıktıları kaydedin.
-- ============================================================

-- 1) Mevcut RLS politikaları — açık using(true)/with_check(true) olanları görün.
--    (data_scope_rls_migration canlıda çalışmış mı da buradan anlaşılır:
--     customers/policies SELECT için "scoped read" yoksa, okuma da hâlâ açıktır.)
select tablename, policyname, cmd,
       qual        as using_expr,
       with_check  as check_expr
from pg_policies
where schemaname = 'public'
  and tablename in ('customers','requests','policies')
order by tablename, cmd, policyname;

-- 2) Backfill boyutu — NULL sayımları.
select 'customers.agency_id NULL'  as metric, count(*) as adet from public.customers where agency_id is null
union all select 'customers.created_by NULL', count(*) from public.customers where created_by is null
union all select 'policies.agency_id NULL',   count(*) from public.policies  where agency_id is null
union all select 'policies.created_by NULL',  count(*) from public.policies  where created_by is null
union all select 'policies.agency_id NULL ama customer.agency dolu (BACKFILL edilebilir)', count(*)
  from public.policies p join public.customers c on c.id = p.customer_id
  where p.agency_id is null and c.agency_id is not null
union all select 'customers.agency_id NULL (TÜRETİLEMEZ — manuel incele)', count(*)
  from public.customers where agency_id is null;

-- 3) agency_role dağılımı — owner fail-open kontrolü. <NULL> ÇIKMAMALI (NOT NULL).
select coalesce(agency_role, '<NULL>') as agency_role, count(*) as adet
from public.profiles
group by 1
order by 2 desc;
