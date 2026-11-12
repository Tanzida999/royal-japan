alter type public.app_role add value if not exists 'manager';

alter table public.profiles add column email text, add column disabled boolean not null default false;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles r where r.user_id = _user_id and r.role = _role)
  and not exists (select 1 from public.profiles p where p.id = _user_id and p.disabled) $$;

create or replace function public.check_staff_code(_code text) returns text
language plpgsql stable security definer set search_path = public as $$
declare n text;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select p.name into n from profiles p where p.staff_code = upper(trim(_code)) and not p.disabled
    and exists (select 1 from user_roles r where r.user_id = p.id);
  if n is null then raise exception 'Wrong staff code: %', _code; end if;
  return n;
end $$;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  staff_code text,
  shop_id uuid,
  action text not null,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  device text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_record_idx on public.audit_log(record_id);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "owner reads audit log" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'owner'));

create or replace function public.audit_block_change() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Audit log cannot be changed'; end $$;
create trigger audit_log_immutable before update or delete on public.audit_log for each row execute function public.audit_block_change();
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function public.audit_block_change();

create or replace function public.request_device() returns text language sql stable set search_path = public as $$
  select left(coalesce(nullif(current_setting('request.headers', true), '')::json->>'user-agent', ''), 300)
$$;

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end; n jsonb := to_jsonb(new); pr public.profiles; rid text; sid uuid;
begin
  if tg_op = 'UPDATE' and o = n then return new; end if;
  select * into pr from profiles where id = auth.uid();
  rid := coalesce(n->>'id', n->>'product_id');
  sid := coalesce(nullif(n->>'current_shop_id','')::uuid, nullif(n->>'shop_id','')::uuid, nullif(n->>'to_shop_id','')::uuid,
    case when tg_table_name = 'shops' then (n->>'id')::uuid end);
  if sid is null and n ? 'product_id' then select current_shop_id into sid from products where id = (n->>'product_id')::uuid; end if;
  insert into audit_log (user_id, user_name, staff_code, shop_id, action, table_name, record_id, old_values, new_values, device)
  values (auth.uid(), pr.name, coalesce(n->>'staff_code', pr.staff_code), sid, lower(tg_op), tg_table_name, rid, o, n, request_device());
  return new;
end $$;

create trigger audit_products after insert or update on public.products for each row execute function public.audit_row();
create trigger audit_product_costs after insert or update on public.product_costs for each row execute function public.audit_row();
create trigger audit_product_photos after insert or update on public.product_photos for each row execute function public.audit_row();
create trigger audit_sales after insert or update on public.sales for each row execute function public.audit_row();
create trigger audit_transfers after insert or update on public.transfers for each row execute function public.audit_row();
create trigger audit_profiles after insert or update on public.profiles for each row execute function public.audit_row();
create trigger audit_shops after insert or update on public.shops for each row execute function public.audit_row();

-- events from signed-in users
create or replace function public.log_event(_action text, _table text, _record_id text, _details jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  if _action not in ('login','logout','receipt_reprinted','label_printed','password_changed') then raise exception 'Unknown action'; end if;
  select * into pr from profiles where id = auth.uid();
  insert into audit_log (user_id, user_name, staff_code, shop_id, action, table_name, record_id, new_values, device)
  values (auth.uid(), pr.name, pr.staff_code, coalesce(nullif(_details->>'shop_id','')::uuid, pr.shop_id), _action, left(_table,50), left(_record_id,100), _details, request_device());
end $$;

-- events written by trusted server code (failed login, reset requests, invites, disable/enable)
create or replace function public.log_admin_event(_actor uuid, _email text, _action text, _record_id text, _details jsonb, _device text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := _actor; pr public.profiles;
begin
  if uid is null and _email is not null then select id into uid from auth.users where lower(email) = lower(trim(_email)) limit 1; end if;
  select * into pr from profiles where id = uid;
  insert into audit_log (user_id, user_name, staff_code, shop_id, action, table_name, record_id, new_values, device)
  values (uid, pr.name, pr.staff_code, pr.shop_id, _action, 'auth', _record_id, coalesce(_details,'{}'::jsonb) || jsonb_build_object('email', lower(trim(coalesce(_email,'')))), left(coalesce(_device,''),300));
end $$;

revoke execute on function public.audit_row(), public.audit_block_change(), public.log_admin_event(uuid,text,text,text,jsonb,text), public.request_device() from public, anon, authenticated;
revoke execute on function public.log_event(text,text,text,jsonb) from public, anon;
grant execute on function public.log_event(text,text,text,jsonb) to authenticated;
grant execute on function public.log_admin_event(uuid,text,text,text,jsonb,text) to service_role;