-- Notes on a sale receipt (printed on the receipt). Saved right after checkout and editable later
-- by staff of that shop (or the owner/manager). Every change is written to the audit log. Safe to run again.
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
  perform log_event('receipt_note', 'receipts', r.receipt_no, jsonb_build_object('note', n));
  return n;
end $$;
revoke all on function public.set_receipt_note(uuid, text) from public, anon;
grant execute on function public.set_receipt_note(uuid, text) to authenticated;
