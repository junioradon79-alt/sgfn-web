-- Durcissement : empêche un utilisateur non-admin de modifier les colonnes
-- privilégiées de sa propre ligne `profiles`.
--
-- Contexte : la policy `profiles_self_update` (id = auth.uid()) autorise un
-- utilisateur à mettre à jour sa propre ligne, mais Postgres n'a pas de
-- restriction de colonne dans une policy. Sans garde, n'importe quel compte
-- connecté pouvait faire `update profiles set groupe='admin' where id=auth.uid()`
-- et s'auto-promouvoir administrateur (escalade de privilèges vérifiée en prod).
--
-- Ce trigger n'autorise un non-admin qu'à changer `nom_complet` et `telephone`
-- (self-service profil). Toute tentative de modifier groupe / rattachements /
-- statut / id / horodatage est rejetée. L'admin et le backend (service_role,
-- SECURITY DEFINER, triggers de provisioning — auth.uid() null) gardent tous
-- leurs droits.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $body$
begin
  -- Backend / service_role / migrations / triggers de provisioning : pas de
  -- session utilisateur → aucun garde-fou (ces chemins sont déjà de confiance).
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Administrateur : tous les droits (édition des rôles/rattachements via l'UI admin).
  if est_admin() then
    return new;
  end if;

  -- Utilisateur standard modifiant sa propre ligne : seules `nom_complet` et
  -- `telephone` sont modifiables. Tout le reste est réservé à l'administration.
  if new.groupe                 is distinct from old.groupe
     or new.famille_id          is distinct from old.famille_id
     or new.attributaire_id     is distinct from old.attributaire_id
     or new.autorite_coutumiere_id is distinct from old.autorite_coutumiere_id
     or new.operateur_id        is distinct from old.operateur_id
     or new.geometre_id         is distinct from old.geometre_id
     or new.commissaire_id      is distinct from old.commissaire_id
     or new.actif               is distinct from old.actif
     or new.id                  is distinct from old.id
     or new.cree_le             is distinct from old.cree_le then
    raise exception 'Champs réservés à l''administration (groupe, rattachements, statut).'
      using errcode = '42501';
  end if;

  return new;
end;
$body$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();
