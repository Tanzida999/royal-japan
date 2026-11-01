CREATE OR REPLACE FUNCTION public.guard_staff_product_shop() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'owner') AND NEW.shop_id IS DISTINCT FROM public.my_shop_id() THEN RAISE EXCEPTION 'Purchases must be for your assigned shop'; END IF; RETURN NEW; END $$;
CREATE TRIGGER enforce_purchase_shop BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_staff_product_shop();
CREATE OR REPLACE FUNCTION public.guard_staff_sale_shop() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'owner') AND NEW.shop_id IS DISTINCT FROM public.my_shop_id() THEN RAISE EXCEPTION 'Sale must be at your assigned shop'; END IF; RETURN NEW; END $$;
CREATE TRIGGER enforce_sale_shop BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_staff_sale_shop();