-- Battery health (%) on products, and the iPhone 18 series models. Safe to run more than once.
alter table public.products add column if not exists battery_health smallint;
do $$ begin
  alter table public.products add constraint products_battery_health_check check (battery_health is null or battery_health between 1 and 100);
exception when duplicate_object then null; end $$;

create or replace function public.set_product_battery(_product_id uuid, _battery integer)
returns public.products language plpgsql security definer set search_path = public as $$
declare p products;
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed to change this product'; end if;
  if _battery is not null and (_battery < 1 or _battery > 100) then raise exception 'Battery health must be between 1 and 100%%'; end if;
  update products set battery_health = _battery where id = _product_id returning * into p;
  return p;
end $$;
revoke all on function public.set_product_battery(uuid, integer) from public, anon;
grant execute on function public.set_product_battery(uuid, integer) to authenticated;

-- iPhone 18 series (announced September 2026)
insert into public.models (brand, model, category_id, sort)
select 'Apple', m.name, (select id from public.categories where name = 'iPhone'), coalesce((select max(sort) from public.models where brand = 'Apple'), 0) + m.n
from (values ('iPhone 18 Pro', 1), ('iPhone 18 Pro Max', 2), ('iPhone Duo', 3)) as m(name, n)
where not exists (select 1 from public.models x where x.brand = 'Apple' and lower(x.model) = lower(m.name));
-- make sure any iPhone 18 models added earlier are in the iPhone category
update public.models set category_id = (select id from public.categories where name = 'iPhone')
where brand = 'Apple' and (model ilike 'iPhone 18%' or model ilike 'iPhone Duo%') and category_id is distinct from (select id from public.categories where name = 'iPhone');
