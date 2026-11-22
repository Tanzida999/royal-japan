-- Box barcode (JAN / EAN / UPC) → exact model, storage and colour. Learned the first time a box is added.
-- Safe to run more than once.
create table if not exists public.product_skus (
  jan text primary key check (jan ~ '^[0-9]{8,14}$'),
  model_id uuid not null references public.models(id),
  storage text not null default '',
  color text not null default '',
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.product_skus enable row level security;
drop policy if exists "read product skus" on public.product_skus;
create policy "read product skus" on public.product_skus for select to authenticated using (true);

create or replace function public.learn_sku(_jan text, _model_id uuid, _storage text, _color text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please log in again'; end if;
  if _jan !~ '^[0-9]{8,14}$' then raise exception 'Box barcode must be 8 to 14 digits'; end if;
  if not exists (select 1 from models where id = _model_id) then raise exception 'Model not found'; end if;
  insert into product_skus(jan, model_id, storage, color)
  values (_jan, _model_id, left(coalesce(_storage,''), 50), left(coalesce(_color,''), 50))
  on conflict (jan) do update set model_id = excluded.model_id, storage = excluded.storage, color = excluded.color,
    created_by = auth.uid(), updated_at = now();
end $$;
revoke all on function public.learn_sku(text, uuid, text, text) from public, anon;
grant execute on function public.learn_sku(text, uuid, text, text) to authenticated;
