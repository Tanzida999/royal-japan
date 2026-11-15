alter table public.held_sales drop constraint held_sales_status_check;
alter table public.held_sales add constraint held_sales_status_check check(status in ('held','resumed','cancelled','expired')),add column note text not null default '',add column expires_at timestamptz not null default (now()+interval '24 hours'),add column cancel_reason text,add column resolved_by uuid;
create table public.held_sale_phones(id uuid primary key default gen_random_uuid(),held_id uuid not null references held_sales(id),product_id uuid not null references products(id),shop_id uuid not null references shops(id),released_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(held_id,product_id));
grant select on public.held_sale_phones to authenticated;grant all on public.held_sale_phones to service_role;
alter table public.held_sale_phones enable row level security;create policy "shop reservations" on public.held_sale_phones for select to authenticated using(pos_shop_access(shop_id));
create index held_phone_lookup on held_sale_phones(product_id) where released_at is null;
create function public.phone_reserved(_product uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from held_sale_phones p join held_sales h on h.id=p.held_id where p.product_id=_product and p.released_at is null and h.status='held' and h.expires_at>now()) $$;
revoke all on function public.phone_reserved(uuid) from public,anon;grant execute on function public.phone_reserved(uuid) to authenticated;
create function public.guard_held_phone() returns trigger language plpgsql security definer set search_path=public as $$ begin if (new.status is distinct from old.status or new.current_shop_id is distinct from old.current_shop_id) and phone_reserved(old.id) then raise exception 'Phone is reserved by a held sale';end if;return new;end $$;
revoke all on function public.guard_held_phone() from public,anon,authenticated;
create trigger protect_held_phone before update on products for each row execute function guard_held_phone();
create function public.hold_reservations() returns trigger language plpgsql security definer set search_path=public as $$ declare item jsonb;p products;begin
if tg_op='INSERT' and new.status='held' then
if new.expires_at<>new.created_at+interval '24 hours' then new.expires_at:=new.created_at+interval '24 hours';end if;
if jsonb_typeof(new.cart->'items') is distinct from 'array' then raise exception 'Invalid held cart';end if;
perform id from products where id in(select (x->>'id')::uuid from jsonb_array_elements(new.cart->'items') x where x->>'kind'='phone') order by id for update;
for item in select value from jsonb_array_elements(new.cart->'items') where value->>'kind'='phone' loop
select * into p from products where id=(item->>'id')::uuid;
if not found or p.status<>'in_stock' or p.current_shop_id is distinct from new.shop_id or phone_reserved(p.id) then raise exception 'Held phone is unavailable or already reserved';end if;
insert into held_sale_phones(held_id,product_id,shop_id) values(new.id,p.id,new.shop_id);
end loop;
elsif tg_op='UPDATE' and old.status='held' and new.status<>'held' then update held_sale_phones set released_at=now() where held_id=new.id and released_at is null;end if;return new;end $$;
revoke all on function public.hold_reservations() from public,anon,authenticated;
create trigger held_phone_reservations after insert or update on held_sales for each row execute function hold_reservations();
create function public.resolve_held_sale(_id uuid,_cancel boolean,_reason text) returns jsonb language plpgsql security definer set search_path=public as $$ declare h held_sales;begin
select * into h from held_sales where id=_id for update;
if not found or not coalesce(pos_shop_access(h.shop_id),false) or not (h.created_by=auth.uid() or has_role(auth.uid(),'owner') or has_role(auth.uid(),'manager')) then raise exception 'Held sale unavailable';end if;
if h.status<>'held' then raise exception 'Held sale already resolved';end if;
if _cancel and length(btrim(coalesce(_reason,'')))=0 then raise exception 'Cancellation reason required';end if;
update held_sales set status=case when expires_at<=now() then 'expired' when _cancel then 'cancelled' else 'resumed' end,cancel_reason=case when _cancel then left(btrim(_reason),500) else null end,resolved_by=auth.uid() where id=_id returning * into h;return to_jsonb(h);end $$;
revoke all on function public.resolve_held_sale(uuid,boolean,text) from public,anon;grant execute on function public.resolve_held_sale(uuid,boolean,text) to authenticated;
create function public.expire_held_sales() returns integer language plpgsql security definer set search_path=public as $$ declare n int;begin update held_sales set status='expired' where status='held' and expires_at<=now();get diagnostics n=row_count;return n;end $$;
revoke all on function public.expire_held_sales() from public,anon,authenticated;grant execute on function public.expire_held_sales() to service_role;
create table public.register_sessions(id uuid primary key default gen_random_uuid(),shop_id uuid not null references shops(id),day date not null,opening_cash integer not null check(opening_cash>=0),status text not null default 'open' check(status in ('open','closed')),opened_by uuid not null,closed_by uuid,closed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(shop_id,day));
grant select on public.register_sessions to authenticated;grant all on public.register_sessions to service_role;
alter table public.register_sessions enable row level security;create policy "shop register sessions" on public.register_sessions for select to authenticated using(pos_shop_access(shop_id));
create table public.cash_movements(id uuid primary key default gen_random_uuid(),session_id uuid not null references register_sessions(id),shop_id uuid not null references shops(id),kind text not null check(kind in ('in','out')),amount integer not null check(amount>0),reason text not null check(length(btrim(reason)) between 1 and 500),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
grant select on public.cash_movements to authenticated;grant all on public.cash_movements to service_role;
alter table public.cash_movements enable row level security;create policy "shop cash movements" on public.cash_movements for select to authenticated using(pos_shop_access(shop_id));
alter table public.cash_checks add column session_id uuid references register_sessions(id),add column denominations jsonb not null default '{}',add column kind text not null default 'check' check(kind in ('check','close')),add column summary jsonb not null default '{}';
create unique index one_register_close on cash_checks(session_id) where kind='close';
do $$ declare t text;begin foreach t in array array['held_sale_phones','register_sessions','cash_movements'] loop execute format('create trigger touch before update on public.%I for each row execute function pos_touch()',t);execute format('create trigger audit_register after insert or update on public.%I for each row execute function audit_row()',t);end loop;end $$;
create function public.register_summary(_shop uuid,_day date) returns jsonb language plpgsql stable security definer set search_path=public as $$ declare methods jsonb;cash bigint;discounts bigint;total bigint;cnt int;float bigint;money_in bigint;money_out bigint;sid uuid;begin
if not coalesce(pos_shop_access(_shop),false) then raise exception 'Not allowed for this shop';end if;
select id,opening_cash into sid,float from register_sessions where shop_id=_shop and day=_day;
with receipts_day as(select * from receipts where shop_id=_shop and (created_at at time zone 'Asia/Tokyo')::date=_day),tenders as(select r.id,x->>'method' as method,(x->>'amount')::bigint-case when x->>'method'='Cash' then r.change_due else 0 end as amount from receipts_day r cross join lateral jsonb_array_elements(case when jsonb_array_length(r.payment_breakdown)>0 then r.payment_breakdown else jsonb_build_array(jsonb_build_object('method',r.payment,'amount',r.total)) end) x),sums as(select method,sum(amount) as amount from tenders group by method)
select coalesce(jsonb_object_agg(method,amount),'{}'),coalesce(sum(amount) filter(where method='Cash'),0) into methods,cash from sums;
select coalesce(sum(discount),0),coalesce(sum(total),0),count(*) into discounts,total,cnt from receipts where shop_id=_shop and (created_at at time zone 'Asia/Tokyo')::date=_day;
select coalesce(sum(amount) filter(where kind='in'),0),coalesce(sum(amount) filter(where kind='out'),0) into money_in,money_out from cash_movements where session_id=sid;
return jsonb_build_object('shop_id',_shop,'shop_name',(select name from shops where id=_shop),'day',_day,'session_id',sid,'opening_cash',coalesce(float,0),'payments',methods,'sales_total',total,'sales_count',cnt,'discounts',discounts,'refunds',0,'cash_in',money_in,'cash_out',money_out,'cash_sales',cash,'expected',coalesce(float,0)+cash+money_in-money_out);end $$;
revoke all on function public.register_summary(uuid,date) from public,anon;grant execute on function public.register_summary(uuid,date) to authenticated;
create function public.register_action(_shop uuid,_day date,_action text,_data jsonb) returns jsonb language plpgsql security definer set search_path=public as $$ declare s register_sessions;result jsonb;denom text;counts int;counted bigint:=0;summary jsonb;begin
if not coalesce(pos_shop_access(_shop),false) then raise exception 'Not allowed for this shop';end if;
perform pg_advisory_xact_lock(hashtextextended(_shop::text||_day::text,0));
if _action='open' then
if _day is distinct from (now() at time zone 'Asia/Tokyo')::date then raise exception 'Open register for today only';end if;
insert into register_sessions(shop_id,day,opening_cash,opened_by) values(_shop,_day,(_data->>'opening_cash')::int,auth.uid()) returning to_jsonb(register_sessions.*) into result;return result;end if;
select * into s from register_sessions where shop_id=_shop and day=_day for update;if not found or s.status<>'open' then raise exception 'Open register required';end if;
if _action in ('in','out') then
if _day is distinct from (now() at time zone 'Asia/Tokyo')::date then raise exception 'Cash movements are for today only';end if;
insert into cash_movements(session_id,shop_id,kind,amount,reason,created_by) values(s.id,_shop,_action,(_data->>'amount')::int,btrim(_data->>'reason'),auth.uid()) returning to_jsonb(cash_movements.*) into result;return result;
elsif _action in ('check','close') then
if jsonb_typeof(_data->'denominations') is distinct from 'object' then raise exception 'Count notes and coins';end if;
for denom in select jsonb_object_keys(_data->'denominations') loop if denom not in ('10000','5000','2000','1000','500','100','50','10','5','1') then raise exception 'Invalid denomination';end if;counts:=(_data->'denominations'->>denom)::int;if counts is null or counts<0 then raise exception 'Invalid cash count';end if;counted:=counted+denom::int*counts;end loop;
summary:=register_summary(_shop,_day)||jsonb_build_object('counted',counted,'closed_by',(select name from profiles where id=auth.uid()),'closed_at',now());
insert into cash_checks(shop_id,day,opening_cash,cash_sales,expected,counted,difference,created_by,session_id,denominations,kind,summary) values(_shop,_day,s.opening_cash,(summary->>'cash_sales')::int,(summary->>'expected')::int,counted,counted-(summary->>'expected')::int,auth.uid(),s.id,_data->'denominations',_action,summary||jsonb_build_object('difference',counted-(summary->>'expected')::int)) returning to_jsonb(cash_checks.*) into result;
if _action='close' then update register_sessions set status='closed',closed_by=auth.uid(),closed_at=now() where id=s.id;end if;return result;
else raise exception 'Unknown register action';end if;end $$;
revoke all on function public.register_action(uuid,date,text,jsonb) from public,anon;grant execute on function public.register_action(uuid,date,text,jsonb) to authenticated;
create function public.guard_closed_register() returns trigger language plpgsql security definer set search_path=public as $$ declare s register_sessions;begin
perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text||(new.created_at at time zone 'Asia/Tokyo')::date::text,0));
select * into s from register_sessions where shop_id=new.shop_id and day=(new.created_at at time zone 'Asia/Tokyo')::date for share;
if found and s.status='closed' then raise exception 'Register is closed for this day';end if;return new;end $$;
revoke all on function public.guard_closed_register() from public,anon,authenticated;
create trigger closed_register_sales before insert on receipts for each row execute function guard_closed_register();
create function public.immutable_cash_record() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Saved cash records cannot be edited or deleted';end $$;
create trigger immutable_cash_check before update or delete on cash_checks for each row execute function immutable_cash_record();
create trigger immutable_cash_movement before update or delete on cash_movements for each row execute function immutable_cash_record();
do $$ declare definition text;begin
select pg_get_functiondef('public.save_pos_record(text,uuid,uuid,jsonb)'::regprocedure) into definition;
definition:=replace(definition,'if _kind=''settings'' then','if _kind in (''resume'',''cancel_hold'') then return resolve_held_sale(_id,_kind=''cancel_hold'',_data->>''reason''); end if; if _kind=''cash'' then raise exception ''Use denomination cash check''; end if; if _kind=''settings'' then');
definition:=replace(definition,'insert into held_sales(shop_id,created_by,name,cart) values(_shop,auth.uid(),left(coalesce(_data->>''name'',''''),100),_data)','insert into held_sales(shop_id,created_by,name,note,cart) values(_shop,auth.uid(),left(coalesce(_data->>''name'',''''),100),left(coalesce(_data->>''note'',''''),500),_data)');execute definition;end $$;
comment on function public.register_action(uuid,date,text,jsonb) is 'Authenticated shop-authorized audited actions; session lock serializes close with receipt writes; denomination totals are calculated in database.';
comment on function public.register_summary(uuid,date) is 'Shop-authorized receipt totals and cash movements. Refunds remain zero because no refund feature or refund records exist in this application.';