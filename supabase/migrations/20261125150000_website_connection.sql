-- Connection between the stock system and the kaitorinihon.jp website.
-- The website (anon key) can ONLY: read buyback prices, shop names and phones marked "show on website",
-- and SEND buyback requests and repair bookings. It can never read requests, costs, staff or customers.
-- Safe to run more than once.

-- ============ 1. Buyback prices ============
create table if not exists public.buyback_prices (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id),
  storage text not null default '',
  grade text not null check (grade in ('unused','used_a','used_b','used_c','junk')),
  price integer not null check (price >= 0),
  active boolean not null default true,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (model_id, storage, grade)
);
alter table public.buyback_prices enable row level security;
drop policy if exists "staff read buyback prices" on public.buyback_prices;
create policy "staff read buyback prices" on public.buyback_prices for select to authenticated using (true);
drop trigger if exists audit_buyback_prices on public.buyback_prices;
create trigger audit_buyback_prices after insert or update on public.buyback_prices for each row execute function public.audit_row();

create or replace function public.set_buyback_price(_model_id uuid, _storage text, _grade text, _price integer, _active boolean default true)
returns public.buyback_prices language plpgsql security definer set search_path = public as $$
declare b buyback_prices;
begin
  if not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')) then raise exception 'Only the owner or a manager can change buyback prices'; end if;
  if not exists (select 1 from models where id = _model_id) then raise exception 'Model not found'; end if;
  if _grade not in ('unused','used_a','used_b','used_c','junk') then raise exception 'Pick a grade'; end if;
  if _price is null or _price < 0 or _price > 5000000 then raise exception 'Enter a price between ¥0 and ¥5,000,000'; end if;
  insert into buyback_prices (model_id, storage, grade, price, active)
  values (_model_id, left(btrim(coalesce(_storage,'')),20), _grade, _price, coalesce(_active,true))
  on conflict (model_id, storage, grade) do update set price = excluded.price, active = excluded.active, updated_by = auth.uid(), updated_at = now()
  returning * into b;
  return b;
end $$;

-- What the website reads (safe columns only)
create or replace view public.web_buyback_prices as
  select bp.id, m.brand, m.model, c.name as category, bp.storage, bp.grade,
    case bp.grade when 'unused' then '未使用' when 'used_a' then '中古A' when 'used_b' then '中古B' when 'used_c' then '中古C' else 'ジャンク' end as grade_ja,
    bp.price, bp.updated_at
  from public.buyback_prices bp
  join public.models m on m.id = bp.model_id
  left join public.categories c on c.id = m.category_id
  where bp.active;

create or replace view public.web_shops as
  select id, name from public.shops;

-- ============ 2. Phones for sale on the website ============
alter table public.products add column if not exists show_on_website boolean not null default false;
create or replace view public.web_products_for_sale as
  select p.id, p.product_code, m.brand, m.model, c.name as category, p.storage, p.color, p.condition,
         p.battery_health, p.selling_price, s.name as shop, p.created_at
  from public.products p
  join public.models m on m.id = p.model_id
  left join public.categories c on c.id = m.category_id
  left join public.shops s on s.id = p.current_shop_id
  where p.status = 'in_stock' and p.show_on_website;

create or replace function public.set_product_website(_product_id uuid, _show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')) then raise exception 'Only the owner or a manager can change what is on the website'; end if;
  update products set show_on_website = coalesce(_show,false) where id = _product_id;
  if not found then raise exception 'Product not found'; end if;
end $$;

-- ============ 3. Buyback requests (買取申込) from the website ============
create sequence if not exists public.web_request_seq;
create table if not exists public.buyback_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique default ('KR-' || lpad(nextval('public.web_request_seq')::text, 5, '0')),
  method text not null default 'store' check (method in ('store','mail')),
  model_text text not null,
  storage text, grade text, quoted_price integer,
  condition_note text,
  name text not null, phone text, email text, postal_code text, address text,
  shop_id uuid references public.shops(id),
  preferred_date date,
  message text,
  status text not null default 'new' check (status in ('new','contacted','received','bought','cancelled')),
  staff_note text,
  handled_by uuid, handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.buyback_requests enable row level security;
drop policy if exists "staff read buyback requests" on public.buyback_requests;
create policy "staff read buyback requests" on public.buyback_requests for select to authenticated
  using (shop_id is null or public.works_at_shop(shop_id));
drop trigger if exists audit_buyback_requests on public.buyback_requests;
create trigger audit_buyback_requests after insert or update on public.buyback_requests for each row execute function public.audit_row();

-- ============ 4. Repair bookings (修理予約) from the website ============
create sequence if not exists public.web_repair_seq;
create table if not exists public.repair_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text not null unique default ('RP-' || lpad(nextval('public.web_repair_seq')::text, 5, '0')),
  model_text text not null,
  problem text not null,
  shop_id uuid references public.shops(id),
  preferred_at timestamptz,
  name text not null, phone text, email text,
  message text,
  status text not null default 'new' check (status in ('new','confirmed','done','cancelled')),
  staff_note text,
  handled_by uuid, handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.repair_bookings enable row level security;
drop policy if exists "staff read repair bookings" on public.repair_bookings;
create policy "staff read repair bookings" on public.repair_bookings for select to authenticated
  using (shop_id is null or public.works_at_shop(shop_id));
drop trigger if exists audit_repair_bookings on public.repair_bookings;
create trigger audit_repair_bookings after insert or update on public.repair_bookings for each row execute function public.audit_row();

-- shared check for website forms: contact info + simple spam limits
create or replace function public.web_form_check(_name text, _phone text, _email text, _honeypot text, _table text)
returns void language plpgsql security definer set search_path = public as $$
declare recent int; ph text := regexp_replace(coalesce(_phone,''), '[^0-9+]', '', 'g'); em text := lower(btrim(coalesce(_email,'')));
begin
  if coalesce(_honeypot,'') <> '' then raise exception 'Rejected'; end if;            -- hidden field filled = bot
  if length(btrim(coalesce(_name,''))) not between 1 and 100 then raise exception 'お名前を入力してください'; end if;
  if ph = '' and em = '' then raise exception '電話番号またはメールアドレスを入力してください'; end if;
  if ph <> '' and length(ph) not between 10 and 15 then raise exception '電話番号を確認してください'; end if;
  if em <> '' and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'メールアドレスを確認してください'; end if;
  execute format('select count(*) from %I where created_at > now() - interval ''1 hour'' and ((%L <> '''' and regexp_replace(coalesce(phone,''''), ''[^0-9+]'', '''', ''g'') = %L) or (%L <> '''' and lower(coalesce(email,'''')) = %L))', _table, ph, ph, em, em) into recent;
  if recent >= 3 then raise exception '送信回数が多すぎます。しばらくしてからお試しください'; end if;
  execute format('select count(*) from %I where created_at > now() - interval ''1 minute''', _table) into recent;
  if recent >= 20 then raise exception 'ただいま混み合っています。しばらくしてからお試しください'; end if;
end $$;
revoke all on function public.web_form_check(text,text,text,text,text) from public, anon, authenticated;

create or replace function public.submit_buyback_request(_model text, _storage text, _grade text, _method text,
  _name text, _phone text, _email text, _shop_id uuid, _preferred_date date, _postal_code text, _address text,
  _condition_note text, _message text, _website text default '')
returns text language plpgsql security definer set search_path = public as $$
declare r buyback_requests; q integer; meth text := coalesce(nullif(btrim(coalesce(_method,'')),''),'store');
begin
  perform web_form_check(_name, _phone, _email, _website, 'buyback_requests');
  if length(btrim(coalesce(_model,''))) not between 1 and 100 then raise exception '機種を入力してください'; end if;
  if meth not in ('store','mail') then raise exception '買取方法を選んでください'; end if;
  if meth = 'mail' and length(btrim(coalesce(_address,''))) < 5 then raise exception '郵送買取の場合は住所を入力してください'; end if;
  if _shop_id is not null and not exists (select 1 from shops where id = _shop_id) then raise exception '店舗を選び直してください'; end if;
  if _preferred_date is not null and (_preferred_date < current_date or _preferred_date > current_date + 90) then raise exception '希望日を確認してください'; end if;
  select bp.price into q from buyback_prices bp join models m on m.id = bp.model_id
   where bp.active and lower(m.brand || ' ' || m.model) = lower(btrim(_model)) and bp.storage = coalesce(btrim(_storage),'') and bp.grade = _grade limit 1;
  insert into buyback_requests (method, model_text, storage, grade, quoted_price, condition_note, name, phone, email, postal_code, address, shop_id, preferred_date, message)
  values (meth, left(btrim(_model),100), left(btrim(coalesce(_storage,'')),20), nullif(_grade,''), q, left(_condition_note,500),
          left(btrim(_name),100), left(btrim(coalesce(_phone,'')),30), left(lower(btrim(coalesce(_email,''))),200),
          left(btrim(coalesce(_postal_code,'')),10), left(btrim(coalesce(_address,'')),300), _shop_id, _preferred_date, left(_message,1000))
  returning * into r;
  return r.request_no;
end $$;

create or replace function public.submit_repair_booking(_model text, _problem text, _shop_id uuid, _preferred_at timestamptz,
  _name text, _phone text, _email text, _message text, _website text default '')
returns text language plpgsql security definer set search_path = public as $$
declare b repair_bookings;
begin
  perform web_form_check(_name, _phone, _email, _website, 'repair_bookings');
  if length(btrim(coalesce(_model,''))) not between 1 and 100 then raise exception '機種を入力してください'; end if;
  if length(btrim(coalesce(_problem,''))) not between 1 and 500 then raise exception '症状を入力してください'; end if;
  if _shop_id is not null and not exists (select 1 from shops where id = _shop_id) then raise exception '店舗を選び直してください'; end if;
  if _preferred_at is not null and (_preferred_at < now() - interval '1 hour' or _preferred_at > now() + interval '90 days') then raise exception '希望日時を確認してください'; end if;
  insert into repair_bookings (model_text, problem, shop_id, preferred_at, name, phone, email, message)
  values (left(btrim(_model),100), left(btrim(_problem),500), _shop_id, _preferred_at, left(btrim(_name),100),
          left(btrim(coalesce(_phone,'')),30), left(lower(btrim(coalesce(_email,''))),200), left(_message,1000))
  returning * into b;
  return b.booking_no;
end $$;

-- staff update status of a website request / booking
create or replace function public.update_web_request(_kind text, _id uuid, _status text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  if _kind = 'buyback' then
    select shop_id into sid from buyback_requests where id = _id;
    if not found then raise exception 'Request not found'; end if;
    if sid is not null and not works_at_shop(sid) then raise exception 'This request is for another shop'; end if;
    if _status not in ('new','contacted','received','bought','cancelled') then raise exception 'Pick a valid status'; end if;
    update buyback_requests set status = _status, staff_note = left(nullif(btrim(coalesce(_note,'')),''),500), handled_by = auth.uid(), handled_at = now() where id = _id;
  elsif _kind = 'repair' then
    select shop_id into sid from repair_bookings where id = _id;
    if not found then raise exception 'Booking not found'; end if;
    if sid is not null and not works_at_shop(sid) then raise exception 'This booking is for another shop'; end if;
    if _status not in ('new','confirmed','done','cancelled') then raise exception 'Pick a valid status'; end if;
    update repair_bookings set status = _status, staff_note = left(nullif(btrim(coalesce(_note,'')),''),500), handled_by = auth.uid(), handled_at = now() where id = _id;
  else raise exception 'Unknown request type'; end if;
end $$;

-- ============ permissions ============
grant select on public.web_buyback_prices, public.web_shops, public.web_products_for_sale to anon, authenticated;
do $$ declare f text; begin
  foreach f in array array[
    'public.set_buyback_price(uuid,text,text,integer,boolean)', 'public.set_product_website(uuid,boolean)',
    'public.update_web_request(text,uuid,text,text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.submit_buyback_request(text,text,text,text,text,text,text,uuid,date,text,text,text,text,text)',
    'public.submit_repair_booking(text,text,uuid,timestamptz,text,text,text,text,text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
-- the website must not read these tables directly
revoke all on public.buyback_requests, public.repair_bookings, public.buyback_prices from anon;
