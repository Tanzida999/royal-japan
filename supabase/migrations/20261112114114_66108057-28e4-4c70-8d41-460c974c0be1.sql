create type public.app_role as enum ('owner','staff');

create table public.shops (id uuid primary key default gen_random_uuid(), name text not null unique,
  address text not null default '', postal_code text not null default '', phone text not null default '', email text not null default '', receipt_footer text not null default '', logo text);
grant select on public.shops to authenticated; grant all on public.shops to service_role;
alter table public.shops enable row level security;
create policy "auth read shops" on public.shops for select to authenticated using (true);

create sequence public.staff_seq;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  shop_id uuid references public.shops(id),
  staff_code text not null unique default ('STF-' || lpad(nextval('public.staff_seq')::text, 3, '0'))
);
grant select on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.my_shop_id() returns uuid language sql stable security definer set search_path = public
as $$ select shop_id from public.profiles where id = auth.uid() $$;

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "owner read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'owner'));
create policy "read own, same shop or owner profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'owner') or (shop_id is not null and shop_id = public.my_shop_id()));

create table public.models (id uuid primary key default gen_random_uuid(), brand text not null, model text not null, sort int not null default 0, unique (brand, model));
grant select on public.models to authenticated; grant all on public.models to service_role;
alter table public.models enable row level security;
create policy "auth read models" on public.models for select to authenticated using (true);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  imei text not null unique check (imei ~ '^[0-9]{15}$'),
  model_id uuid not null references public.models(id),
  color text not null,
  storage text not null,
  condition text not null check (condition in ('New','Used A','Used B','Used C')),
  selling_price integer not null check (selling_price >= 0),
  shop_id uuid not null references public.shops(id),
  current_shop_id uuid references public.shops(id),
  status text not null default 'in_stock' check (status in ('in_stock','in_transit','sold')),
  created_by uuid not null,
  staff_code text,
  carrier text,
  tracking_number text,
  created_at timestamptz not null default now()
);
grant select on public.products to authenticated; grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "auth read products" on public.products for select to authenticated using (true);

create table public.product_costs (
  product_id uuid primary key references public.products(id),
  purchase_price integer not null check (purchase_price >= 0),
  supplier text,
  created_by uuid not null,
  supplier_payment text not null default 'Cash',
  paid_amount integer,
  created_at timestamptz not null default now()
);
grant select on public.product_costs to authenticated; grant all on public.product_costs to service_role;
alter table public.product_costs enable row level security;
create policy "owner read costs" on public.product_costs for select to authenticated using (public.has_role(auth.uid(),'owner'));

create sequence public.receipt_seq;
create table public.receipts (id uuid primary key default gen_random_uuid(), receipt_no text not null unique default ('R-' || lpad(nextval('public.receipt_seq')::text,4,'0')), shop_id uuid not null references public.shops(id), sold_by uuid not null, staff_code text not null, staff_name text not null, customer_name text not null default '', customer_phone text not null default '', payment text not null check(payment in ('Cash','Card','PayPay','Bank')), subtotal integer not null check(subtotal>=0), discount integer not null default 0 check(discount>=0), total integer not null check(total>=0), paid integer not null check(paid>=0), change_due integer not null default 0 check(change_due>=0), shop_snapshot jsonb not null, items jsonb not null, created_at timestamptz not null default now());
grant select on public.receipts to authenticated; grant all on public.receipts to service_role;
alter table public.receipts enable row level security;
create policy "read receipts own shop or owner" on public.receipts for select to authenticated using (public.has_role(auth.uid(),'owner') or shop_id = public.my_shop_id());

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null default ('R-' || lpad(nextval('public.receipt_seq')::text, 4, '0')),
  receipt_id uuid references public.receipts(id),
  product_id uuid not null unique references public.products(id),
  item_price integer,
  sale_price integer not null check (sale_price >= 0),
  customer_name text,
  payment text not null check (payment in ('Cash','Card','PayPay','Bank')),
  shop_id uuid not null references public.shops(id),
  sold_by uuid not null,
  staff_code text,
  created_at timestamptz not null default now()
);
grant select on public.sales to authenticated; grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "read sales own shop or owner" on public.sales for select to authenticated using (public.has_role(auth.uid(), 'owner') or shop_id = public.my_shop_id());

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  from_shop_id uuid not null references public.shops(id),
  to_shop_id uuid not null references public.shops(id),
  status text not null default 'requested' check (status in ('requested','accepted','rejected','received','cancelled','expired')),
  requested_by uuid not null, accepted_by uuid, received_by uuid, reject_reason text,
  created_at timestamptz not null default now(), accepted_at timestamptz, received_at timestamptz,
  cancelled_by uuid, cancelled_at timestamptz, cancel_reason text
);
create unique index transfers_one_open on public.transfers(product_id) where status in ('requested','accepted');
grant select on public.transfers to authenticated; grant all on public.transfers to service_role;
alter table public.transfers enable row level security;
create policy "read transfers own shop or owner" on public.transfers for select to authenticated
  using (public.has_role(auth.uid(),'owner') or from_shop_id = public.my_shop_id() or to_shop_id = public.my_shop_id());

create table public.app_settings (id boolean primary key default true check (id), transit_limit_hours integer not null default 24 check (transit_limit_hours > 0 and transit_limit_hours <= 8760));
grant select on public.app_settings to authenticated; grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "authenticated settings read" on public.app_settings for select to authenticated using (true);

create table public.product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  url text not null unique,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);
create index product_photos_product_idx on public.product_photos(product_id);
grant select on public.product_photos to authenticated; grant all on public.product_photos to service_role;
alter table public.product_photos enable row level security;
create policy "auth read product photos" on public.product_photos for select to authenticated using (true);

-- triggers
create or replace function public.set_current_shop() returns trigger language plpgsql set search_path = public as $$
begin if new.current_shop_id is null then new.current_shop_id := new.shop_id; end if; return new; end $$;
create trigger products_set_current_shop before insert on public.products for each row execute function public.set_current_shop();

create or replace function public.guard_staff_product_shop() returns trigger language plpgsql set search_path=public as $$ begin
if auth.uid() is not null and not public.has_role(auth.uid(),'owner') and new.shop_id is distinct from public.my_shop_id() then raise exception 'Purchases must be for your assigned shop'; end if; return new; end $$;
create trigger enforce_purchase_shop before insert on public.products for each row execute function public.guard_staff_product_shop();

create or replace function public.guard_staff_sale_shop() returns trigger language plpgsql set search_path=public as $$ begin
if auth.uid() is not null and not public.has_role(auth.uid(),'owner') and new.shop_id is distinct from public.my_shop_id() then raise exception 'Sale must be at your assigned shop'; end if; return new; end $$;
create trigger enforce_sale_shop before insert on public.sales for each row execute function public.guard_staff_sale_shop();

create or replace function public.expire_transfer_on_write() returns trigger language plpgsql set search_path=public as $$ declare lim integer; begin
select coalesce((select transit_limit_hours from app_settings where id=true),24) into lim;
if old.status='requested' and old.created_at+make_interval(hours=>lim)<=now() and new.status not in ('expired','requested') then raise exception 'This request has expired'; end if; return new; end $$;
create trigger guard_expired_transfer before update on public.transfers for each row execute function public.expire_transfer_on_write();

-- functions
create or replace function public.check_staff_code(_code text) returns text
language plpgsql stable security definer set search_path = public as $$
declare n text;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select p.name into n from profiles p where p.staff_code = upper(trim(_code)) and exists (select 1 from user_roles r where r.user_id = p.id);
  if n is null then raise exception 'Wrong staff code: %', _code; end if;
  return n;
end $$;

create function public.add_product(_shop_id uuid, _model_id uuid, _imei text, _color text, _storage text, _condition text,
  _purchase_price integer, _selling_price integer, _supplier text, _staff_code text, _supplier_payment text, _paid_amount integer)
returns public.products language plpgsql security definer set search_path = public as $$
declare p public.products; code text := upper(trim(_staff_code)); paid integer;
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then raise exception 'Not allowed'; end if;
  perform check_staff_code(code);
  if _imei !~ '^[0-9]{15}$' then raise exception 'IMEI must be exactly 15 digits'; end if;
  if exists (select 1 from products where imei = _imei) then raise exception 'This IMEI is already registered'; end if;
  if _supplier_payment not in ('Cash','Bank','Due','Partial') then raise exception 'Invalid supplier payment'; end if;
  paid := case _supplier_payment when 'Due' then 0 when 'Partial' then greatest(0, least(coalesce(_paid_amount,0), _purchase_price)) else _purchase_price end;
  insert into products (product_code, imei, model_id, color, storage, condition, selling_price, shop_id, created_by, staff_code)
  values ('P' || right(_imei, 8), _imei, _model_id, trim(_color), trim(_storage), _condition, _selling_price, _shop_id, auth.uid(), code)
  returning * into p;
  insert into product_costs (product_id, purchase_price, supplier, created_by, supplier_payment, paid_amount)
  values (p.id, _purchase_price, nullif(trim(_supplier), ''), auth.uid(), _supplier_payment, paid);
  return p;
end $$;

create function public.add_products_bulk(_shop_id uuid, _supplier text, _staff_code text, _supplier_payment text, _paid_amount integer, _items jsonb)
returns setof public.products language plpgsql security definer set search_path = public as $$
declare it jsonb; p public.products; remaining integer := coalesce(_paid_amount,0); pp integer; mode text; part integer;
begin
  for it in select * from jsonb_array_elements(_items) loop
    pp := (it->>'purchase_price')::int;
    if _supplier_payment = 'Partial' then part := least(remaining, pp); remaining := remaining - part; mode := 'Partial';
    else part := null; mode := _supplier_payment; end if;
    p := public.add_product(_shop_id, (it->>'model_id')::uuid, it->>'imei', it->>'color', it->>'storage', it->>'condition',
      pp, (it->>'selling_price')::int, _supplier, _staff_code, mode, part);
    return next p;
  end loop;
end $$;

create or replace function public.complete_cart_sale(_shop_id uuid,_staff_code text,_items jsonb,_discount integer,_paid integer,_payment text,_customer_name text,_customer_phone text) returns public.receipts language plpgsql security definer set search_path=public as $$
declare r public.receipts; p public.products; sh public.shops; item jsonb; uid uuid:=auth.uid(); staff public.profiles; subtotal bigint:=0; total bigint; cumulative bigint:=0; before_net bigint; net integer; price integer; snap jsonb:='[]'::jsonb; count_items integer;
begin
if uid is null or not (has_role(uid,'owner') or has_role(uid,'staff')) then raise exception 'Not allowed'; end if;
perform check_staff_code(upper(trim(_staff_code)));
select * into staff from profiles where staff_code=upper(trim(_staff_code));
if not has_role(uid,'owner') and (_shop_id is distinct from my_shop_id() or staff.shop_id is distinct from my_shop_id()) then raise exception 'Sale must be at your assigned shop'; end if;
if staff.shop_id is not null and staff.shop_id is distinct from _shop_id then raise exception 'Staff badge belongs to another shop'; end if;
select * into sh from shops where id=_shop_id; if not found then raise exception 'Pick a shop'; end if;
if _payment is null or _payment not in ('Cash','Card','PayPay','Bank') then raise exception 'Invalid payment'; end if;
if jsonb_typeof(_items) is distinct from 'array' then raise exception 'Cart must contain items'; end if;
count_items:=jsonb_array_length(_items); if count_items<1 or count_items>100 then raise exception 'Cart must contain 1 to 100 phones'; end if;
if (select count(distinct value->>'product_id') from jsonb_array_elements(_items))<>count_items then raise exception 'Duplicate phone in cart'; end if;
perform id from products where id in (select (value->>'product_id')::uuid from jsonb_array_elements(_items)) order by id for update;
for item in select value from jsonb_array_elements(_items) loop
select * into p from products where id=(item->>'product_id')::uuid;
if not found then raise exception 'Product not found'; end if;
if p.status<>'in_stock' then raise exception 'Phone % is % and cannot be sold',p.product_code,p.status; end if;
if p.current_shop_id is distinct from _shop_id then raise exception 'Phone % is at another shop. Request a transfer first.',p.product_code; end if;
if item->>'price' is null or (item->>'price')!~'^[0-9]+$' then raise exception 'Invalid item price'; end if;
price:=(item->>'price')::integer; subtotal:=subtotal+price;
snap:=snap||jsonb_build_array(jsonb_build_object('product_id',p.id,'model',(select brand||' '||model from models where id=p.model_id),'storage',p.storage,'color',p.color,'condition',p.condition,'imei',p.imei,'price',price));
end loop;
if _discount is null or _discount<0 or _discount>subtotal then raise exception 'Invalid discount'; end if;
total:=subtotal-_discount;
if _paid is null or _paid<total then raise exception 'Amount received must cover the total'; end if;
insert into receipts(shop_id,sold_by,staff_code,staff_name,customer_name,customer_phone,payment,subtotal,discount,total,paid,change_due,shop_snapshot,items) values(_shop_id,uid,staff.staff_code,staff.name,left(trim(coalesce(_customer_name,'')),100),left(trim(coalesce(_customer_phone,'')),50),_payment,subtotal,_discount,total,_paid,_paid-total,to_jsonb(sh),snap) returning * into r;
for item in select value from jsonb_array_elements(_items) loop
price:=(item->>'price')::integer; before_net:=case when subtotal=0 then 0 else floor(cumulative::numeric*total/subtotal)::bigint end; cumulative:=cumulative+price;
net:=case when subtotal=0 then 0 else floor(cumulative::numeric*total/subtotal)::bigint-before_net end;
insert into sales(receipt_no,receipt_id,product_id,item_price,sale_price,customer_name,payment,shop_id,sold_by,staff_code,created_at) values(r.receipt_no,r.id,(item->>'product_id')::uuid,price,net,nullif(r.customer_name,''),_payment,_shop_id,uid,staff.staff_code,r.created_at);
update products set status='sold' where id=(item->>'product_id')::uuid;
end loop; return r; end $$;

create or replace function public.expire_transfer_requests() returns integer language plpgsql security definer set search_path=public as $$ declare n integer; lim integer; begin select coalesce((select transit_limit_hours from app_settings where id=true),24) into lim; update transfers set status='expired' where status='requested' and created_at+make_interval(hours=>lim)<=now(); get diagnostics n=row_count; return n; end $$;

create or replace function public.request_transfer_to_shop(_product_id uuid,_to_shop_id uuid) returns public.transfers language plpgsql security definer set search_path=public as $$ declare p public.products; t public.transfers; begin
if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then raise exception 'Not allowed'; end if;
if not has_role(auth.uid(),'owner') and _to_shop_id is distinct from my_shop_id() then raise exception 'Requests must be for your shop'; end if;
if _to_shop_id is null or not exists(select 1 from shops where id=_to_shop_id) then raise exception 'Pick a destination shop'; end if;
perform expire_transfer_requests();
select * into p from products where id=_product_id for update; if not found then raise exception 'Product not found'; end if;
if p.status<>'in_stock' then raise exception 'This phone is not in stock'; end if;
if p.current_shop_id=_to_shop_id then raise exception 'This phone is already in your shop'; end if;
if exists(select 1 from transfers where product_id=p.id and status in ('requested','accepted')) then raise exception 'This phone already has an open transfer request'; end if;
insert into transfers(product_id,from_shop_id,to_shop_id,requested_by) values(p.id,p.current_shop_id,_to_shop_id,auth.uid()) returning * into t; return t; end $$;

create function public.respond_transfer(_transfer_id uuid, _accept boolean, _reason text) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t public.transfers; p public.products;
begin
  select * into t from transfers where id = _transfer_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if not (has_role(auth.uid(),'owner') or t.from_shop_id = my_shop_id()) then raise exception 'Not allowed'; end if;
  if t.status <> 'requested' then raise exception 'This request is already %', t.status; end if;
  if _accept then
    select * into p from products where id = t.product_id for update;
    if p.status <> 'in_stock' or p.current_shop_id <> t.from_shop_id then raise exception 'This phone is no longer in stock here'; end if;
    update products set status = 'in_transit' where id = p.id;
    update transfers set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = t.id returning * into t;
  else
    if coalesce(trim(_reason),'') = '' then raise exception 'A reason is required to reject'; end if;
    update transfers set status = 'rejected', accepted_by = auth.uid(), accepted_at = now(), reject_reason = left(trim(_reason), 300) where id = t.id returning * into t;
  end if;
  return t;
end $$;

create function public.receive_transfer(_transfer_id uuid, _code text) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t public.transfers; p public.products; c text := upper(trim(_code));
begin
  select * into t from transfers where id = _transfer_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if not (has_role(auth.uid(),'owner') or t.to_shop_id = my_shop_id()) then raise exception 'Not allowed'; end if;
  if t.status <> 'accepted' then raise exception 'This transfer is %', t.status; end if;
  select * into p from products where id = t.product_id for update;
  if c <> p.product_code and c <> p.imei then raise exception 'Wrong phone: % does not match this transfer (%)', c, p.product_code; end if;
  update products set current_shop_id = t.to_shop_id, status = 'in_stock' where id = p.id;
  update transfers set status = 'received', received_by = auth.uid(), received_at = now() where id = t.id returning * into t;
  return t;
end $$;

create function public.cancel_transfer(_transfer_id uuid) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t public.transfers;
begin
  select * into t from transfers where id = _transfer_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.requested_by <> auth.uid() then raise exception 'Only the requester can cancel'; end if;
  if t.status <> 'requested' then raise exception 'Can only cancel while requested'; end if;
  update transfers set status = 'cancelled' where id = t.id returning * into t;
  return t;
end $$;

create or replace function public.cancel_overdue_transfer(_transfer_id uuid,_reason text) returns public.transfers language plpgsql security definer set search_path=public as $$ declare t public.transfers; lim integer; p public.products; begin
if auth.uid() is null or not has_role(auth.uid(),'owner') then raise exception 'Owner only'; end if;
if coalesce(trim(_reason),'')='' then raise exception 'Cancellation reason is required'; end if;
select * into t from transfers where id=_transfer_id for update; if not found then raise exception 'Transfer not found'; end if;
lim:=coalesce((select transit_limit_hours from app_settings where id=true),24);
if t.status<>'accepted' or t.accepted_at+make_interval(hours=>lim)>=now() then raise exception 'Only overdue in-transit transfers can be cancelled'; end if;
select * into p from products where id=t.product_id for update;
if p.status<>'in_transit' then raise exception 'Phone is no longer in transit'; end if;
update products set current_shop_id=t.from_shop_id,status='in_stock' where id=t.product_id;
update transfers set status='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=left(trim(_reason),300) where id=t.id returning * into t; return t; end $$;

create or replace function public.save_shop_profile(_id uuid, _name text, _address text, _postal_code text, _phone text, _email text, _receipt_footer text, _logo text) returns void language plpgsql security definer set search_path=public as $$ begin
if auth.uid() is null or not public.has_role(auth.uid(),'owner') then raise exception 'Owner only'; end if;
if trim(_name) = '' then raise exception 'Shop name is required'; end if;
update shops set name=left(trim(_name),100), address=left(_address,500), postal_code=left(_postal_code,30), phone=left(_phone,50), email=left(_email,200), receipt_footer=left(_receipt_footer,2000), logo=nullif(_logo,'') where id=_id;
if not found then raise exception 'Shop not found'; end if; end $$;

create or replace function public.save_transit_limit(_hours integer) returns void language plpgsql security definer set search_path=public as $$ begin
if auth.uid() is null or not public.has_role(auth.uid(),'owner') then raise exception 'Owner only'; end if;
if _hours is null or _hours < 1 or _hours > 8760 then raise exception 'Enter a limit between 1 and 8760 hours'; end if;
insert into app_settings(id,transit_limit_hours) values(true,_hours) on conflict(id) do update set transit_limit_hours=excluded.transit_limit_hours; end $$;

create or replace function public.can_edit_product(_product_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from products p where p.id = _product_id
    and (has_role(auth.uid(),'owner') or (has_role(auth.uid(),'staff') and my_shop_id() in (p.shop_id, p.current_shop_id))))
$$;

create or replace function public.add_product_photos(_product_id uuid, _paths text[])
returns setof public.product_photos language plpgsql security definer set search_path = public as $$
declare pth text; ph public.product_photos;
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed'; end if;
  if coalesce(array_length(_paths,1),0) = 0 then raise exception 'No photos'; end if;
  if (select count(*) from product_photos where product_id = _product_id) + array_length(_paths,1) > 6 then raise exception 'A product can have at most 6 photos'; end if;
  foreach pth in array _paths loop
    if pth not like _product_id::text || '/%' then raise exception 'Invalid photo path'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'product-photos' and o.name = pth) then raise exception 'Photo was not uploaded'; end if;
    insert into product_photos (product_id, url, uploaded_by) values (_product_id, pth, auth.uid()) returning * into ph;
    return next ph;
  end loop;
end $$;

create or replace function public.set_product_tracking(_product_id uuid, _carrier text, _tracking_number text)
returns public.products language plpgsql security definer set search_path = public as $$
declare p public.products; c text := nullif(trim(coalesce(_carrier,'')),''); t text := nullif(upper(regexp_replace(coalesce(_tracking_number,''),'\s','','g')),'');
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed'; end if;
  if c is not null and c not in ('Japan Post','Yamato','Sagawa','Other') then raise exception 'Invalid carrier'; end if;
  if t is not null and (c is null or t !~ '^[A-Z0-9-]{4,40}$') then raise exception 'Enter a carrier and a valid tracking number'; end if;
  if t is null then c := null; end if;
  update products set carrier = c, tracking_number = t where id = _product_id returning * into p;
  return p;
end $$;

-- execute permissions
revoke execute on all functions in schema public from public, anon;
grant execute on function public.has_role(uuid, app_role), public.my_shop_id(), public.check_staff_code(text), public.can_edit_product(uuid),
  public.add_product(uuid, uuid, text, text, text, text, integer, integer, text, text, text, integer),
  public.add_products_bulk(uuid, text, text, text, integer, jsonb),
  public.complete_cart_sale(uuid,text,jsonb,integer,integer,text,text,text),
  public.request_transfer_to_shop(uuid,uuid), public.respond_transfer(uuid, boolean, text),
  public.receive_transfer(uuid, text), public.cancel_transfer(uuid), public.cancel_overdue_transfer(uuid,text),
  public.save_shop_profile(uuid,text,text,text,text,text,text,text), public.save_transit_limit(integer),
  public.add_product_photos(uuid, text[]), public.set_product_tracking(uuid, text, text) to authenticated;
revoke execute on function public.expire_transfer_requests() from authenticated;
grant execute on all functions in schema public to service_role;

-- storage policies
create policy "staff read shop logos" on storage.objects for select to authenticated using (bucket_id='shop-logos');
create policy "owner upload shop logos" on storage.objects for insert to authenticated with check (bucket_id='shop-logos' and public.has_role(auth.uid(),'owner'));
create policy "owner update shop logos" on storage.objects for update to authenticated using (bucket_id='shop-logos' and public.has_role(auth.uid(),'owner')) with check (bucket_id='shop-logos' and public.has_role(auth.uid(),'owner'));
create policy "read product photo files" on storage.objects for select to authenticated using (bucket_id = 'product-photos');
create policy "upload product photo files" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-photos' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[1] and public.can_edit_product(p.id)));

-- seed
insert into public.app_settings (id, transit_limit_hours) values (true, 24);
insert into public.shops (id, name) values
 ('11111111-0000-0000-0000-000000000001','Akiba Mobile Store'),
 ('11111111-0000-0000-0000-000000000002','Istore Jp'),
 ('11111111-0000-0000-0000-000000000003','Rj Mobile Ikebukuro'),
 ('11111111-0000-0000-0000-000000000004','Royal Japan Shinjuku 1'),
 ('11111111-0000-0000-0000-000000000005','Royal Japan Shinjuku 2');
insert into public.models (brand, model, sort) values
 ('Apple','iPhone 11',1),('Apple','iPhone 11 Pro',2),('Apple','iPhone 11 Pro Max',3),
 ('Apple','iPhone 12 mini',4),('Apple','iPhone 12',5),('Apple','iPhone 12 Pro',6),('Apple','iPhone 12 Pro Max',7),
 ('Apple','iPhone 13 mini',8),('Apple','iPhone 13',9),('Apple','iPhone 13 Pro',10),('Apple','iPhone 13 Pro Max',11),
 ('Apple','iPhone 14',12),('Apple','iPhone 14 Plus',13),('Apple','iPhone 14 Pro',14),('Apple','iPhone 14 Pro Max',15),
 ('Apple','iPhone 15',16),('Apple','iPhone 15 Plus',17),('Apple','iPhone 15 Pro',18),('Apple','iPhone 15 Pro Max',19),
 ('Apple','iPhone 16',20),('Apple','iPhone 16 Plus',21),('Apple','iPhone 16 Pro',22),('Apple','iPhone 16 Pro Max',23),
 ('Apple','iPhone 17',24),('Apple','iPhone 17 Pro',25),('Apple','iPhone 17 Pro Max',26),
 ('Samsung','Galaxy S22',1),('Samsung','Galaxy S22+',2),('Samsung','Galaxy S22 Ultra',3),
 ('Samsung','Galaxy S23',4),('Samsung','Galaxy S23+',5),('Samsung','Galaxy S23 Ultra',6),
 ('Samsung','Galaxy S24',7),('Samsung','Galaxy S24+',8),('Samsung','Galaxy S24 Ultra',9),
 ('Samsung','Galaxy S25',10),('Samsung','Galaxy S25+',11),('Samsung','Galaxy S25 Ultra',12),
 ('Google','Pixel 7',1),('Google','Pixel 7 Pro',2),('Google','Pixel 7a',3),
 ('Google','Pixel 8',4),('Google','Pixel 8 Pro',5),('Google','Pixel 8a',6),
 ('Google','Pixel 9',7),('Google','Pixel 9 Pro',8),('Google','Pixel 9 Pro XL',9);