-- Staff attendance: clock in/out at the shop with GPS + fingerprint/Face ID (passkey on the staff's phone),
-- "going out" trips with live location while the app is open, and a monthly hours sheet for owner/manager.
-- Location is only saved at each button press and while a staff member has pressed "Go out". Safe to run again.
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

-- ---------- Shop locations ----------
alter table public.shops add column if not exists lat double precision;
alter table public.shops add column if not exists lng double precision;
alter table public.shops add column if not exists geofence_m integer not null default 150;
alter table public.shops drop constraint if exists shops_geofence_check;
alter table public.shops add constraint shops_geofence_check check (geofence_m between 30 and 2000);

create or replace function public.att_distance(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns integer language sql immutable as $$
  select round(2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::integer
$$;

create or replace function public.set_shop_location(_shop_id uuid, _lat double precision, _lng double precision, _radius integer)
returns public.shops language plpgsql security definer set search_path = public as $$
declare s shops;
begin
  if not has_role(auth.uid(), 'owner') then raise exception 'Only the owner can set shop locations'; end if;
  if _lat is null or _lng is null or _lat not between 20 and 50 or _lng not between 120 and 155 then raise exception 'Location must be in Japan'; end if;
  update shops set lat = _lat, lng = _lng, geofence_m = coalesce(_radius, geofence_m) where id = _shop_id returning * into s;
  if not found then raise exception 'Shop not found'; end if;
  perform log_app_event('shop_location', 'shops', s.id::text, jsonb_build_object('lat', _lat, 'lng', _lng, 'radius', s.geofence_m, 'shop_id', s.id));
  return s;
end $$;
revoke all on function public.set_shop_location(uuid, double precision, double precision, integer) from public, anon;
grant execute on function public.set_shop_location(uuid, double precision, double precision, integer) to authenticated;

-- ---------- Fingerprint / Face ID phones (passkeys) ----------
create table if not exists public.attendance_devices (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique check (length(credential_id) between 16 and 1024),
  label text not null default '',
  created_at timestamptz not null default now()
);
alter table public.attendance_devices enable row level security;
grant select on public.attendance_devices to authenticated;
drop policy if exists "read own or manager devices" on public.attendance_devices;
create policy "read own or manager devices" on public.attendance_devices for select to authenticated
  using (staff_id = auth.uid() or has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager'));

create or replace function public.register_attendance_device(_credential_id text, _label text)
returns public.attendance_devices language plpgsql security definer set search_path = public as $$
declare d attendance_devices;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select * into d from attendance_devices where credential_id = _credential_id;
  if found then
    if d.staff_id <> auth.uid() then raise exception 'This fingerprint is already used by another staff member'; end if;
    return d;
  end if;
  if exists (select 1 from attendance_devices where staff_id = auth.uid()) then
    raise exception 'Fingerprint is already set up on another phone. Ask the owner or manager to reset it first.';
  end if;
  insert into attendance_devices (staff_id, credential_id, label) values (auth.uid(), _credential_id, left(btrim(coalesce(_label, '')), 80)) returning * into d;
  perform log_app_event('attendance_device_added', 'attendance_devices', d.id::text, jsonb_build_object('label', d.label));
  return d;
end $$;

create or replace function public.reset_attendance_device(_staff_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager')) then raise exception 'Only the owner or a manager can reset fingerprints'; end if;
  delete from attendance_devices where staff_id = _staff_id;
  get diagnostics n = row_count;
  perform log_app_event('attendance_device_reset', 'attendance_devices', _staff_id::text, jsonb_build_object('removed', n));
  return n;
end $$;

-- ---------- Punches ----------
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid references public.shops(id),
  kind text not null check (kind in ('clock_in', 'out_start', 'out_end', 'clock_out')),
  reason text not null default '',
  at timestamptz not null default now(),
  lat double precision, lng double precision, accuracy real,
  distance_m integer,
  in_fence boolean,
  verified boolean not null default false,
  manual boolean not null default false,
  added_by uuid references auth.users(id),
  note text not null default '' check (length(note) <= 300)
);
create index if not exists attendance_events_staff_at on public.attendance_events (staff_id, at);
create index if not exists attendance_events_at on public.attendance_events (at);
alter table public.attendance_events enable row level security;
grant select on public.attendance_events to authenticated;
drop policy if exists "read own or manager attendance" on public.attendance_events;
create policy "read own or manager attendance" on public.attendance_events for select to authenticated
  using (staff_id = auth.uid() or has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager'));

-- live location while out (one row at most every 45 s)
create table if not exists public.attendance_points (
  id bigint generated always as identity primary key,
  staff_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.attendance_events(id) on delete cascade,
  at timestamptz not null default now(),
  lat double precision not null, lng double precision not null, accuracy real
);
create index if not exists attendance_points_trip on public.attendance_points (trip_id, at);
alter table public.attendance_points enable row level security;
grant select on public.attendance_points to authenticated;
drop policy if exists "read own or manager points" on public.attendance_points;
create policy "read own or manager points" on public.attendance_points for select to authenticated
  using (staff_id = auth.uid() or has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager'));

-- current state of a staff member: off / in / out. A day left open (no clock-out) counts as off the next day.
create or replace function public.attendance_state(_staff uuid)
returns table (state text, since timestamptz, event_id uuid, shop_id uuid, trip_id uuid)
language sql stable security definer set search_path = public as $$
  with last as (
    select * from attendance_events where staff_id = _staff order by at desc limit 1
  ), trip as (
    select e.id from attendance_events e, last
    where e.staff_id = _staff and e.kind = 'out_start' and last.kind = 'out_start' and e.id = last.id
  )
  select
    case when l.kind is null or l.kind = 'clock_out'
           or (l.at at time zone 'Asia/Tokyo')::date < (now() at time zone 'Asia/Tokyo')::date then 'off'
         when l.kind = 'out_start' then 'out' else 'in' end,
    l.at, l.id, l.shop_id, (select id from trip)
  from (select 1) x left join last l on true
$$;
revoke all on function public.attendance_state(uuid) from public, anon, authenticated;

create or replace function public.my_attendance()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s record;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select * into s from attendance_state(auth.uid());
  return jsonb_build_object(
    'state', s.state, 'since', s.since, 'shop_id', s.shop_id, 'trip_id', s.trip_id,
    'devices', (select coalesce(jsonb_agg(credential_id), '[]'::jsonb) from attendance_devices where staff_id = auth.uid()),
    'today', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'at', at, 'reason', reason, 'shop_id', shop_id, 'in_fence', in_fence, 'distance_m', distance_m, 'manual', manual) order by at), '[]'::jsonb)
              from attendance_events where staff_id = auth.uid() and (at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date));
end $$;

create or replace function public.attendance_punch(_kind text, _lat double precision, _lng double precision, _accuracy real, _credential_id text, _reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s record; sh record; e attendance_events;
  allow integer;
begin
  if uid is null or not (has_role(uid, 'owner') or has_role(uid, 'manager') or has_role(uid, 'staff')) then raise exception 'Not allowed'; end if;
  if exists (select 1 from profiles where id = uid and disabled) then raise exception 'This account is disabled'; end if;
  if _kind not in ('clock_in', 'out_start', 'out_end', 'clock_out') then raise exception 'Unknown action'; end if;
  if not exists (select 1 from attendance_devices where staff_id = uid and credential_id = _credential_id) then
    raise exception 'Fingerprint check failed. Set up fingerprint on this phone first.';
  end if;
  if _lat is null or _lng is null then raise exception 'Turn on location (GPS) and allow it for this site'; end if;
  if coalesce(_accuracy, 9999) > 500 then raise exception 'GPS signal is weak (±% m). Go near a window or outside and try again.', round(coalesce(_accuracy, 9999)); end if;

  select * into s from attendance_state(uid);
  if _kind = 'clock_in' and s.state <> 'off' then raise exception 'You are already clocked in'; end if;
  if _kind = 'out_start' and s.state <> 'in' then raise exception 'Clock in first'; end if;
  if _kind = 'out_end' and s.state <> 'out' then raise exception 'You are not out'; end if;
  if _kind = 'clock_out' and s.state = 'off' then raise exception 'You are not clocked in'; end if;
  if _kind = 'out_start' and length(btrim(coalesce(_reason, ''))) = 0 then raise exception 'Choose why you are going out'; end if;

  -- nearest shop this person works at
  select x.id, x.geofence_m, att_distance(_lat, _lng, x.lat, x.lng) as dist into sh
  from shops x
  where x.lat is not null and works_at_shop(x.id)
  order by att_distance(_lat, _lng, x.lat, x.lng) limit 1;
  if sh.id is null then raise exception 'The owner has not set the shop location yet (Shops page → Set shop location)'; end if;
  allow := sh.geofence_m + least(coalesce(_accuracy, 0), 100)::integer;
  if _kind = 'clock_in' and sh.dist > allow then
    raise exception 'You are % m from the nearest shop. Clock in inside the shop.', sh.dist;
  end if;

  if _kind = 'clock_out' and s.state = 'out' then
    -- finishing the day while out: close the trip first
    insert into attendance_events (staff_id, shop_id, kind, at, lat, lng, accuracy, distance_m, in_fence, verified)
    values (uid, sh.id, 'out_end', now() - interval '1 millisecond', _lat, _lng, _accuracy, sh.dist, sh.dist <= allow, true);
  end if;

  insert into attendance_events (staff_id, shop_id, kind, reason, lat, lng, accuracy, distance_m, in_fence, verified)
  values (uid, sh.id, _kind, left(btrim(coalesce(_reason, '')), 100), _lat, _lng, _accuracy, sh.dist, sh.dist <= allow, true)
  returning * into e;
  if _kind = 'out_start' then
    insert into attendance_points (staff_id, trip_id, lat, lng, accuracy) values (uid, e.id, _lat, _lng, _accuracy);
  end if;
  return my_attendance();
end $$;

create or replace function public.attendance_track(_lat double precision, _lng double precision, _accuracy real)
returns boolean language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  select * into s from attendance_state(auth.uid());
  if s.state <> 'out' or s.trip_id is null then return false; end if;
  if _lat is null or _lng is null or coalesce(_accuracy, 9999) > 1000 then return false; end if;
  if exists (select 1 from attendance_points where trip_id = s.trip_id and at > now() - interval '45 seconds') then return false; end if;
  insert into attendance_points (staff_id, trip_id, lat, lng, accuracy) values (auth.uid(), s.trip_id, _lat, _lng, _accuracy);
  return true;
end $$;

-- owner/manager: add a missed punch (e.g. forgot to clock out). Logged.
create or replace function public.attendance_add_manual(_staff_id uuid, _kind text, _at timestamptz, _note text)
returns public.attendance_events language plpgsql security definer set search_path = public as $$
declare e attendance_events;
begin
  if not (has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager')) then raise exception 'Only the owner or a manager can fix attendance'; end if;
  if _kind not in ('clock_in', 'out_start', 'out_end', 'clock_out') then raise exception 'Unknown action'; end if;
  if _at is null or _at > now() + interval '5 minutes' or _at < now() - interval '62 days' then raise exception 'Pick a time within the last 2 months'; end if;
  if length(btrim(coalesce(_note, ''))) < 3 then raise exception 'Write why you are adding this'; end if;
  insert into attendance_events (staff_id, shop_id, kind, at, manual, added_by, note, verified)
  values (_staff_id, (select shop_id from profiles where id = _staff_id), _kind, _at, true, auth.uid(), left(btrim(_note), 300), false)
  returning * into e;
  perform log_app_event('attendance_fix', 'attendance_events', e.id::text, jsonb_build_object('staff_id', _staff_id, 'kind', _kind, 'at', _at, 'note', e.note));
  return e;
end $$;

-- monthly hours sheet: one row per staff per day (JST)
create or replace function public.attendance_month(_month date)
returns table (staff_id uuid, name text, staff_code text, day date, first_in timestamptz, last_out timestamptz,
               worked_min integer, outside_min integer, trips integer, open_day boolean, outside_fence boolean, manual boolean)
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.*, (e.at at time zone 'Asia/Tokyo')::date as d,
           lead(e.kind) over w as next_kind, lead(e.at) over w as next_at
    from attendance_events e
    where (has_role(auth.uid(), 'owner') or has_role(auth.uid(), 'manager'))
      and e.at >= (date_trunc('month', _month)::timestamp at time zone 'Asia/Tokyo')
      and e.at <  ((date_trunc('month', _month) + interval '1 month')::timestamp at time zone 'Asia/Tokyo')
    window w as (partition by e.staff_id, (e.at at time zone 'Asia/Tokyo')::date order by e.at)
  ), work as (
    -- a work span runs from clock_in to the first clock_out after it on the same day
    select i.staff_id, i.d, i.at as t_in,
           (select min(o.at) from ev o where o.staff_id = i.staff_id and o.d = i.d and o.kind = 'clock_out' and o.at > i.at) as t_out
    from ev i where i.kind = 'clock_in'
  ), trip as (
    select staff_id, d, at as t0, case when next_kind in ('out_end', 'clock_out') then next_at end as t1 from ev where kind = 'out_start'
  )
  select p.id, p.name, p.staff_code, x.d,
    (select min(t_in) from work w where w.staff_id = x.staff_id and w.d = x.d),
    (select max(t_out) from work w where w.staff_id = x.staff_id and w.d = x.d),
    coalesce((select sum(extract(epoch from (t_out - t_in)) / 60)::integer from work w where w.staff_id = x.staff_id and w.d = x.d and t_out is not null), 0),
    coalesce((select sum(extract(epoch from (t1 - t0)) / 60)::integer from trip t where t.staff_id = x.staff_id and t.d = x.d and t1 is not null), 0),
    (select count(*)::integer from trip t where t.staff_id = x.staff_id and t.d = x.d),
    exists (select 1 from work w where w.staff_id = x.staff_id and w.d = x.d and t_out is null),
    bool_or(x.kind in ('clock_in', 'clock_out') and x.in_fence = false),
    bool_or(x.manual)
  from ev x join profiles p on p.id = x.staff_id
  group by p.id, p.name, p.staff_code, x.staff_id, x.d
  order by p.name, x.d
$$;

revoke all on function public.my_attendance(), public.attendance_punch(text, double precision, double precision, real, text, text),
  public.attendance_track(double precision, double precision, real), public.attendance_add_manual(uuid, text, timestamptz, text),
  public.attendance_month(date), public.register_attendance_device(text, text), public.reset_attendance_device(uuid) from public, anon;
grant execute on function public.my_attendance(), public.attendance_punch(text, double precision, double precision, real, text, text),
  public.attendance_track(double precision, double precision, real), public.attendance_add_manual(uuid, text, timestamptz, text),
  public.attendance_month(date), public.register_attendance_device(text, text), public.reset_attendance_device(uuid) to authenticated;

notify pgrst, 'reload schema';
