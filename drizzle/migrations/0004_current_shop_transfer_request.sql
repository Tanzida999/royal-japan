CREATE OR REPLACE FUNCTION public.request_transfer_to_shop(_product_id uuid,_to_shop_id uuid) RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.products; t public.transfers; BEGIN
IF auth.uid() IS NULL OR NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
IF NOT has_role(auth.uid(),'owner') AND _to_shop_id IS DISTINCT FROM my_shop_id() THEN RAISE EXCEPTION 'Requests must be for your shop'; END IF;
IF _to_shop_id IS NULL OR NOT EXISTS(SELECT 1 FROM shops WHERE id=_to_shop_id) THEN RAISE EXCEPTION 'Pick a destination shop'; END IF;
PERFORM expire_transfer_requests();
SELECT * INTO p FROM products WHERE id=_product_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
IF p.status<>'in_stock' THEN RAISE EXCEPTION 'This phone is not in stock'; END IF;
IF p.current_shop_id=_to_shop_id THEN RAISE EXCEPTION 'This phone is already in your shop'; END IF;
IF EXISTS(SELECT 1 FROM transfers WHERE product_id=p.id AND status IN ('requested','accepted')) THEN RAISE EXCEPTION 'This phone already has an open transfer request'; END IF;
INSERT INTO transfers(product_id,from_shop_id,to_shop_id,requested_by) VALUES(p.id,p.current_shop_id,_to_shop_id,auth.uid()) RETURNING * INTO t; RETURN t; END $$;
REVOKE ALL ON FUNCTION public.request_transfer_to_shop(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_transfer_to_shop(uuid,uuid) TO authenticated;