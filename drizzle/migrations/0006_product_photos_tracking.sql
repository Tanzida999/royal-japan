ALTER TABLE public.products ADD COLUMN carrier text, ADD COLUMN tracking_number text;

CREATE TABLE public.product_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  url text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_photos_product_idx ON public.product_photos(product_id);
GRANT SELECT ON public.product_photos TO authenticated;
GRANT ALL ON public.product_photos TO service_role;
ALTER TABLE public.product_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read product photos" ON public.product_photos FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.can_edit_product(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from products p where p.id = _product_id
    and (has_role(auth.uid(),'owner') or (has_role(auth.uid(),'staff') and my_shop_id() in (p.shop_id, p.current_shop_id))))
$$;

CREATE OR REPLACE FUNCTION public.add_product_photos(_product_id uuid, _paths text[])
RETURNS SETOF public.product_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare pth text; ph public.product_photos;
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed'; end if;
  if coalesce(array_length(_paths,1),0) = 0 then raise exception 'No photos'; end if;
  if (select count(*) from product_photos where product_id = _product_id) + array_length(_paths,1) > 6 then raise exception 'A product can have at most 6 photos'; end if;
  foreach pth in array _paths loop
    if pth not like _product_id::text || '/%' then raise exception 'Invalid photo path'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'product-photos' and o.name = pth) then raise exception 'Photo was not uploaded'; end if;
    insert into product_photos (product_id, url, uploaded_by) values (_product_id, pth, auth.uid()) returning * into ph;
    return next ph;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.set_product_tracking(_product_id uuid, _carrier text, _tracking_number text)
RETURNS public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p public.products; c text := nullif(trim(coalesce(_carrier,'')),''); t text := nullif(upper(regexp_replace(coalesce(_tracking_number,''),'\s','','g')),'');
begin
  if auth.uid() is null or not can_edit_product(_product_id) then raise exception 'Not allowed'; end if;
  if c is not null and c not in ('Japan Post','Yamato','Sagawa','Other') then raise exception 'Invalid carrier'; end if;
  if t is not null and (c is null or t !~ '^[A-Z0-9-]{4,40}$') then raise exception 'Enter a carrier and a valid tracking number'; end if;
  if t is null then c := null; end if;
  update products set carrier = c, tracking_number = t where id = _product_id returning * into p;
  return p;
end $$;

REVOKE EXECUTE ON FUNCTION public.add_product_photos(uuid, text[]) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_product_tracking(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_product_photos(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_tracking(uuid, text, text) TO authenticated;

CREATE POLICY "read product photo files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "upload product photo files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'product-photos' AND exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[1] and public.can_edit_product(p.id))
);