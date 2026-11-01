create type public.app_role as enum ('owner','staff');

create table public.shops (id uuid primary key default gen_random_uuid(), name text not null unique);
grant select on public.shops to authenticated; grant all on public.shops to service_role;
alter table public.shops enable row level security;
create policy "auth read shops" on public.shops for select to authenticated using (true);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  shop_id uuid references public.shops(id)
);
grant select on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "auth read profiles" on public.profiles for select to authenticated using (true);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

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
  status text not null default 'in_stock' check (status in ('in_stock','sold')),
  created_by uuid not null,
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
  created_at timestamptz not null default now()
);
grant select on public.product_costs to authenticated; grant all on public.product_costs to service_role;
alter table public.product_costs enable row level security;
create policy "owner read costs" on public.product_costs for select to authenticated using (public.has_role(auth.uid(),'owner'));

create sequence public.receipt_seq;
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique default ('R-' || lpad(nextval('public.receipt_seq')::text, 4, '0')),
  product_id uuid not null unique references public.products(id),
  sale_price integer not null check (sale_price >= 0),
  customer_name text,
  payment text not null check (payment in ('Cash','Card','PayPay')),
  shop_id uuid not null references public.shops(id),
  sold_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.sales to authenticated; grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "auth read sales" on public.sales for select to authenticated using (true);

-- Writes only through these functions (no insert/update/delete policies => no direct writes, no deletes)
create or replace function public.add_product(
  _shop_id uuid, _model_id uuid, _imei text, _color text, _storage text, _condition text,
  _purchase_price integer, _selling_price integer, _supplier text)
returns public.products language plpgsql security definer set search_path = public as $$
declare p public.products;
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then
    raise exception 'Not allowed';
  end if;
  if _imei !~ '^[0-9]{15}$' then raise exception 'IMEI must be exactly 15 digits'; end if;
  if exists (select 1 from products where imei = _imei) then raise exception 'This IMEI is already registered'; end if;
  insert into products (product_code, imei, model_id, color, storage, condition, selling_price, shop_id, created_by)
  values ('P' || right(_imei, 8), _imei, _model_id, trim(_color), trim(_storage), _condition, _selling_price, _shop_id, auth.uid())
  returning * into p;
  insert into product_costs (product_id, purchase_price, supplier, created_by)
  values (p.id, _purchase_price, nullif(trim(_supplier), ''), auth.uid());
  return p;
end $$;

create or replace function public.complete_sale(_product_id uuid, _sale_price integer, _customer_name text, _payment text)
returns public.sales language plpgsql security definer set search_path = public as $$
declare p public.products; s public.sales;
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then
    raise exception 'Not allowed';
  end if;
  select * into p from products where id = _product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p.status <> 'in_stock' then raise exception 'This phone is already sold'; end if;
  insert into sales (product_id, sale_price, customer_name, payment, shop_id, sold_by)
  values (p.id, _sale_price, nullif(trim(_customer_name), ''), _payment, p.shop_id, auth.uid())
  returning * into s;
  update products set status = 'sold' where id = p.id;
  return s;
end $$;

revoke execute on function public.add_product(uuid,uuid,text,text,text,text,integer,integer,text) from public, anon;
revoke execute on function public.complete_sale(uuid,integer,text,text) from public, anon;
grant execute on function public.add_product(uuid,uuid,text,text,text,text,integer,integer,text) to authenticated;
grant execute on function public.complete_sale(uuid,integer,text,text) to authenticated;

-- SEED
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

-- demo users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000001','authenticated','authenticated','owner@demo.com',
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000002','authenticated','authenticated','staff@demo.com',
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
 (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"owner@demo.com","email_verified":true}','email',now(),now(),now()),
 (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","email":"staff@demo.com","email_verified":true}','email',now(),now(),now());

insert into public.profiles (id, name, shop_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Demo Owner',null),
 ('aaaaaaaa-0000-0000-0000-000000000002','Demo Staff','11111111-0000-0000-0000-000000000001');
insert into public.user_roles (user_id, role) values
 ('aaaaaaaa-0000-0000-0000-000000000001','owner'),('aaaaaaaa-0000-0000-0000-000000000002','staff');

-- demo products (10 in stock + 5 sold)
with d(imei, brand, model, color, storage, cond, sell, cost, shop, status) as (values
 ('356789012345671','Apple','iPhone 15 Pro','Natural Titanium','256GB','Used A',139800,112000,1,'in_stock'),
 ('356789012345672','Apple','iPhone 14','Midnight','128GB','Used B',79800,61000,1,'in_stock'),
 ('356789012345673','Apple','iPhone 16 Pro Max','Desert Titanium','512GB','New',229800,198000,2,'in_stock'),
 ('356789012345674','Apple','iPhone 13','Blue','128GB','Used A',64800,48000,3,'in_stock'),
 ('356789012345675','Samsung','Galaxy S24 Ultra','Titanium Gray','256GB','Used A',149800,121000,4,'in_stock'),
 ('356789012345676','Samsung','Galaxy S23','Phantom Black','128GB','Used C',49800,36000,5,'in_stock'),
 ('356789012345677','Google','Pixel 9 Pro','Obsidian','256GB','New',159800,134000,2,'in_stock'),
 ('356789012345678','Google','Pixel 8','Hazel','128GB','Used B',54800,41000,3,'in_stock'),
 ('356789012345679','Apple','iPhone 12 mini','White','64GB','Used C',29800,19000,1,'in_stock'),
 ('356789012345680','Apple','iPhone 17 Pro','Cosmic Orange','256GB','New',199800,172000,4,'in_stock'),
 ('356789012345681','Apple','iPhone 15','Pink','128GB','Used A',99800,78000,1,'sold'),
 ('356789012345682','Samsung','Galaxy S25','Icyblue','256GB','New',124800,104000,2,'sold'),
 ('356789012345683','Google','Pixel 7a','Charcoal','128GB','Used B',34800,24000,3,'sold'),
 ('356789012345684','Apple','iPhone 14 Pro','Deep Purple','256GB','Used A',114800,92000,4,'sold'),
 ('356789012345685','Apple','iPhone 11','Black','64GB','Used C',24800,15000,5,'sold')
), ins as (
  insert into public.products (product_code, imei, model_id, color, storage, condition, selling_price, shop_id, status, created_by, created_at)
  select 'P'||right(d.imei,8), d.imei, m.id, d.color, d.storage, d.cond, d.sell,
    ('11111111-0000-0000-0000-00000000000'||d.shop)::uuid, d.status, 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '10 days'
  from d join public.models m on m.brand=d.brand and m.model=d.model
  returning id, imei
)
insert into public.product_costs (product_id, purchase_price, supplier, created_by)
select ins.id, d.cost, 'Tokyo Wholesale', 'aaaaaaaa-0000-0000-0000-000000000001' from ins join d on d.imei=ins.imei;

insert into public.sales (product_id, sale_price, customer_name, payment, shop_id, sold_by, created_at)
select p.id, x.price, x.cust, x.pay, p.shop_id, x.seller::uuid, x.at
from (values
 ('356789012345681',97800,'Tanaka Hiroshi','Cash','aaaaaaaa-0000-0000-0000-000000000002', now() - interval '2 hours'),
 ('356789012345682',124800,'Sato Yuki','PayPay','aaaaaaaa-0000-0000-0000-000000000001', now() - interval '5 hours'),
 ('356789012345683',33800,'Suzuki Ken','Card','aaaaaaaa-0000-0000-0000-000000000001', now() - interval '3 days'),
 ('356789012345684',112000,'Kim Minji','Card','aaaaaaaa-0000-0000-0000-000000000001', now() - interval '6 days'),
 ('356789012345685',24800,'Nguyen Anh','Cash','aaaaaaaa-0000-0000-0000-000000000002', now() - interval '8 days')
) as x(imei, price, cust, pay, seller, at)
join public.products p on p.imei = x.imei
order by x.at;