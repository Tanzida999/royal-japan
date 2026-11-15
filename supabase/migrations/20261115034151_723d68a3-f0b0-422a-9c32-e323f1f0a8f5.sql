create or replace function public.shared_pos_receipt(_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
with target as (select * from public.receipts where share_token=_token), lines as (
select x.value,x.ordinality,r.total,sum((x.value->>'price')::numeric) over() as base,sum((x.value->>'price')::numeric) over(order by x.ordinality rows unbounded preceding) as cumulative
from target r cross join lateral jsonb_array_elements(r.items) with ordinality x(value,ordinality)
)
select jsonb_build_object('receipt_no',r.receipt_no,'date',r.created_at,'shop',r.shop_snapshot->>'name','total',r.total,'tax',r.tax,'items',
(select jsonb_agg(jsonb_build_object('name',value->>'model','quantity',coalesce(value->>'quantity','1'),'amount',case when base=0 then 0 else floor(cumulative*total/base)-floor((cumulative-(value->>'price')::numeric)*total/base) end) order by ordinality) from lines)) from target r $$;
comment on function public.shared_pos_receipt(uuid) is 'Intentionally public high-entropy bearer receipt link. Returns only shop, receipt number, date, tax, total and discounted item names/quantities. No customer contacts, staff, IMEI or internal identifiers. Arbitrary receipt listing is not available.';
comment on function public.pos_shop_access(uuid) is 'Intentionally callable by authenticated users for RLS: validates active roles and assigned shop; owners may select shops.';
comment on function public.save_pos_record(text,uuid,uuid,jsonb) is 'Intentionally authenticated RPC-only write boundary. Checks active role and shop on all actions and owner/manager authority for stock/settings; audit triggers record writes.';