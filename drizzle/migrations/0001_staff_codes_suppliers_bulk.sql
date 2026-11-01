CREATE SEQUENCE IF NOT EXISTS public.staff_seq;
ALTER TABLE public.profiles ADD COLUMN staff_code text;
UPDATE public.profiles p SET staff_code = 'STF-' || lpad(nextval('public.staff_seq')::text, 3, '0')
  FROM (SELECT id FROM public.profiles ORDER BY name) o WHERE o.id = p.id AND p.staff_code IS NULL;
ALTER TABLE public.profiles ALTER COLUMN staff_code SET DEFAULT ('STF-' || lpad(nextval('public.staff_seq')::text, 3, '0'));
ALTER TABLE public.profiles ALTER COLUMN staff_code SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_staff_code_key UNIQUE (staff_code);

ALTER TABLE public.products ADD COLUMN staff_code text;
ALTER TABLE public.sales ADD COLUMN staff_code text;
ALTER TABLE public.product_costs ADD COLUMN supplier_payment text NOT NULL DEFAULT 'Cash';
ALTER TABLE public.product_costs ADD COLUMN paid_amount integer;
UPDATE public.product_costs SET paid_amount = purchase_price WHERE paid_amount IS NULL;

CREATE OR REPLACE FUNCTION public.my_shop_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select shop_id from public.profiles where id = auth.uid() $$;

DROP POLICY IF EXISTS "auth read sales" ON public.sales;
CREATE POLICY "read sales own shop or owner" ON public.sales FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR shop_id = public.my_shop_id());
CREATE POLICY "owner read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.check_staff_code(_code text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare n text;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select p.name into n from profiles p where p.staff_code = upper(trim(_code))
    and exists (select 1 from user_roles r where r.user_id = p.id);
  if n is null then raise exception 'Wrong staff code: %', _code; end if;
  return n;
end $$;

DROP FUNCTION IF EXISTS public.add_product(uuid, uuid, text, text, text, text, integer, integer, text);
CREATE FUNCTION public.add_product(_shop_id uuid, _model_id uuid, _imei text, _color text, _storage text, _condition text,
  _purchase_price integer, _selling_price integer, _supplier text, _staff_code text, _supplier_payment text, _paid_amount integer)
RETURNS public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE FUNCTION public.add_products_bulk(_shop_id uuid, _supplier text, _staff_code text, _supplier_payment text, _paid_amount integer, _items jsonb)
RETURNS SETOF public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare it jsonb; p public.products; remaining integer := coalesce(_paid_amount,0); pp integer; mode text; part integer;
begin
  for it in select * from jsonb_array_elements(_items) loop
    pp := (it->>'purchase_price')::int;
    if _supplier_payment = 'Partial' then
      part := least(remaining, pp); remaining := remaining - part;
      mode := 'Partial';
    else part := null; mode := _supplier_payment; end if;
    p := public.add_product(_shop_id, (it->>'model_id')::uuid, it->>'imei', it->>'color', it->>'storage', it->>'condition',
      pp, (it->>'selling_price')::int, _supplier, _staff_code, mode, part);
    return next p;
  end loop;
end $$;

DROP FUNCTION IF EXISTS public.complete_sale(uuid, integer, text, text);
CREATE FUNCTION public.complete_sale(_product_id uuid, _sale_price integer, _customer_name text, _payment text, _staff_code text)
RETURNS public.sales LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.products; s public.sales; code text := upper(trim(_staff_code)); sid uuid;
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then raise exception 'Not allowed'; end if;
  perform check_staff_code(code);
  select * into p from products where id = _product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p.status <> 'in_stock' then raise exception 'This phone is already sold'; end if;
  select coalesce(pr.shop_id, p.shop_id) into sid from profiles pr where pr.staff_code = code;
  insert into sales (product_id, sale_price, customer_name, payment, shop_id, sold_by, staff_code)
  values (p.id, _sale_price, nullif(trim(_customer_name), ''), _payment, coalesce(sid, p.shop_id), auth.uid(), code)
  returning * into s;
  update products set status = 'sold' where id = p.id;
  return s;
end $$;

GRANT EXECUTE ON FUNCTION public.check_staff_code(text), public.my_shop_id(),
  public.add_product(uuid, uuid, text, text, text, text, integer, integer, text, text, text, integer),
  public.add_products_bulk(uuid, text, text, text, integer, jsonb),
  public.complete_sale(uuid, integer, text, text, text) TO authenticated;