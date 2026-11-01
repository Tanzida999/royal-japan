ALTER TABLE public.shops ADD COLUMN address text NOT NULL DEFAULT '', ADD COLUMN postal_code text NOT NULL DEFAULT '', ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN email text NOT NULL DEFAULT '', ADD COLUMN receipt_footer text NOT NULL DEFAULT '', ADD COLUMN logo text;
CREATE TABLE public.app_settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), transit_limit_hours integer NOT NULL DEFAULT 24 CHECK (transit_limit_hours > 0 AND transit_limit_hours <= 8760));
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.save_shop_profile(_id uuid, _name text, _address text, _postal_code text, _phone text, _email text, _receipt_footer text, _logo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner only'; END IF;
IF trim(_name) = '' THEN RAISE EXCEPTION 'Shop name is required'; END IF;
UPDATE shops SET name=left(trim(_name),100), address=left(_address,500), postal_code=left(_postal_code,30), phone=left(_phone,50), email=left(_email,200), receipt_footer=left(_receipt_footer,2000), logo=nullif(_logo,'') WHERE id=_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Shop not found'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.save_transit_limit(_hours integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner only'; END IF;
IF _hours IS NULL OR _hours < 1 OR _hours > 8760 THEN RAISE EXCEPTION 'Enter a limit between 1 and 8760 hours'; END IF;
INSERT INTO app_settings(id,transit_limit_hours) VALUES(true,_hours) ON CONFLICT(id) DO UPDATE SET transit_limit_hours=excluded.transit_limit_hours; END $$;
CREATE TABLE public.receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_no text NOT NULL UNIQUE DEFAULT ('R-' || lpad(nextval('public.receipt_seq')::text,4,'0')), shop_id uuid NOT NULL REFERENCES public.shops(id), sold_by uuid NOT NULL, staff_code text NOT NULL, staff_name text NOT NULL, customer_name text NOT NULL DEFAULT '', customer_phone text NOT NULL DEFAULT '', payment text NOT NULL CHECK(payment IN ('Cash','Card','PayPay','Bank')), subtotal integer NOT NULL CHECK(subtotal>=0), discount integer NOT NULL DEFAULT 0 CHECK(discount>=0), total integer NOT NULL CHECK(total>=0), paid integer NOT NULL CHECK(paid>=0), change_due integer NOT NULL DEFAULT 0 CHECK(change_due>=0), shop_snapshot jsonb NOT NULL, items jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read receipts own shop or owner" ON public.receipts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'owner') OR shop_id=public.my_shop_id());
ALTER TABLE public.sales ADD COLUMN receipt_id uuid REFERENCES public.receipts(id), ADD COLUMN item_price integer;
INSERT INTO public.receipts (receipt_no,shop_id,sold_by,staff_code,staff_name,customer_name,payment,subtotal,total,paid,shop_snapshot,items,created_at)
SELECT s.receipt_no,s.shop_id,s.sold_by,coalesce(s.staff_code,''),coalesce(pr.name,''),coalesce(s.customer_name,''),s.payment,s.sale_price,s.sale_price,s.sale_price,to_jsonb(sh),jsonb_build_array(jsonb_build_object('product_id',p.id,'model',m.brand||' '||m.model,'storage',p.storage,'color',p.color,'condition',p.condition,'imei',p.imei,'price',s.sale_price)),s.created_at FROM public.sales s JOIN public.shops sh ON sh.id=s.shop_id JOIN public.products p ON p.id=s.product_id JOIN public.models m ON m.id=p.model_id LEFT JOIN public.profiles pr ON pr.staff_code=s.staff_code;
UPDATE public.sales s SET receipt_id=r.id,item_price=s.sale_price FROM public.receipts r WHERE r.receipt_no=s.receipt_no;
ALTER TABLE public.sales DROP CONSTRAINT sales_receipt_no_key;
ALTER TABLE public.sales DROP CONSTRAINT sales_payment_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_check CHECK(payment IN ('Cash','Card','PayPay','Bank'));
CREATE OR REPLACE FUNCTION public.complete_cart_sale(_shop_id uuid,_staff_code text,_items jsonb,_discount integer,_paid integer,_payment text,_customer_name text,_customer_phone text) RETURNS public.receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.receipts; p public.products; sh public.shops; item jsonb; uid uuid:=auth.uid(); staff public.profiles; subtotal bigint:=0; total bigint; cumulative bigint:=0; before_net bigint; net integer; price integer; snap jsonb:='[]'::jsonb; count_items integer;
BEGIN
IF uid IS NULL OR NOT (has_role(uid,'owner') OR has_role(uid,'staff')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
PERFORM check_staff_code(upper(trim(_staff_code)));
SELECT * INTO staff FROM profiles WHERE staff_code=upper(trim(_staff_code));
IF NOT has_role(uid,'owner') AND (_shop_id IS DISTINCT FROM my_shop_id() OR staff.shop_id IS DISTINCT FROM my_shop_id()) THEN RAISE EXCEPTION 'Sale must be at your assigned shop'; END IF;
IF staff.shop_id IS NOT NULL AND staff.shop_id IS DISTINCT FROM _shop_id THEN RAISE EXCEPTION 'Staff badge belongs to another shop'; END IF;
SELECT * INTO sh FROM shops WHERE id=_shop_id; IF NOT FOUND THEN RAISE EXCEPTION 'Pick a shop'; END IF;
IF _payment IS NULL OR _payment NOT IN ('Cash','Card','PayPay','Bank') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Cart must contain items'; END IF;
count_items:=jsonb_array_length(_items); IF count_items<1 OR count_items>100 THEN RAISE EXCEPTION 'Cart must contain 1 to 100 phones'; END IF;
IF (SELECT count(DISTINCT value->>'product_id') FROM jsonb_array_elements(_items))<>count_items THEN RAISE EXCEPTION 'Duplicate phone in cart'; END IF;
PERFORM id FROM products WHERE id IN (SELECT (value->>'product_id')::uuid FROM jsonb_array_elements(_items)) ORDER BY id FOR UPDATE;
FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
SELECT * INTO p FROM products WHERE id=(item->>'product_id')::uuid;
IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
IF p.status<>'in_stock' THEN RAISE EXCEPTION 'Phone % is % and cannot be sold',p.product_code,p.status; END IF;
IF p.current_shop_id IS DISTINCT FROM _shop_id THEN RAISE EXCEPTION 'Phone % is at another shop. Request a transfer first.',p.product_code; END IF;
IF item->>'price' IS NULL OR (item->>'price')!~'^[0-9]+$' THEN RAISE EXCEPTION 'Invalid item price'; END IF;
price:=(item->>'price')::integer; subtotal:=subtotal+price;
snap:=snap||jsonb_build_array(jsonb_build_object('product_id',p.id,'model',(SELECT brand||' '||model FROM models WHERE id=p.model_id),'storage',p.storage,'color',p.color,'condition',p.condition,'imei',p.imei,'price',price));
END LOOP;
IF _discount IS NULL OR _discount<0 OR _discount>subtotal THEN RAISE EXCEPTION 'Invalid discount'; END IF;
total:=subtotal-_discount;
IF _paid IS NULL OR _paid<total THEN RAISE EXCEPTION 'Amount received must cover the total'; END IF;
INSERT INTO receipts(shop_id,sold_by,staff_code,staff_name,customer_name,customer_phone,payment,subtotal,discount,total,paid,change_due,shop_snapshot,items) VALUES(_shop_id,uid,staff.staff_code,staff.name,left(trim(coalesce(_customer_name,'')),100),left(trim(coalesce(_customer_phone,'')),50),_payment,subtotal,_discount,total,_paid,_paid-total,to_jsonb(sh),snap) RETURNING * INTO r;
FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
price:=(item->>'price')::integer; before_net:=CASE WHEN subtotal=0 THEN 0 ELSE floor(cumulative::numeric*total/subtotal)::bigint END; cumulative:=cumulative+price;
net:=CASE WHEN subtotal=0 THEN 0 ELSE floor(cumulative::numeric*total/subtotal)::bigint-before_net END;
INSERT INTO sales(receipt_no,receipt_id,product_id,item_price,sale_price,customer_name,payment,shop_id,sold_by,staff_code,created_at) VALUES(r.receipt_no,r.id,(item->>'product_id')::uuid,price,net,nullif(r.customer_name,''),_payment,_shop_id,uid,staff.staff_code,r.created_at);
UPDATE products SET status='sold' WHERE id=(item->>'product_id')::uuid;
END LOOP; RETURN r; END $$;
ALTER TABLE public.transfers ADD COLUMN cancelled_by uuid, ADD COLUMN cancelled_at timestamptz, ADD COLUMN cancel_reason text;
ALTER TABLE public.transfers DROP CONSTRAINT transfers_status_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_status_check CHECK(status IN ('requested','accepted','rejected','received','cancelled','expired'));
CREATE OR REPLACE FUNCTION public.expire_transfer_requests() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; lim integer; BEGIN SELECT coalesce((SELECT transit_limit_hours FROM app_settings WHERE id=true),24) INTO lim; UPDATE transfers SET status='expired' WHERE status='requested' AND created_at+make_interval(hours=>lim)<=now(); GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.expire_transfer_requests() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_transfer_requests() TO service_role;
CREATE OR REPLACE FUNCTION public.expire_transfer_on_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE lim integer; BEGIN SELECT coalesce((SELECT transit_limit_hours FROM app_settings WHERE id=true),24) INTO lim; IF OLD.status='requested' AND OLD.created_at+make_interval(hours=>lim)<=now() AND NEW.status NOT IN ('expired','requested') THEN RAISE EXCEPTION 'This request has expired'; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_expired_transfer BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.expire_transfer_on_write();
CREATE OR REPLACE FUNCTION public.cancel_overdue_transfer(_transfer_id uuid,_reason text) RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t public.transfers; lim integer; p public.products; BEGIN
IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner only'; END IF;
IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'Cancellation reason is required'; END IF;
SELECT * INTO t FROM transfers WHERE id=_transfer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
lim:=coalesce((SELECT transit_limit_hours FROM app_settings WHERE id=true),24);
IF t.status<>'accepted' OR t.accepted_at+make_interval(hours=>lim)>=now() THEN RAISE EXCEPTION 'Only overdue in-transit transfers can be cancelled'; END IF;
SELECT * INTO p FROM products WHERE id=t.product_id FOR UPDATE;
IF p.status<>'in_transit' THEN RAISE EXCEPTION 'Phone is no longer in transit'; END IF;
UPDATE products SET current_shop_id=t.from_shop_id,status='in_stock' WHERE id=t.product_id;
UPDATE transfers SET status='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=left(trim(_reason),300) WHERE id=t.id RETURNING * INTO t; RETURN t; END $$;
REVOKE ALL ON FUNCTION public.save_shop_profile(uuid,text,text,text,text,text,text,text),public.save_transit_limit(integer),public.complete_cart_sale(uuid,text,jsonb,integer,integer,text,text,text),public.cancel_overdue_transfer(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_shop_profile(uuid,text,text,text,text,text,text,text),public.save_transit_limit(integer),public.complete_cart_sale(uuid,text,jsonb,integer,integer,text,text,text),public.cancel_overdue_transfer(uuid,text) TO authenticated;
CREATE POLICY "staff read shop logos" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='shop-logos');
CREATE POLICY "owner upload shop logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='shop-logos' AND public.has_role(auth.uid(),'owner'));
CREATE POLICY "owner update shop logos" ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='shop-logos' AND public.has_role(auth.uid(),'owner')) WITH CHECK(bucket_id='shop-logos' AND public.has_role(auth.uid(),'owner'));