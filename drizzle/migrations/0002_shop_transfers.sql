ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status in ('in_stock','in_transit','sold'));
ALTER TABLE public.products ADD COLUMN current_shop_id uuid REFERENCES public.shops(id);
UPDATE public.products SET current_shop_id = shop_id WHERE current_shop_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_current_shop() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if new.current_shop_id is null then new.current_shop_id := new.shop_id; end if;
  return new;
end $$;
CREATE TRIGGER products_set_current_shop BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_current_shop();

CREATE TABLE public.transfers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  from_shop_id uuid not null references public.shops(id),
  to_shop_id uuid not null references public.shops(id),
  status text not null default 'requested' check (status in ('requested','accepted','rejected','received','cancelled')),
  requested_by uuid not null,
  accepted_by uuid,
  received_by uuid,
  reject_reason text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  received_at timestamptz
);
CREATE UNIQUE INDEX transfers_one_open ON public.transfers(product_id) WHERE status in ('requested','accepted');
GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read transfers own shop or owner" ON public.transfers FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'owner') OR from_shop_id = my_shop_id() OR to_shop_id = my_shop_id());

CREATE FUNCTION public.request_transfer(_product_id uuid) RETURNS public.transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.products; t public.transfers; me uuid := my_shop_id();
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then raise exception 'Not allowed'; end if;
  if me is null then raise exception 'Your account has no shop'; end if;
  select * into p from products where id = _product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p.status <> 'in_stock' then raise exception 'This phone is not in stock'; end if;
  if p.current_shop_id = me then raise exception 'This phone is already in your shop'; end if;
  if exists (select 1 from transfers where product_id = p.id and status in ('requested','accepted')) then
    raise exception 'This phone already has an open transfer request'; end if;
  insert into transfers (product_id, from_shop_id, to_shop_id, requested_by)
  values (p.id, p.current_shop_id, me, auth.uid()) returning * into t;
  return t;
end $$;

CREATE FUNCTION public.respond_transfer(_transfer_id uuid, _accept boolean, _reason text) RETURNS public.transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE FUNCTION public.receive_transfer(_transfer_id uuid, _code text) RETURNS public.transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE FUNCTION public.cancel_transfer(_transfer_id uuid) RETURNS public.transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare t public.transfers;
begin
  select * into t from transfers where id = _transfer_id for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.requested_by <> auth.uid() then raise exception 'Only the requester can cancel'; end if;
  if t.status <> 'requested' then raise exception 'Can only cancel while requested'; end if;
  update transfers set status = 'cancelled' where id = t.id returning * into t;
  return t;
end $$;

CREATE OR REPLACE FUNCTION public.complete_sale(_product_id uuid, _sale_price integer, _customer_name text, _payment text, _staff_code text)
RETURNS public.sales LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.products; s public.sales; code text := upper(trim(_staff_code)); sid uuid; sname text;
begin
  if auth.uid() is null or not (has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')) then raise exception 'Not allowed'; end if;
  perform check_staff_code(code);
  select * into p from products where id = _product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if p.status = 'sold' then raise exception 'This phone is already sold'; end if;
  if p.status = 'in_transit' then raise exception 'This phone is in transit and cannot be sold'; end if;
  select pr.shop_id into sid from profiles pr where pr.staff_code = code;
  if sid is not null and sid <> p.current_shop_id then
    select name into sname from shops where id = p.current_shop_id;
    raise exception 'This phone is at %. Request a transfer first.', sname;
  end if;
  insert into sales (product_id, sale_price, customer_name, payment, shop_id, sold_by, staff_code)
  values (p.id, _sale_price, nullif(trim(_customer_name), ''), _payment, p.current_shop_id, auth.uid(), code)
  returning * into s;
  update products set status = 'sold' where id = p.id;
  return s;
end $$;

GRANT EXECUTE ON FUNCTION public.request_transfer(uuid), public.respond_transfer(uuid, boolean, text),
  public.receive_transfer(uuid, text), public.cancel_transfer(uuid) TO authenticated;