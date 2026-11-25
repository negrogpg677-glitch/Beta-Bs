alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists handle_changes int not null default 0;
alter table public.profiles add column if not exists handle_unlock boolean not null default false;
alter table public.profiles add column if not exists name_changed_at timestamptz;
alter table public.profiles add column if not exists name_changes jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists elo int not null default 1000;
alter table public.profiles add column if not exists ranked_games int not null default 0;
alter table public.profiles add column if not exists ranked_wins int not null default 0;
alter table public.profiles add column if not exists last_seen timestamptz;
create unique index if not exists profiles_handle_key on public.profiles (handle);
create index if not exists profiles_elo on public.profiles (elo desc);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'handle_format') then
    alter table public.profiles add constraint handle_format check (handle is null or handle ~ '^[A-Z]{4,16}$');
  end if;
end $$;

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.username is distinct from old.username then raise exception 'Le pseudo se change depuis le jeu (délai et prix contrôlés par le serveur)'; end if;
    if new.handle is distinct from old.handle or new.handle_changes is distinct from old.handle_changes or new.handle_unlock is distinct from old.handle_unlock
      or new.name_changed_at is distinct from old.name_changed_at or new.name_changes is distinct from old.name_changes
      or new.elo is distinct from old.elo or new.ranked_games is distinct from old.ranked_games or new.ranked_wins is distinct from old.ranked_wins then
      raise exception 'Champ protégé : modifiable uniquement par le serveur du jeu';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create table if not exists public.friendships (
  a uuid not null references public.profiles (id) on delete cascade,
  b uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create index if not exists friendships_b on public.friendships (b);

create table if not exists public.gifts (
  id bigserial primary key,
  to_id uuid not null references public.profiles (id) on delete cascade,
  brawler text not null,
  from_name text,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gifts_to on public.gifts (to_id) where not claimed;

create table if not exists public.ranked_matches (
  id bigserial primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  mode text,
  result int,
  delta int,
  elo_after int,
  created_at timestamptz not null default now()
);
create index if not exists ranked_matches_player on public.ranked_matches (player, created_at desc);

create table if not exists public.game_config (key text primary key, value jsonb);

alter table public.friendships enable row level security;
alter table public.gifts enable row level security;
alter table public.ranked_matches enable row level security;
alter table public.game_config enable row level security;
grant select, insert, update, delete on public.friendships, public.gifts, public.ranked_matches, public.game_config to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select, insert, update, delete on public.profiles to service_role;
