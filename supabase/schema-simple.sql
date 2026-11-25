create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  avatar      text not null default 'sherry',
  save        jsonb not null default '{}'::jsonb,
  trophies    integer not null default 0 check (trophies >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  constraint save_size check (pg_column_size(save) < 200000)
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
create index if not exists profiles_trophies on public.profiles (trophies desc);

alter table public.profiles enable row level security;

drop policy if exists "profil : lecture de sa ligne" on public.profiles;
create policy "profil : lecture de sa ligne" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profil : création de sa ligne" on public.profiles;
create policy "profil : création de sa ligne" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profil : mise à jour de sa ligne" on public.profiles;
create policy "profil : mise à jour de sa ligne" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Le pseudo ne peut pas être modifié';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'joueur' || substr(replace(new.id::text, '-', ''), 1, 8));
begin
  insert into public.profiles (id, username) values (new.id, uname)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace view public.leaderboard as
  select username, avatar, trophies from public.profiles order by trophies desc limit 100;
grant select on public.leaderboard to anon, authenticated;


grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
