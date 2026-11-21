-- Categories, computer specs, invoices, in-store/online sales, COD shipping fee and shipment tracking.
-- Safe to run more than once.

-- ============ 0. Shops a staff member may sell at (home shop + extras) ============
create table if not exists public.staff_shops (
  staff_id uuid references public.profiles(id) on delete cascade,
  shop_id  uuid references public.shops(id) on delete cascade,
  primary key (staff_id, shop_id)
);
insert into public.staff_shops (staff_id, shop_id)
select id, shop_id from public.profiles where shop_id is not null
on conflict do nothing;
alter table public.staff_shops enable row level security;
drop policy if exists "read staff_shops" on public.staff_shops;
create policy "read staff_shops" on public.staff_shops for select to authenticated using (true);

create or replace function public.works_at_shop(_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')
    or exists(select 1 from profiles where id = auth.uid() and shop_id = _shop)
    or exists(select 1 from staff_shops where staff_id = auth.uid() and shop_id = _shop))
$$;

-- ============ 1. Categories ============
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 50),
  kind text not null default 'phone' check (kind in ('phone','computer','other')),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on column public.categories.kind is 'phone = 15-digit IMEI required; computer = serial number + specs; other = IMEI or serial';
alter table public.categories enable row level security;
drop policy if exists "read categories" on public.categories;
create policy "read categories" on public.categories for select to authenticated using (true);

insert into public.categories (name, kind, sort) values
  ('iPhone','phone',1), ('Android','phone',2), ('Tablet','other',3),
  ('Computer','computer',4), ('Smartwatch','other',5), ('Game console','other',6)
on conflict (name) do nothing;

alter table public.models add column if not exists category_id uuid references public.categories(id);
update public.models m set category_id = (select c.id from public.categories c where c.name = case
    when m.model ~* '(ipad|tablet|\mtab\M|\mpad\M)' then 'Tablet'
    when m.model ~* '(macbook|imac|mac mini|mac studio|thinkpad|ideapad|surface|laptop|notebook|chromebook|vaio|dynabook|let''s ?note|zenbook|vivobook|inspiron|latitude|xps|pavilion|elitebook|probook)'
      or m.brand ~* '^(dell|hp|acer|fujitsu|nec|dynabook|panasonic|microsoft|msi|vaio)$' then 'Computer'
    when m.model ~* 'watch' then 'Smartwatch'
    when m.model ~* 'iphone' then 'iPhone'
    else 'Android' end)
where m.category_id is null;

create or replace function public.save_category(_id uuid, _name text, _kind text, _sort integer, _active boolean)
returns public.categories language plpgsql security definer set search_path = public as $$
declare c categories; n text := btrim(coalesce(_name,''));
begin
  if not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')) then raise exception 'Only the owner or a manager can change categories'; end if;
  if length(n) not between 1 and 50 then raise exception 'Enter a category name (max 50 characters)'; end if;
  if _kind not in ('phone','computer','other') then raise exception 'Pick a category type'; end if;
  if _id is null then
    insert into categories(name, kind, sort, active) values (n, _kind, coalesce(_sort,0), coalesce(_active,true)) returning * into c;
  else
    update categories set name = n, kind = _kind, sort = coalesce(_sort, sort), active = coalesce(_active, active) where id = _id returning * into c;
    if not found then raise exception 'Category not found'; end if;
  end if;
  return c;
exception when unique_violation then raise exception 'A category called "%" already exists', n;
end $$;

create or replace function public.save_model(_id uuid, _brand text, _model text, _category_id uuid)
returns public.models language plpgsql security definer set search_path = public as $$
declare m models; b text := btrim(coalesce(_brand,'')); n text := btrim(coalesce(_model,''));
begin
  if not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')) then raise exception 'Only the owner or a manager can change models'; end if;
  if length(b) not between 1 and 50 or length(n) not between 1 and 100 then raise exception 'Enter a brand and model name'; end if;
  if _category_id is null or not exists(select 1 from categories where id = _category_id) then raise exception 'Pick a category'; end if;
  if _id is null then
    insert into models(brand, model, category_id, sort) values (b, n, _category_id, coalesce((select max(sort)+1 from models where brand = b),0)) returning * into m;
  else
    update models set brand = b, model = n, category_id = _category_id where id = _id returning * into m;
    if not found then raise exception 'Model not found'; end if;
  end if;
  return m;
exception when unique_violation then raise exception '% % already exists', b, n;
end $$;

-- ============ 2. Computer specs + serial numbers for non-phone devices ============
alter table public.products add column if not exists specs jsonb not null default '{}'::jsonb;

do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.products'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%imei%' loop
    execute format('alter table public.products drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.products add constraint products_imei_check
  check (imei ~ '^[0-9]{15}$' or imei ~ '^[A-Z0-9][A-Z0-9-]{4,29}$');

create or replace function public.guard_product_identifier() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if new.imei ~ '^[0-9]{15}$' then return new; end if;
  select c.kind into k from models m left join categories c on c.id = m.category_id where m.id = new.model_id;
  if coalesce(k,'phone') = 'phone' then
    raise exception 'Phones need a 15-digit IMEI. Serial numbers are only for computers, tablets and other devices';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_product_identifier on public.products;
create trigger trg_guard_product_identifier before insert or update of imei, model_id on public.products
for each row execute function public.guard_product_identifier();

-- Let the existing add-product functions accept a serial number (the trigger above still forces IMEI for phones).
do $$ declare f record; def text; done text := ''; begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('add_product','add_products_bulk','add_product_with_supplier','add_products_bulk_with_supplier') loop
    def := pg_get_functiondef(f.oid);
    if position('^[0-9]{15}$' in def) > 0 then
      execute replace(def, '^[0-9]{15}$', '^([0-9]{15}|[A-Z0-9][A-Z0-9-]{4,29})$');
      done := done || f.proname || ' ';
    end if;
  end loop;
  raise notice 'Serial numbers enabled in: %', coalesce(nullif(done,''),'(no IMEI check found)');
end $$;

create or replace function public.set_product_specs(_product_id uuid, _specs jsonb)
returns public.products language plpgsql security definer set search_path = public as $$
declare p products; s jsonb := '{}'::jsonb; k text;
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed to change this product'; end if;
  if jsonb_typeof(coalesce(_specs,'{}'::jsonb)) <> 'object' then raise exception 'Invalid specs'; end if;
  foreach k in array array['processor','generation','ram','display','os','battery','keyboard','notes'] loop
    if nullif(btrim(coalesce(_specs->>k,'')),'') is not null then s := s || jsonb_build_object(k, left(btrim(_specs->>k), 100)); end if;
  end loop;
  update products set specs = s where id = _product_id returning * into p;
  return p;
end $$;

-- ============ 3. Purchase invoices ============
create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id),
  supplier_id uuid references public.suppliers(id),
  invoice_no text,
  invoice_date date,
  total_amount integer check (total_amount is null or total_amount >= 0),
  t_number text check (t_number is null or t_number ~ '^T[0-9]{13}$'),
  file_path text not null,
  file_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.products add column if not exists invoice_id uuid references public.purchase_invoices(id);
alter table public.purchase_invoices enable row level security;
drop policy if exists "owners read invoices" on public.purchase_invoices;
create policy "owners read invoices" on public.purchase_invoices for select to authenticated
  using (has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager'));
drop trigger if exists audit_purchase_invoices on public.purchase_invoices;
create trigger audit_purchase_invoices after insert or update on public.purchase_invoices for each row execute function public.audit_row();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices','invoices', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "upload own invoice files" on storage.objects;
create policy "upload own invoice files" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners read invoice files" on storage.objects;
create policy "owners read invoice files" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'manager')));

create or replace function public.add_purchase_invoice(_shop uuid, _supplier uuid, _invoice_no text, _invoice_date date,
  _total integer, _t_number text, _file_path text, _file_name text, _product_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare iid uuid; t text := nullif(upper(regexp_replace(coalesce(_t_number,''),'[\s-]','','g')),''); pid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  if coalesce(array_length(_product_ids,1),0) = 0 then raise exception 'No products to attach the invoice to'; end if;
  if _file_path is null or split_part(_file_path,'/',1) <> auth.uid()::text
     or not exists(select 1 from storage.objects where bucket_id = 'invoices' and name = _file_path) then
    raise exception 'Invoice file was not uploaded. Try again';
  end if;
  if t is not null and t !~ '^T[0-9]{13}$' then raise exception 'T-number must be T followed by 13 digits'; end if;
  if _total is not null and _total < 0 then raise exception 'Invoice total cannot be negative'; end if;
  foreach pid in array _product_ids loop
    if not can_edit_product(pid) then raise exception 'You cannot attach an invoice to one of these products'; end if;
  end loop;
  insert into purchase_invoices(shop_id, supplier_id, invoice_no, invoice_date, total_amount, t_number, file_path, file_name)
  values (_shop, _supplier, left(nullif(btrim(coalesce(_invoice_no,'')),''),50), _invoice_date, _total, t, _file_path, left(_file_name,200))
  returning id into iid;
  update products set invoice_id = iid where id = any(_product_ids);
  return iid;
end $$;

-- ============ 4. In-store / online sales, COD fee, shipments ============
alter table public.receipts add column if not exists channel text not null default 'in_store';
alter table public.receipts add column if not exists platform text;
alter table public.receipts add column if not exists cod boolean not null default false;
alter table public.receipts add column if not exists shipping_fee integer not null default 0;
do $$ begin
  alter table public.receipts add constraint receipts_channel_check check (channel in ('in_store','online'));
exception when duplicate_object then null; end $$;

-- allow the COD payment method
do $$ declare t text; c record; begin
  foreach t in array array['receipts','sales'] loop
    for c in select conname from pg_constraint where conrelid = format('public.%I', t)::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%PayPay%' loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
    execute format('alter table public.%I add constraint %I check (payment in (''Cash'',''Card'',''PayPay'',''Bank'',''COD'',''Split'')) not valid', t, t || '_payment_method_check');
  end loop;
end $$;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique references public.receipts(id),
  shop_id uuid not null references public.shops(id),
  platform text,
  carrier text check (carrier is null or carrier in ('Japan Post','Yamato','Sagawa','Other')),
  tracking_number text,
  status text not null default 'preparing' check (status in ('preparing','shipped','in_transit','delivered','returned','problem')),
  recipient_name text, recipient_phone text, postal_code text, address text,
  cod boolean not null default false,
  cod_amount integer not null default 0,
  note text,
  shipped_at timestamptz, delivered_at timestamptz,
  created_by uuid default auth.uid(), updated_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists shipments_shop_status_idx on public.shipments (shop_id, status);
alter table public.shipments enable row level security;
drop policy if exists "read shipments" on public.shipments;
create policy "read shipments" on public.shipments for select to authenticated using (public.works_at_shop(shop_id));
drop trigger if exists audit_shipments on public.shipments;
create trigger audit_shipments after insert or update on public.shipments for each row execute function public.audit_row();

create or replace function public.update_shipment(_id uuid, _status text, _carrier text, _tracking_number text, _note text)
returns public.shipments language plpgsql security definer set search_path = public as $$
declare s shipments; c text := nullif(btrim(coalesce(_carrier,'')),'');
  t text := nullif(upper(regexp_replace(coalesce(_tracking_number,''),'\s','','g')),'');
begin
  select * into s from shipments where id = _id for update;
  if not found then raise exception 'Shipment not found'; end if;
  if not works_at_shop(s.shop_id) then raise exception 'You do not work at this shop'; end if;
  if _status not in ('preparing','shipped','in_transit','delivered','returned','problem') then raise exception 'Pick a valid status'; end if;
  if c is not null and c not in ('Japan Post','Yamato','Sagawa','Other') then raise exception 'Pick a valid carrier'; end if;
  if t is not null and (c is null or t !~ '^[A-Z0-9-]{4,40}$') then raise exception 'Enter the carrier and a valid tracking number'; end if;
  if _status in ('shipped','in_transit','delivered') and t is null then raise exception 'Add the tracking number before marking it %', replace(_status,'_',' '); end if;
  update shipments set status = _status, carrier = c, tracking_number = t,
    note = left(nullif(btrim(coalesce(_note,'')),''),300),
    shipped_at = case when _status in ('shipped','in_transit','delivered') then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when _status = 'delivered' then coalesce(delivered_at, now()) else null end,
    updated_by = auth.uid(), updated_at = now()
  where id = _id returning * into s;
  return s;
end $$;

-- ============ 5. Checkout with sale type, COD fee and shipment ============
drop function if exists public.complete_pos_sale(uuid,text,jsonb,integer,jsonb,uuid,text,text,uuid);
drop function if exists public.complete_pos_sale(uuid,text,jsonb,integer,jsonb,uuid,text,text,uuid,text,jsonb);
create function public.complete_pos_sale(_shop uuid, _staff_code text, _items jsonb, _discount integer, _payments jsonb,
  _customer uuid, _customer_name text, _customer_phone text, _key uuid, _channel text default 'in_store', _shipping jsonb default null)
 returns receipts language plpgsql security definer set search_path to 'public'
as $function$
declare r receipts;p products;a accessories;staff profiles;sh shops;cfg pos_settings;item jsonb;pay jsonb;snaps jsonb:='[]';kind text;qty integer;price integer;standard integer;ld integer;base bigint:=0;gross bigint:=0;line_total bigint:=0;total bigint;goods_total bigint;paid bigint:=0;noncash bigint:=0;cash bigint:=0;cum bigint:=0;before_net bigint;net integer;privileged boolean;label text;method text;allowed text;
  ch text;plat text;is_cod boolean:=false;fee integer:=0;carr text;trk text;
begin
if _key is null then raise exception 'Checkout identifier missing. Refresh the page and try again';end if;
select * into sh from shops where id=_shop;
if not found then raise exception 'Shop not found. Pick a shop and try again';end if;
if not coalesce(pos_shop_access(_shop),false) and not works_at_shop(_shop) then raise exception 'Your login is not allowed to sell at %', sh.name;end if;
perform pg_advisory_xact_lock(hashtextextended(_key::text,0));
select * into r from receipts where checkout_key=_key;
if found then if r.shop_id<>_shop or r.sold_by<>auth.uid() then raise exception 'This checkout was already used. Start a new sale';end if;return r;end if;
privileged:=has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager');

perform check_staff_code(_staff_code);
select * into staff from profiles where staff_code=upper(btrim(_staff_code));
if not found then raise exception 'Staff code % was not found', upper(btrim(coalesce(_staff_code,'')));end if;
if not (privileged
        or has_role(staff.id,'owner') or has_role(staff.id,'manager')
        or staff.shop_id is null or staff.shop_id=_shop
        or exists(select 1 from staff_shops ss where ss.staff_id=staff.id and ss.shop_id=_shop)) then
  select string_agg(distinct s2.name, ', ') into allowed from shops s2
   where s2.id=staff.shop_id or s2.id in (select ss.shop_id from staff_shops ss where ss.staff_id=staff.id);
  raise exception '% (%) is not allowed to sell at %. Allowed shops: %', staff.name, staff.staff_code, sh.name, coalesce(allowed,'none');
end if;

-- sale type and shipping
ch:=coalesce(nullif(btrim(coalesce(_channel,'')),''),'in_store');
if ch not in ('in_store','online') then raise exception 'Sale type must be In-store or Online';end if;
if ch='online' then
  if _shipping is not null and jsonb_typeof(_shipping)<>'object' then raise exception 'Invalid shipping details';end if;
  plat:=left(nullif(btrim(coalesce(_shipping->>'platform','')),''),50);
  is_cod:=coalesce((_shipping->>'cod')::boolean,false);
  fee:=coalesce(nullif(_shipping->>'fee','')::int,0);
  if fee<0 or fee>100000 then raise exception 'Invalid shipping fee';end if;
  if not privileged and fee not in (0,1500,2000,2500) then raise exception 'Shipping fee must be ¥1,500, ¥2,000 or ¥2,500';end if;
  if is_cod and fee=0 then raise exception 'Pick the COD shipping fee (¥1,500, ¥2,000 or ¥2,500)';end if;
  carr:=nullif(btrim(coalesce(_shipping->>'carrier','')),'');
  trk:=nullif(upper(regexp_replace(coalesce(_shipping->>'tracking_number',''),'\s','','g')),'');
  if carr is not null and carr not in ('Japan Post','Yamato','Sagawa','Other') then raise exception 'Pick a valid carrier';end if;
  if trk is not null and (carr is null or trk !~ '^[A-Z0-9-]{4,40}$') then raise exception 'Enter the carrier and a valid tracking number';end if;
end if;

select * into cfg from pos_settings where shop_id=_shop;
if _customer is not null then
  select name,phone into _customer_name,_customer_phone from customers where id=_customer;
  if not found then raise exception 'Selected customer was not found. Pick the customer again';end if;
end if;
if jsonb_typeof(_items) is distinct from 'array' or jsonb_array_length(_items) not between 1 and 100 then raise exception 'Cart is empty or has more than 100 lines';end if;
if (select count(*) from jsonb_array_elements(_items) x where x->>'kind'<>'custom')<>(select count(distinct (x->>'kind')||':'||(x->>'id')) from jsonb_array_elements(_items) x where x->>'kind'<>'custom') then raise exception 'The same item is in the cart twice';end if;
perform id from products where id in(select (x->>'id')::uuid from jsonb_array_elements(_items) x where x->>'kind'='phone') order by id for update;
perform id from accessories where id in(select (x->>'id')::uuid from jsonb_array_elements(_items) x where x->>'kind'='accessory') order by id for update;
for item in select value from jsonb_array_elements(_items) loop
kind:=item->>'kind';qty:=(item->>'quantity')::int;price:=(item->>'price')::int;ld:=coalesce((item->>'discount')::int,0);
if qty is null or qty<1 or qty>10000 or price is null or price<0 then raise exception 'Invalid quantity or price in the cart';end if;
if kind='phone' then
  select * into p from products where id=(item->>'id')::uuid;
  if not found then raise exception 'Product not found in the stock list';end if;
  if p.status<>'in_stock' then raise exception 'Product % cannot be sold: its status is %', p.imei, p.status;end if;
  if p.current_shop_id is distinct from _shop then raise exception 'Product % is in stock at %, not at %', p.imei, coalesce((select name from shops where id=p.current_shop_id),'no shop'), sh.name;end if;
  if qty<>1 then raise exception 'Phone quantity must be 1';end if;
  if phone_reserved(p.id) then raise exception 'Product % is reserved in a held sale. Resume or cancel that held sale first', p.imei;end if;
  standard:=p.selling_price;label:=(select brand||' '||model from models where id=p.model_id);
elsif kind='accessory' then
  select * into a from accessories where id=(item->>'id')::uuid;
  if not found then raise exception 'Accessory not found';end if;
  if a.shop_id<>_shop then raise exception '% is stock of another shop, not %', a.name, sh.name;end if;
  if not a.active then raise exception '% is inactive', a.name;end if;
  if qty>a.quantity then raise exception 'Only % of % left in stock', a.quantity, a.name;end if;
  standard:=a.selling_price;label:=a.name;
elsif kind='custom' then
  if not coalesce(cfg.custom_enabled,true) then raise exception 'Custom items are turned off for this shop';end if;
  label:=btrim(item->>'name');if coalesce(length(label),0) not between 1 and 100 then raise exception 'Enter a name for the custom item';end if;standard:=price;
else raise exception 'Invalid item type in the cart';end if;
if not privileged and price<>standard then raise exception 'Only the owner or a manager can change the price of %', label;end if;
base:=price::bigint*qty;if ld<0 or ld>base then raise exception 'Discount on % is more than its price', label;end if;gross:=gross+base;line_total:=line_total+base-ld;
snaps:=snaps||jsonb_build_array(jsonb_build_object('kind',kind,'product_id',case when kind='phone' then p.id else null end,'accessory_id',case when kind='accessory' then a.id else null end,'model',label,'imei',case when kind='phone' then p.imei else '' end,'storage',case when kind='phone' then p.storage else '' end,'color',case when kind='phone' then p.color else '' end,'quantity',qty,'unit_price',price,'discount',ld,'price',base-ld));end loop;
if _discount is null or _discount<0 or _discount>line_total then raise exception 'Order discount is more than the order total';end if;
if not privileged and gross-line_total+_discount>floor(gross*coalesce(cfg.staff_discount_percent,0)/100) then raise exception 'Discount is above the staff limit (% percent). Ask the owner or a manager', coalesce(cfg.staff_discount_percent,0);end if;
goods_total:=line_total-_discount;
total:=goods_total+fee;
if fee>0 then
  snaps:=snaps||jsonb_build_array(jsonb_build_object('kind','custom','shipping',true,'product_id',null,'accessory_id',null,'model',case when is_cod then 'Shipping fee (COD)' else 'Shipping fee' end,'imei','','storage','','color','','quantity',1,'unit_price',fee,'discount',0,'price',fee));
end if;
if total>2147483647 or gross+fee>2147483647 then raise exception 'Order total is too large';end if;
if jsonb_typeof(_payments) is distinct from 'array' or jsonb_array_length(_payments) not between 1 and 5 then raise exception 'Select at least one payment method';end if;
if (select count(distinct x->>'method') from jsonb_array_elements(_payments) x)<>jsonb_array_length(_payments) then raise exception 'The same payment method was added twice';end if;
for pay in select value from jsonb_array_elements(_payments) loop method:=pay->>'method';price:=(pay->>'amount')::int;
  if method not in ('Cash','Card','PayPay','Bank','COD') or method is null or price is null or price<0 then raise exception 'Invalid payment method or amount';end if;
  if method='COD' and not is_cod then raise exception 'COD payment is only for online cash-on-delivery sales';end if;
  paid:=paid+price;if method='Cash' then cash:=cash+price;else noncash:=noncash+price;end if;end loop;
if noncash>total then raise exception 'Card/PayPay/Bank/COD total (¥%) is more than the sale total (¥%). Only cash can be more than the total', noncash, total;end if;
if paid<total then raise exception 'Payment is short by ¥%', total-paid;end if;
if paid-total>cash then raise exception 'Change can only be given from cash';end if;
if paid>2147483647 then raise exception 'Payment amount is too large';end if;
insert into receipts(shop_id,sold_by,staff_code,staff_name,customer_id,customer_name,customer_phone,payment,payment_breakdown,subtotal,discount,total,paid,change_due,tax,shop_snapshot,items,checkout_key,channel,platform,cod,shipping_fee)
values(_shop,auth.uid(),staff.staff_code,staff.name,_customer,left(coalesce(_customer_name,''),100),left(coalesce(_customer_phone,''),50),_payments->0->>'method',_payments,gross+fee,gross-goods_total,total,paid,paid-total,floor(total*10.0/110),to_jsonb(sh),snaps,_key,ch,plat,is_cod,fee) returning * into r;
for item in select value from jsonb_array_elements(snaps) loop
if coalesce((item->>'shipping')::boolean,false) then
  insert into pos_sale_lines(receipt_id,shop_id,accessory_id,kind,name,quantity,item_price,sale_price,created_at) values(r.id,_shop,null,'custom',item->>'model',1,fee,fee,r.created_at);
  continue;
end if;
base:=(item->>'price')::bigint;before_net:=case when line_total=0 then 0 else floor(cum::numeric*goods_total/line_total)::bigint end;cum:=cum+base;net:=case when line_total=0 then 0 else floor(cum::numeric*goods_total/line_total)::bigint-before_net end;
if item->>'kind'='phone' then insert into sales(receipt_no,receipt_id,product_id,item_price,sale_price,customer_name,payment,shop_id,sold_by,staff_code,created_at) values(r.receipt_no,r.id,(item->>'product_id')::uuid,(item->>'unit_price')::int,net,r.customer_name,r.payment,_shop,auth.uid(),staff.staff_code,r.created_at);update products set status='sold' where id=(item->>'product_id')::uuid;
else insert into pos_sale_lines(receipt_id,shop_id,accessory_id,kind,name,quantity,item_price,sale_price,created_at) values(r.id,_shop,nullif(item->>'accessory_id','')::uuid,item->>'kind',item->>'model',(item->>'quantity')::int,(item->>'unit_price')::int,net,r.created_at);if item->>'kind'='accessory' then update accessories set quantity=quantity-(item->>'quantity')::int where id=(item->>'accessory_id')::uuid;end if;end if;end loop;
if ch='online' then
  insert into shipments(receipt_id,shop_id,platform,carrier,tracking_number,status,recipient_name,recipient_phone,postal_code,address,cod,cod_amount,shipped_at,created_by)
  values(r.id,_shop,plat,carr,trk,case when trk is null then 'preparing' else 'shipped' end,
    left(coalesce(nullif(btrim(_shipping->>'recipient_name'),''),r.customer_name,''),100),
    left(coalesce(nullif(btrim(_shipping->>'recipient_phone'),''),r.customer_phone,''),50),
    left(nullif(btrim(coalesce(_shipping->>'postal_code','')),''),10),
    left(nullif(btrim(coalesce(_shipping->>'address','')),''),300),
    is_cod,case when is_cod then total else 0 end,case when trk is null then null else now() end,auth.uid());
end if;
return r;end $function$;

-- ============ permissions ============
do $$ declare f text; begin
  foreach f in array array[
    'public.works_at_shop(uuid)','public.save_category(uuid,text,text,integer,boolean)','public.save_model(uuid,text,text,uuid)',
    'public.set_product_specs(uuid,jsonb)','public.add_purchase_invoice(uuid,uuid,text,date,integer,text,text,text,uuid[])',
    'public.update_shipment(uuid,text,text,text,text)',
    'public.complete_pos_sale(uuid,text,jsonb,integer,jsonb,uuid,text,text,uuid,text,jsonb)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
