-- Every phone in stock appears on kaitorinihon.jp automatically (no "Show on website" click needed).
-- Sold phones disappear by themselves. The owner can still hide one phone from its product page.
-- Photos of listed phones become readable by the website. Safe to run again.

alter table public.products alter column show_on_website set default true;
update public.products set show_on_website = true where status in ('in_stock', 'in_transit') and not show_on_website;

create or replace view public.web_products_for_sale as
  select p.id, p.product_code, m.brand, m.model, c.name as category, p.storage, p.color, p.condition,
         p.battery_health, p.selling_price, s.name as shop, p.created_at,
         coalesce((select array_agg(ph.url order by ph.created_at) from public.product_photos ph where ph.product_id = p.id), '{}') as photo_paths,
         coalesce(p.specs, '{}'::jsonb) as specs
  from public.products p
  join public.models m on m.id = p.model_id
  left join public.categories c on c.id = m.category_id
  left join public.shops s on s.id = p.current_shop_id
  where p.status = 'in_stock' and p.show_on_website;
grant select on public.web_products_for_sale to anon, authenticated;

-- Website may read photos only of phones that are listed for sale right now
drop policy if exists "website reads listed product photos" on storage.objects;
create policy "website reads listed product photos" on storage.objects for select to anon using (
  bucket_id = 'product-photos' and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[1] and p.status = 'in_stock' and p.show_on_website));
