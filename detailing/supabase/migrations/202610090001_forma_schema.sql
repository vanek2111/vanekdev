create extension if not exists pgcrypto;

create table if not exists public.forma_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forma_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.forma_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null default '',
  color text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.forma_bookings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('F-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid references auth.users(id) on delete set null,
  vehicle_id uuid references public.forma_vehicles(id) on delete set null,
  vehicle_label text not null default '',
  name text not null,
  contact text not null,
  email text not null default '',
  service text not null,
  message text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','in_progress','ready','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forma_vehicles_user_created_idx on public.forma_vehicles(user_id, created_at desc);
create index if not exists forma_bookings_user_created_idx on public.forma_bookings(user_id, created_at desc);
create index if not exists forma_bookings_status_created_idx on public.forma_bookings(status, created_at desc);

create or replace function public.forma_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forma_bookings_updated_at on public.forma_bookings;
create trigger forma_bookings_updated_at before update on public.forma_bookings
for each row execute function public.forma_set_updated_at();

drop trigger if exists forma_profiles_updated_at on public.forma_profiles;
create trigger forma_profiles_updated_at before update on public.forma_profiles
for each row execute function public.forma_set_updated_at();

create or replace function public.forma_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.forma_profiles(id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists forma_auth_user_created on auth.users;
create trigger forma_auth_user_created after insert on auth.users
for each row execute function public.forma_handle_new_user();

alter table public.forma_profiles enable row level security;
alter table public.forma_staff enable row level security;
alter table public.forma_vehicles enable row level security;
alter table public.forma_bookings enable row level security;

revoke all on public.forma_profiles, public.forma_staff, public.forma_vehicles, public.forma_bookings from anon;
grant select, update on public.forma_profiles to authenticated;
grant select on public.forma_staff to authenticated;
grant select, insert, update, delete on public.forma_vehicles to authenticated;
grant select, update on public.forma_bookings to authenticated;
grant all on public.forma_profiles, public.forma_staff, public.forma_vehicles, public.forma_bookings to service_role;

drop policy if exists forma_profiles_read_own on public.forma_profiles;
create policy forma_profiles_read_own on public.forma_profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists forma_profiles_update_own on public.forma_profiles;
create policy forma_profiles_update_own on public.forma_profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists forma_staff_read_own on public.forma_staff;
create policy forma_staff_read_own on public.forma_staff
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists forma_vehicles_read_own on public.forma_vehicles;
create policy forma_vehicles_read_own on public.forma_vehicles
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists forma_vehicles_read_staff on public.forma_vehicles;
create policy forma_vehicles_read_staff on public.forma_vehicles
for select to authenticated using (
  exists (
    select 1 from public.forma_staff s
    where s.user_id = (select auth.uid()) and s.role in ('owner','staff')
  )
);

drop policy if exists forma_vehicles_insert_own on public.forma_vehicles;
create policy forma_vehicles_insert_own on public.forma_vehicles
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists forma_vehicles_update_own on public.forma_vehicles;
create policy forma_vehicles_update_own on public.forma_vehicles
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists forma_vehicles_delete_own on public.forma_vehicles;
create policy forma_vehicles_delete_own on public.forma_vehicles
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists forma_bookings_read_own on public.forma_bookings;
create policy forma_bookings_read_own on public.forma_bookings
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists forma_bookings_read_staff on public.forma_bookings;
create policy forma_bookings_read_staff on public.forma_bookings
for select to authenticated using (
  exists (
    select 1 from public.forma_staff s
    where s.user_id = (select auth.uid()) and s.role in ('owner','staff')
  )
);

drop policy if exists forma_bookings_update_staff on public.forma_bookings;
create policy forma_bookings_update_staff on public.forma_bookings
for update to authenticated using (
  exists (
    select 1 from public.forma_staff s
    where s.user_id = (select auth.uid()) and s.role in ('owner','staff')
  )
) with check (
  exists (
    select 1 from public.forma_staff s
    where s.user_id = (select auth.uid()) and s.role in ('owner','staff')
  )
);
