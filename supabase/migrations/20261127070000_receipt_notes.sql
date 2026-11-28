-- Notes on a sale receipt (printed on the receipt). Saved right after checkout and editable later
-- by staff of that shop (or the owner/manager). Every change is written to the audit log. Safe to run again.
-- Audit helper for server functions (any action name). Only callable from other database functions.
create or replace function public.log_app_event(_action text, _table text, _record_id text, _details jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  select * into pr from profiles where id = auth.uid();
  insert into audit_log (user_id, user_name, staff_code, shop_id, action, table_name, record_id, new_values, device)
  values (auth.uid(), pr.name, pr.staff_code, coalesce(nullif(_details->>'shop_id','')::uuid, pr.shop_id), left(_action,50), left(_table,50), left(_record_id,100), _details, request_device());
end $$;
revoke all on function public.log_app_event(text, text, text, jsonb) from public, anon, authenticated;

alter table public.receipts add column if not exists note text not null default '';
alter table public.receipts drop constraint if exists receipts_note_length;
alter table public.receipts add constraint receipts_note_length check (length(note) <= 500);

create or replace function public.set_receipt_note(_receipt_id uuid, _note text)
returns text language plpgsql security definer set search_path = public as $$
declare r receipts; n text := left(btrim(coalesce(_note, '')), 500);
begin
  select * into r from receipts where id = _receipt_id;
  if not found then raise exception 'Receipt not found'; end if;
  if not works_at_shop(r.shop_id) then raise exception 'You do not work at this shop'; end if;
  update receipts set note = n where id = r.id;
  perform log_app_event('receipt_note', 'receipts', r.receipt_no, jsonb_build_object('note', n));
  return n;
end $$;
revoke all on function public.set_receipt_note(uuid, text) from public, anon;
grant execute on function public.set_receipt_note(uuid, text) to authenticated;
