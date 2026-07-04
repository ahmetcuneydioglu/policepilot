-- ════════════════════════════════════════════════════════════════════════════
-- SigortaOS — IRM Faz 2: Otomatik ilişki olayları (DB trigger'ları)
-- Poliçe / Fırsat / Evrak / WhatsApp olayları KAYNAĞI NE OLURSA OLSUN
-- (web, mobil, cron, public form) customer_interactions'a otomatik düşer.
-- Idempotent: tekrar çalıştırılabilir. Ön koşul: customer_interactions_migration.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Poliçe kesildi ────────────────────────────────────────────────────────
create or replace function public.irm_on_policy_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  v_agency := new.agency_id;
  if v_agency is null then
    select agency_id into v_agency from customers where id = new.customer_id;
  end if;
  if v_agency is null or new.customer_id is null then return new; end if;

  insert into customer_interactions
    (agency_id, customer_id, kind, auto_source, product, note, occurred_at, metadata)
  values
    (v_agency, new.customer_id, 'auto', 'policy_created',
     new.policy_type,
     nullif(concat_ws(' · ', new.insurance_company, new.policy_no), ''),
     coalesce(new.created_at, now()),
     jsonb_build_object('policy_id', new.id));
  return new;
exception when others then
  return new;  -- olay kaydı ana akışı ASLA düşürmez
end $$;

drop trigger if exists irm_policy_insert on public.policies;
create trigger irm_policy_insert
  after insert on public.policies
  for each row execute function public.irm_on_policy_insert();

-- ── 2) Fırsat açıldı ─────────────────────────────────────────────────────────
create or replace function public.irm_on_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  v_agency := new.agency_id;
  if v_agency is null then
    select agency_id into v_agency from customers where id = new.customer_id;
  end if;
  if v_agency is null or new.customer_id is null then return new; end if;

  insert into customer_interactions
    (agency_id, customer_id, kind, auto_source, product, note, occurred_at, metadata)
  values
    (v_agency, new.customer_id, 'auto', 'quote_created',
     new.request_type, new.status,
     coalesce(new.created_at, now()),
     jsonb_build_object('request_id', new.id));
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists irm_request_insert on public.requests;
create trigger irm_request_insert
  after insert on public.requests
  for each row execute function public.irm_on_request_insert();

-- ── 3) Evrak yüklendi (müşteriye bağlıysa) ───────────────────────────────────
create or replace function public.irm_on_document_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  if new.customer_id is null then return new; end if;
  v_agency := new.agency_id;
  if v_agency is null then
    select agency_id into v_agency from customers where id = new.customer_id;
  end if;
  if v_agency is null then return new; end if;

  insert into customer_interactions
    (agency_id, customer_id, kind, auto_source, note, occurred_at, metadata)
  values
    (v_agency, new.customer_id, 'auto', 'document_uploaded',
     nullif(concat_ws(' · ', new.doc_type, new.file_name), ''),
     coalesce(new.created_at, now()),
     jsonb_build_object('document_id', new.id));
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists irm_document_insert on public.documents;
create trigger irm_document_insert
  after insert on public.documents
  for each row execute function public.irm_on_document_insert();

-- ── 4) WhatsApp gönderildi (müşteri telefonla eşlenir — son 10 hane) ─────────
create or replace function public.irm_on_whatsapp_sent()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_customer uuid;
begin
  -- yalnız 'sent'e GEÇİŞTE (insert-sent ya da update pending→sent) tek kayıt
  if new.status <> 'sent' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'sent' then return new; end if;

  select id into v_customer from customers
   where agency_id = new.agency_id
     and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
       = right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10)
     and length(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')) >= 10
   limit 1;
  if v_customer is null then return new; end if;

  insert into customer_interactions
    (agency_id, customer_id, kind, auto_source, note, occurred_at, metadata)
  values
    (new.agency_id, v_customer, 'auto', 'whatsapp_sent',
     left(new.message, 120),
     now(),
     jsonb_build_object('wa_queue_id', new.id, 'template_key', new.template_key));
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists irm_whatsapp_sent on public.whatsapp_queue;
create trigger irm_whatsapp_sent
  after insert or update of status on public.whatsapp_queue
  for each row execute function public.irm_on_whatsapp_sent();
