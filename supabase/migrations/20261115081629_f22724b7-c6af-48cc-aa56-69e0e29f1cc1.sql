DROP POLICY "owner manager supplier details" ON public.suppliers;
CREATE POLICY "signed in supplier details" ON public.suppliers FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));
CREATE OR REPLACE FUNCTION public.save_supplier(_id uuid, _details jsonb) RETURNS public.suppliers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.suppliers; BEGIN
 IF NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF _id IS NULL THEN
 INSERT INTO suppliers(name,company_name,contact_person,phone,email,address,notes,payment_terms,status,created_by) VALUES (_details->>'name',coalesce(_details->>'company_name',''),coalesce(_details->>'contact_person',''),coalesce(_details->>'phone',''),coalesce(_details->>'email',''),coalesce(_details->>'address',''),coalesce(_details->>'notes',''),coalesce(_details->>'payment_terms',''),coalesce(_details->>'status','active'),auth.uid()) RETURNING * INTO s;
 ELSE
 UPDATE suppliers SET name=_details->>'name',company_name=coalesce(_details->>'company_name',''),contact_person=coalesce(_details->>'contact_person',''),phone=coalesce(_details->>'phone',''),email=coalesce(_details->>'email',''),address=coalesce(_details->>'address',''),notes=coalesce(_details->>'notes',''),payment_terms=coalesce(_details->>'payment_terms',''),status=coalesce(_details->>'status','active') WHERE id=_id RETURNING * INTO s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF; END IF; RETURN s; END $$;
REVOKE ALL ON FUNCTION public.save_supplier(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_supplier(uuid,jsonb) TO authenticated;
CREATE FUNCTION public.supplier_link_count(_id uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT count(*) FROM (SELECT p.id FROM products p WHERE p.supplier_id=_id UNION SELECT c.product_id FROM product_costs c JOIN products p ON p.id=c.product_id JOIN suppliers s ON s.id=_id WHERE p.supplier_id=_id OR (p.supplier_id IS NULL AND lower(btrim(c.supplier))=lower(btrim(s.name)))) linked;
$$;
REVOKE ALL ON FUNCTION public.supplier_link_count(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.guard_supplier_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE linked bigint; BEGIN
 linked:=public.supplier_link_count(OLD.id);
 IF linked>0 THEN RAISE EXCEPTION 'This supplier is used in % products. Deactivate instead?',linked; END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.guard_supplier_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_supplier_delete BEFORE DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_delete();
CREATE FUNCTION public.delete_supplier(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.suppliers; linked bigint; BEGIN
 IF NOT (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT * INTO s FROM suppliers WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;
 linked:=public.supplier_link_count(_id);
 IF linked>0 THEN RETURN jsonb_build_object('deleted',false,'linked_count',linked); END IF;
 DELETE FROM suppliers WHERE id=_id;
 RETURN jsonb_build_object('deleted',true,'linked_count',0);
END $$;
REVOKE ALL ON FUNCTION public.delete_supplier(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_supplier(uuid) TO authenticated;
CREATE FUNCTION public.audit_supplier_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o jsonb; n jsonb; pr public.profiles; act text; rid text; BEGIN
 IF TG_OP<>'INSERT' THEN o:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN n:=to_jsonb(NEW); END IF;
 SELECT * INTO pr FROM profiles WHERE id=auth.uid();
 act:=CASE WHEN TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status='inactive' THEN 'deactivate' ELSE lower(TG_OP) END;
 rid:=coalesce(n->>'id',o->>'id');
 INSERT INTO audit_log(user_id,user_name,staff_code,shop_id,action,table_name,record_id,old_values,new_values,device) VALUES(auth.uid(),pr.name,pr.staff_code,pr.shop_id,act,'suppliers',rid,o,n,request_device());
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_supplier_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER audit_suppliers ON public.suppliers;
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_supplier_change();