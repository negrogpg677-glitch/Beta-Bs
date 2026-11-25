create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and coalesce(auth.role(), '') <> 'service_role' then
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
