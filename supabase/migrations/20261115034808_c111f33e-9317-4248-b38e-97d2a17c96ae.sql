create extension if not exists pg_cron;
create function public.held_write_guard() returns trigger language plpgsql set search_path=public as $$ begin
if tg_op='INSERT' then new.expires_at:=new.created_at+interval '24 hours';elsif old.status='held' and new.status='resumed' and old.expires_at<=now() then new.status:='expired';end if;
return new;end $$;
create trigger held_deadline_guard before insert or update on held_sales for each row execute function held_write_guard();
comment on function public.phone_reserved(uuid) is 'Intentionally authenticated reservation lookup. Returns only a boolean; active reservations stop blocking at exactly 24 hours independently of hourly audit cleanup.';
comment on function public.resolve_held_sale(uuid,boolean,text) is 'Intentionally authenticated write boundary: verifies active shop authority, creator/manager rights and nonempty cancellation reason; all transitions trigger audit and reservation release.';
comment on function public.register_action(uuid,date,text,jsonb) is 'Intentionally authenticated RPC with active shop-role validation; all cash writes audited; note/coin totals server calculated and close serialized with sales.';
comment on function public.register_summary(uuid,date) is 'Intentionally authenticated shop-scoped totals; staff and managers cannot read other shops. No refund feature exists: no refund records to total.';