-- Fix a product's details after it was added (wrong model, colour, storage, IMEI…). Safe to run more than once.
-- Owner/manager: any product. Staff: only in-stock products of their own shop. Every change is in the audit log.
create or replace function public.update_product_details(_id uuid, _imei text, _model_id uuid, _color text, _storage text,
  _condition text, _selling_price integer, _battery integer)
returns public.products language plpgsql security definer set search_path = public as $$
declare p products; priv boolean := has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager');
  i text := upper(regexp_replace(coalesce(_imei,''), '\s', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  select * into p from products where id = _id for update;
  if not found then raise exception 'Product not found'; end if;
  if not priv and not can_edit_product(_id) then raise exception 'You can only edit products of your own shop'; end if;
  if not priv and p.status <> 'in_stock' then raise exception 'This product is %. Only the owner or a manager can edit it now', replace(p.status,'_',' '); end if;
  if i !~ '^[0-9]{15}$' and i !~ '^[A-Z0-9][A-Z0-9-]{4,29}$' then raise exception 'Enter a 15-digit IMEI or a serial number'; end if;
  if exists (select 1 from products x where x.imei = i and x.id <> _id) then raise exception 'Another product already has IMEI/serial %', i; end if;
  if not exists (select 1 from models where id = _model_id) then raise exception 'Pick a model'; end if;
  if _selling_price is null or _selling_price < 0 then raise exception 'Enter a selling price'; end if;
  if _battery is not null and (_battery < 1 or _battery > 100) then raise exception 'Battery health must be 1 to 100'; end if;
  update products set imei = i, model_id = _model_id,
    color = left(btrim(coalesce(_color,'')), 50), storage = left(btrim(coalesce(_storage,'')), 50),
    condition = coalesce(nullif(btrim(coalesce(_condition,'')),''), condition),
    selling_price = _selling_price, battery_health = _battery
  where id = _id returning * into p;
  return p;
end $$;
revoke all on function public.update_product_details(uuid,text,uuid,text,text,text,integer,integer) from public, anon;
grant execute on function public.update_product_details(uuid,text,uuid,text,text,text,integer,integer) to authenticated;
