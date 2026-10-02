-- =====================================================================
-- BOOMiiS Restaurant · Supabase setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once, including on a project where an earlier version was already run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- staff (who may use /admin) ----------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- ---------- updated_at helper ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- orders ----------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null check (char_length(ref) between 3 and 20),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  status         text not null default 'new'
                 check (status in ('new','preparing','ready','out','completed','cancelled')),
  mode           text not null check (mode in ('Pickup','Delivery')),
  customer_name  text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30),
  address        text not null default '' check (char_length(address) <= 300),
  note           text not null default '' check (char_length(note) <= 500),
  items          jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  total          numeric(10,2) not null check (total > 0 and total < 100000),
  pay_method     text not null default 'momo' check (pay_method in ('momo','bank')),
  pay_network    text not null default '' check (char_length(pay_network) <= 40),
  pay_to         text not null default '' check (char_length(pay_to) <= 40),
  pay_txn        text not null check (char_length(pay_txn) between 3 and 60),
  pay_status     text not null default 'pending' check (pay_status in ('pending','verified','rejected')),
  pay_reason     text check (char_length(pay_reason) <= 200),
  verified_at    timestamptz,
  constraint orders_ref_txn_unique unique (ref, pay_txn)   -- re-sending the same paid basket doesn't duplicate it
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- order checks: total must match the items, sensible quantities, and no flooding from one phone
create or replace function public.check_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item  jsonb;
  qty   numeric;
  price numeric;
  sum_  numeric := 0;
  recent int;
begin
  for item in select * from jsonb_array_elements(new.items) loop
    begin
      qty   := (item->>'qty')::numeric;
      price := (item->>'price')::numeric;
    exception when others then
      raise exception 'Invalid order item' using errcode = '22023';
    end;
    if qty is null or price is null or qty < 1 or qty > 50 or qty <> trunc(qty) or price < 0 or price > 5000
       or coalesce(char_length(item->>'name'), 0) not between 1 and 120 then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;
    sum_ := sum_ + qty * price;
  end loop;
  if round(sum_, 2) <> round(new.total, 2) then
    raise exception 'Order total does not match the items' using errcode = '22023';
  end if;

  select count(*) into recent
  from public.orders
  where customer_phone = new.customer_phone and created_at > now() - interval '10 minutes';
  if recent >= 5 then
    raise exception 'Too many orders from this number. Please wait a few minutes or call us.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.check_new_order() from public;
drop trigger if exists orders_check_new on public.orders;
create trigger orders_check_new before insert on public.orders
  for each row execute function public.check_new_order();

-- ---------- reservations ----------
create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status     text not null default 'requested'
             check (status in ('requested','confirmed','seated','cancelled','noshow')),
  name       text not null check (char_length(name) between 1 and 120),
  phone      text not null check (char_length(phone) between 6 and 30),
  guests     int  not null check (guests between 1 and 60),
  date       date not null,
  time       text not null check (char_length(time) <= 20),
  seating    text not null default 'No preference' check (char_length(seating) <= 30),
  note       text not null default '' check (char_length(note) <= 500)
);
create index if not exists reservations_date_idx on public.reservations (date);
drop trigger if exists reservations_touch on public.reservations;
create trigger reservations_touch before update on public.reservations
  for each row execute function public.touch_updated_at();

create or replace function public.check_new_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reservations
      where phone = new.phone and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Too many booking requests from this number. Please call us.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.check_new_reservation() from public;
drop trigger if exists reservations_check_new on public.reservations;
create trigger reservations_check_new before insert on public.reservations
  for each row execute function public.check_new_reservation();

-- ---------- menu changes (prices, sold out, added/removed dishes) ----------
-- The printed menu lives in the website; this table only stores staff changes on top of it.
create table if not exists public.menu_changes (
  id         text primary key check (char_length(id) <= 80),
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
drop trigger if exists menu_changes_touch on public.menu_changes;
create trigger menu_changes_touch before update on public.menu_changes
  for each row execute function public.touch_updated_at();

-- ---------- row-level security ----------
alter table public.staff        enable row level security;
alter table public.orders       enable row level security;
alter table public.reservations enable row level security;
alter table public.menu_changes enable row level security;

-- staff: a signed-in user can see only their own staff row
drop policy if exists "staff read own row" on public.staff;
create policy "staff read own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

-- orders: anyone can PLACE a new, unverified order; only staff can read or change orders
drop policy if exists "public places orders" on public.orders;
create policy "public places orders" on public.orders
  for insert to anon, authenticated
  with check (status = 'new' and pay_status = 'pending' and verified_at is null and pay_reason is null);
drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated using ((select public.is_staff()));
drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- reservations: anyone can REQUEST a table; only staff can read or change bookings
drop policy if exists "public requests tables" on public.reservations;
create policy "public requests tables" on public.reservations
  for insert to anon, authenticated
  with check (status = 'requested' and date >= current_date - 1 and date <= current_date + 180);
drop policy if exists "staff read reservations" on public.reservations;
create policy "staff read reservations" on public.reservations
  for select to authenticated using ((select public.is_staff()));
drop policy if exists "staff update reservations" on public.reservations;
create policy "staff update reservations" on public.reservations
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- menu changes: everyone can read (the menu page needs them); only staff can write
drop policy if exists "everyone reads menu changes" on public.menu_changes;
create policy "everyone reads menu changes" on public.menu_changes
  for select to anon, authenticated using (true);
drop policy if exists "staff write menu changes" on public.menu_changes;
drop policy if exists "staff add menu changes" on public.menu_changes;
drop policy if exists "staff edit menu changes" on public.menu_changes;
drop policy if exists "staff delete menu changes" on public.menu_changes;
create policy "staff add menu changes" on public.menu_changes
  for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit menu changes" on public.menu_changes
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete menu changes" on public.menu_changes
  for delete to authenticated using ((select public.is_staff()));

-- ---------- table privileges for the website's public key ----------
revoke all on public.staff, public.orders, public.reservations, public.menu_changes from anon, authenticated;
grant select                         on public.staff        to authenticated;
grant insert                         on public.orders       to anon, authenticated;
grant select, update                 on public.orders       to authenticated;
grant insert                         on public.reservations to anon, authenticated;
grant select, update                 on public.reservations to authenticated;
grant select                         on public.menu_changes to anon, authenticated;
grant insert, update, delete         on public.menu_changes to authenticated;

-- ---------- realtime (new orders pop up on the admin instantly) ----------
do $$
declare t text;
begin
  foreach t in array array['orders','reservations','menu_changes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- make the admin account staff ----------
-- Adds nothing if the user doesn't exist yet; run again after creating it in Authentication → Users.
insert into public.staff (user_id, name)
select id, 'BOOMiiS Admin' from auth.users where email = 'boomiisgh@gmail.com'
on conflict (user_id) do nothing;
