CREATE TABLE public.suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, company_name text NOT NULL DEFAULT '', contact_person text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', payment_terms text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
GRANT SELECT ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manager supplier details" ON public.suppliers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
CREATE UNIQUE INDEX suppliers_unique_name ON public.suppliers (lower(btrim(name)));
CREATE FUNCTION public.validate_supplier() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 NEW.name:=btrim(NEW.name); IF NEW.name IS NULL OR length(NEW.name)<1 OR length(NEW.name)>100 THEN RAISE EXCEPTION 'Supplier name is required (maximum 100 characters)'; END IF;
 IF NEW.status IS NULL OR NEW.status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Invalid supplier status'; END IF;
 NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER validate_supplier BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.validate_supplier();
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_row();
ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id);
INSERT INTO public.suppliers(name,created_by)
 SELECT DISTINCT ON (lower(btrim(supplier))) btrim(supplier),created_by FROM public.product_costs WHERE nullif(btrim(supplier),'') IS NOT NULL ORDER BY lower(btrim(supplier)),created_at;
UPDATE public.products p SET supplier_id=s.id FROM public.product_costs c JOIN public.suppliers s ON lower(btrim(c.supplier))=lower(s.name) WHERE c.product_id=p.id;
CREATE FUNCTION public.save_supplier(_id uuid, _details jsonb) RETURNS public.suppliers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.suppliers; BEGIN
 IF NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Only owners and managers can manage suppliers'; END IF;
 IF _id IS NULL THEN
 INSERT INTO suppliers(name,company_name,contact_person,phone,email,address,notes,payment_terms,status,created_by) VALUES (_details->>'name',coalesce(_details->>'company_name',''),coalesce(_details->>'contact_person',''),coalesce(_details->>'phone',''),coalesce(_details->>'email',''),coalesce(_details->>'address',''),coalesce(_details->>'notes',''),coalesce(_details->>'payment_terms',''),coalesce(_details->>'status','active'),auth.uid()) RETURNING * INTO s;
 ELSE
 UPDATE suppliers SET name=_details->>'name',company_name=coalesce(_details->>'company_name',''),contact_person=coalesce(_details->>'contact_person',''),phone=coalesce(_details->>'phone',''),email=coalesce(_details->>'email',''),address=coalesce(_details->>'address',''),notes=coalesce(_details->>'notes',''),payment_terms=coalesce(_details->>'payment_terms',''),status=coalesce(_details->>'status','active') WHERE id=_id RETURNING * INTO s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF; END IF; RETURN s; END $$;
REVOKE ALL ON FUNCTION public.save_supplier(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_supplier(uuid,jsonb) TO authenticated;
CREATE FUNCTION public.active_suppliers() RETURNS TABLE(id uuid,name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 RETURN QUERY SELECT s.id,s.name FROM suppliers s WHERE s.status='active' ORDER BY lower(s.name); END $$;
REVOKE ALL ON FUNCTION public.active_suppliers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.active_suppliers() TO authenticated;
CREATE FUNCTION public.link_purchase_supplier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid; BEGIN
 SELECT id INTO sid FROM suppliers WHERE lower(name)=lower(btrim(NEW.supplier)) AND status='active' FOR SHARE;
 IF sid IS NULL THEN RAISE EXCEPTION 'Pick an active supplier'; END IF;
 UPDATE products SET supplier_id=sid WHERE id=NEW.product_id;
 RETURN NEW; END $$;
CREATE TRIGGER link_purchase_supplier BEFORE INSERT ON public.product_costs FOR EACH ROW EXECUTE FUNCTION public.link_purchase_supplier();
CREATE FUNCTION public.add_product_with_supplier(_shop_id uuid,_model_id uuid,_imei text,_color text,_storage text,_condition text,_purchase_price integer,_selling_price integer,_supplier_id uuid,_staff_code text,_supplier_payment text,_paid_amount integer) RETURNS public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sn text; p public.products; BEGIN
 SELECT name INTO sn FROM suppliers WHERE id=_supplier_id AND status='active' FOR SHARE;
 IF sn IS NULL THEN RAISE EXCEPTION 'Pick an active supplier'; END IF;
 p:=public.add_product(_shop_id,_model_id,_imei,_color,_storage,_condition,_purchase_price,_selling_price,sn,_staff_code,_supplier_payment,_paid_amount);
 SELECT * INTO p FROM products WHERE id=p.id; RETURN p; END $$;
REVOKE ALL ON FUNCTION public.add_product_with_supplier(uuid,uuid,text,text,text,text,integer,integer,uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_product_with_supplier(uuid,uuid,text,text,text,text,integer,integer,uuid,text,text,integer) TO authenticated;
CREATE FUNCTION public.add_products_bulk_with_supplier(_shop_id uuid,_supplier_id uuid,_staff_code text,_supplier_payment text,_paid_amount integer,_items jsonb) RETURNS SETOF public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sn text; BEGIN
 SELECT name INTO sn FROM suppliers WHERE id=_supplier_id AND status='active' FOR SHARE;
 IF sn IS NULL THEN RAISE EXCEPTION 'Pick an active supplier'; END IF;
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items)<1 THEN RAISE EXCEPTION 'Add at least one phone'; END IF;
 RETURN QUERY SELECT p.* FROM public.add_products_bulk(_shop_id,sn,_staff_code,_supplier_payment,_paid_amount,_items) p; END $$;
REVOKE ALL ON FUNCTION public.add_products_bulk_with_supplier(uuid,uuid,text,text,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_products_bulk_with_supplier(uuid,uuid,text,text,integer,jsonb) TO authenticated;
CREATE FUNCTION public.supplier_purchases() RETURNS TABLE(product_id uuid,supplier_id uuid,purchase_price integer,paid_amount integer,supplier_payment text,created_at timestamptz,product_code text,imei text,storage text,color text,shop_id uuid,model_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Only owners and managers can view supplier purchases'; END IF;
 RETURN QUERY SELECT p.id,p.supplier_id,c.purchase_price,c.paid_amount,c.supplier_payment,c.created_at,p.product_code,p.imei,p.storage,p.color,p.shop_id,m.brand||' '||m.model FROM product_costs c JOIN products p ON p.id=c.product_id JOIN models m ON m.id=p.model_id WHERE has_role(auth.uid(),'owner') OR p.shop_id=my_shop_id() ORDER BY c.created_at DESC; END $$;
REVOKE ALL ON FUNCTION public.supplier_purchases() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supplier_purchases() TO authenticated;
DROP POLICY "read sales own shop or owner" ON public.sales;
CREATE POLICY "read sales own shop or owner" ON public.sales FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner') OR ((has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager')) AND shop_id=my_shop_id()));
DROP POLICY "read receipts own shop or owner" ON public.receipts;
CREATE POLICY "read receipts own shop or owner" ON public.receipts FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner') OR ((has_role(auth.uid(),'staff') OR has_role(auth.uid(),'manager')) AND shop_id=my_shop_id()));
DO $$ DECLARE f record; BEGIN FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('add_product','complete_cart_sale') LOOP
 EXECUTE replace(replace(pg_get_functiondef(f.oid),$a$has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff')$a$,$b$has_role(auth.uid(),'owner') or has_role(auth.uid(),'staff') or has_role(auth.uid(),'manager')$b$),$c$has_role(uid,'owner') or has_role(uid,'staff')$c$,$d$has_role(uid,'owner') or has_role(uid,'staff') or has_role(uid,'manager')$d$);
 END LOOP; END $$;