-- Brawl Rush v3.6 — protection du classement mondial (facultatif mais recommandé)
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Remplace la fonction de garde des profils : mêmes protections qu'avant (v2b.sql) + les trophées ne peuvent pas
-- monter plus vite qu'en jouant réellement (environ 60 trophées d'un coup, puis 25 par minute écoulée), plafond 200 000.
-- Le serveur du jeu (clé secrète) n'est pas concerné par ces limites.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
declare
  mins numeric;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and coalesce(auth.role(), '') <> 'service_role' then
    if new.username is distinct from old.username then raise exception 'Le pseudo se change depuis le jeu (délai et prix contrôlés par le serveur)'; end if;
    if new.handle is distinct from old.handle or new.handle_changes is distinct from old.handle_changes or new.handle_unlock is distinct from old.handle_unlock
      or new.name_changed_at is distinct from old.name_changed_at or new.name_changes is distinct from old.name_changes
      or new.elo is distinct from old.elo or new.ranked_games is distinct from old.ranked_games or new.ranked_wins is distinct from old.ranked_wins then
      raise exception 'Champ protégé : modifiable uniquement par le serveur du jeu';
    end if;
    if new.trophies > 200000 then raise exception 'Trophées invalides'; end if;
    mins := greatest(0, extract(epoch from (now() - coalesce(old.updated_at, now() - interval '1 day'))) / 60);
    -- premier envoi après la création du compte (progression invité importée) : autorisé une fois
    if new.trophies > old.trophies + 60 + 25 * mins and not (old.trophies = 0 and coalesce(old.save, '{}'::jsonb) = '{}'::jsonb) then
      raise exception 'Progression de trophées impossible (classement protégé)';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();
