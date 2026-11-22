-- Auto-detect model / storage / colour from an IMEI, using phones already added in ANY shop
-- with the same TAC (first 8 digits = model code). Safe to run more than once.
create index if not exists products_tac_idx on public.products (left(imei, 8));

create or replace function public.imei_model_hint(_imei text)
returns table(model_id uuid, storage text, color text, matches integer)
language sql stable security definer set search_path = public as $$
  with same as (
    select p.model_id, p.storage, p.color, p.created_at
    from products p
    where auth.uid() is not null and _imei ~ '^[0-9]{15}$'
      and left(p.imei, 8) = left(_imei, 8) and p.imei <> _imei
    order by p.created_at desc
    limit 50),
  best as (
    select s.model_id, count(*) as n, max(s.created_at) as last_at
    from same s group by s.model_id order by n desc, last_at desc limit 1)
  select b.model_id,
    (select s.storage from same s where s.model_id = b.model_id and coalesce(s.storage,'') <> '' order by s.created_at desc limit 1),
    (select s.color from same s where s.model_id = b.model_id and coalesce(s.color,'') <> '' order by s.created_at desc limit 1),
    b.n::int
  from best b
$$;
revoke all on function public.imei_model_hint(text) from public, anon;
grant execute on function public.imei_model_hint(text) to authenticated;
