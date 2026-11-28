-- Staff can add a missing model while adding a product (they can't rename or move existing models).
-- If the same brand + model already exists (any capitals / extra spaces), that model is returned instead of a duplicate.
-- Safe to run again.
-- Audit helper for server functions (any action name). Only callable from other database functions.
create or replace function public.log_app_event(_action text, _table text, _record_id text, _details jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  select * into pr from profiles where id = auth.uid();
  insert into audit_log (user_id, user_name, staff_code, shop_id, action, table_name, record_id, new_values, device)
  values (auth.uid(), pr.name, pr.staff_code, coalesce(nullif(_details->>'shop_id','')::uuid, pr.shop_id), left(_action,50), left(_table,50), left(_record_id,100), _details, request_device());
end $$;
revoke all on function public.log_app_event(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.add_model(_brand text, _model text, _category_id uuid)
returns public.models language plpgsql security definer set search_path = public as $$
declare
  m models;
  b text := regexp_replace(btrim(coalesce(_brand, '')), '\s+', ' ', 'g');
  n text := regexp_replace(btrim(coalesce(_model, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null or not (has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager') or has_role(auth.uid(), 'staff')) then
    raise exception 'Not allowed';
  end if;
  if length(b) not between 1 and 50 then raise exception 'Enter the brand (e.g. Apple, Samsung)'; end if;
  if length(n) not between 1 and 100 then raise exception 'Enter the model name'; end if;
  if _category_id is null or not exists (select 1 from categories where id = _category_id) then raise exception 'Pick a category'; end if;

  -- use the existing spelling of the brand if it is already known (e.g. "apple" → "Apple")
  b := coalesce((select brand from models where lower(brand) = lower(b) order by brand limit 1), b);

  select * into m from models where lower(brand) = lower(b) and lower(regexp_replace(model, '\s+', ' ', 'g')) = lower(n) limit 1;
  if found then return m; end if;

  insert into models (brand, model, category_id, sort)
  values (b, n, _category_id, coalesce((select max(sort) + 1 from models where brand = b), 0))
  returning * into m;
  perform log_app_event('add_model', 'models', m.id::text, jsonb_build_object('brand', b, 'model', n, 'category_id', _category_id));
  return m;
exception when unique_violation then
  select * into m from models where brand = b and model = n;
  return m;
end $$;

revoke all on function public.add_model(text, text, uuid) from public, anon;
grant execute on function public.add_model(text, text, uuid) to authenticated;
